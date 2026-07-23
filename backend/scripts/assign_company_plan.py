"""
assign_company_plan.py
──────────────────────
Manually assigns a company plan to a user identified by email.

Usage:
    python scripts/assign_company_plan.py \
        --email 22h51a73c6@cmrcet.ac.in \
        --plan "5 Recruiter Plan"

What it does:
  1. Looks up the user in public.profiles by email/organization_email
  2. Looks up the plan in public.company_plans by name
  3. Creates a company row owned by that user (or reuses an existing one)
  4. Upserts a company_members row for the owner with credits allocated
"""

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

# ── Make sure backend packages are importable ─────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.services.db.supabase_service import get_db_admin_service


# ── Core logic ────────────────────────────────────────────────────────────────

async def assign(email: str, plan_name: str) -> None:
    db = get_db_admin_service()

    # 1. Find the profile by email
    print(f"\n🔍 Looking up profile for: {email}")
    def _find_profile():
        return (
            db.client.from_("profiles")
            .select("*")
            .or_(f"email.eq.{email},organization_email.eq.{email}")
            .limit(1)
            .execute()
        )

    res = await db.run(_find_profile)
    profiles = getattr(res, "data", []) or []

    if not profiles:
        print(f"❌ ERROR: No profile found for '{email}'.")
        print("   Make sure the user has logged in at least once so their profile row exists.")
        return

    profile = profiles[0]
    user_id = profile["user_id"]
    user_display = profile.get("full_name") or profile.get("first_name") or profile.get("email") or user_id
    print(f"✅ Found Profile: user_id={user_id}, name={user_display}")

    # 2. Find the plan
    print(f"\n🔍 Looking up plan: '{plan_name}'")
    def _find_plan():
        return (
            db.client.from_("company_plans")
            .select("*")
            .eq("name", plan_name)
            .limit(1)
            .execute()
        )

    plan_res = await db.run(_find_plan)
    plans = getattr(plan_res, "data", []) or []

    if not plans:
        # List available plans to help the caller
        def _list_plans():
            return db.client.from_("company_plans").select("name, recruiter_seats, total_credits").execute()
        all_plans_res = await db.run(_list_plans)
        all_plans = getattr(all_plans_res, "data", []) or []
        print(f"❌ ERROR: Plan '{plan_name}' not found in company_plans.")
        if all_plans:
            print("   Available plans:")
            for p in all_plans:
                print(f"     • {p['name']}  ({p['recruiter_seats']} seats, {p['total_credits']} credits)")
        return

    plan = plans[0]
    plan_id = plan["id"]
    seats = plan["recruiter_seats"]
    credits_per_seat = plan.get("credits_per_seat", 100)
    total_credits = plan["total_credits"]
    print(f"✅ Found Plan: {plan['name']} (id={plan_id}, seats={seats}, total_credits={total_credits})")

    # 3. Find or create company
    print(f"\n🏢 Checking for existing company owned by this user...")
    def _check_company():
        return (
            db.client.from_("companies")
            .select("*")
            .eq("owner_user_id", user_id)
            .maybe_single()
            .execute()
        )

    co_res = await db.run(_check_company)
    co_data = getattr(co_res, "data", None)

    if co_data and isinstance(co_data, dict):
        company_id = co_data["id"]
        print(f"✅ Existing company found: '{co_data['name']}' (id={company_id})")
        # Update plan & seats
        def _update_company():
            return (
                db.client.from_("companies")
                .update({
                    "plan_id": plan_id,
                    "seats_total": seats,
                    "total_credits": total_credits,
                    "status": "active",
                })
                .eq("id", company_id)
                .execute()
            )
        await db.run(_update_company)
        print(f"   ↳ Updated company plan to '{plan['name']}'")
    else:
        company_id = str(uuid.uuid4())
        company_name = f"{user_display}'s Company"
        print(f"✨ Creating new company: '{company_name}'")
        def _create_company():
            return (
                db.client.from_("companies")
                .insert({
                    "id": company_id,
                    "name": company_name,
                    "owner_user_id": user_id,
                    "plan_id": plan_id,
                    "seats_total": seats,
                    "seats_used": 1,
                    "total_credits": total_credits,
                    "credits_consumed": 0,
                    "status": "active",
                })
                .execute()
            )
        await db.run(_create_company)
        print(f"✅ Company created (id={company_id})")

    # 4. Upsert company_members row for the owner
    print(f"\n👤 Upserting membership for owner...")
    def _upsert_member():
        return (
            db.client.from_("company_members")
            .upsert({
                "company_id": company_id,
                "user_id": user_id,
                "role": "owner",
                "status": "active",
                "credits_allocated": total_credits,
                "credits_consumed": 0,
            }, on_conflict="company_id,user_id")
            .execute()
        )
    await db.run(_upsert_member)
    print(f"✅ Membership upserted (role=owner, credits_allocated={total_credits})")

    # 5. Update profile to mark onboarding complete (optional quality-of-life)
    def _update_profile():
        return (
            db.client.from_("profiles")
            .update({"onboarding_completed": True})
            .eq("user_id", user_id)
            .execute()
        )
    await db.run(_update_profile)

    print(f"\n🎉 Done! '{email}' is now the owner of a company on the '{plan['name']}'.")
    print(f"   Company ID : {company_id}")
    print(f"   Plan       : {plan['name']}  ({seats} seats, {total_credits} credits)")
    print(f"   User ID    : {user_id}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Assign a company plan to a user by email.")
    parser.add_argument("--email", required=True, help="User email address")
    parser.add_argument("--plan", default="5 Recruiter Plan", help="Company plan name (default: '5 Recruiter Plan')")
    args = parser.parse_args()

    asyncio.run(assign(args.email, args.plan))
