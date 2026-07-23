"""
Assigns the 5 Recruiter Plan to user: 22h51a73c6@cmrcet.ac.in (or specified email).
Run: python -m scripts.assign_company_plan
"""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from app.services.db.supabase_service import get_db_admin_service

async def assign_plan(email: str, plan_name: str = "5 Recruiter Plan", company_name: str = "CMRCET Recruiting"):
    db = get_db_admin_service()
    email_clean = email.strip().lower()

    # 1. Find profile
    def _find_profile():
        return db.client.from_("profiles").select("*").or_(f"email.ilike.{email_clean},organization_email.ilike.{email_clean}").execute()

    res = await db.run(_find_profile)
    profiles = getattr(res, "data", []) or []

    if not profiles:
        print(f"❌ ERROR: No profile found matching email '{email}' in Supabase profiles table.")
        print("Please ask the user to log in / sign up at least once so their profile row is created.")
        return

    profile = profiles[0]
    user_id = profile["user_id"]
    user_display = profile.get("first_name") or profile.get("email") or user_id
    print(f"✅ Found Profile: user_id={user_id}, identifier={user_display}")

    # 2. Find 5 Recruiter Plan
    def _find_plan():
        return db.client.from_("company_plans").select("*").eq("name", plan_name).single().execute()

    plan_res = await db.run(_find_plan)
    plan = getattr(plan_res, "data", None)
    if not plan:
        print(f"❌ ERROR: Plan '{plan_name}' not found in public.company_plans.")
        return

    plan_id = plan["id"]
    seats = plan["recruiter_seats"]
    total_credits = plan["total_credits"]
    print(f"✅ Found Plan: {plan['name']} (ID: {plan_id}, Seats: {seats}, Credits: {total_credits})")

    # 3. Create or Update Company
    def _check_company():
        return db.client.from_("companies").select("*").eq("owner_user_id", user_id).maybe_single().execute()

    existing_co = await db.run(_check_company)
    co_data = getattr(existing_co, "data", None)

    if co_data:
        company_id = co_data["id"]
        print(f"ℹ️ Company already exists for owner: {company_id}. Updating plan...")
        def _upd_co():
            return db.client.from_("companies").update({
                "plan_id": plan_id,
                "seats_total": seats,
                "status": "active"
            }).eq("id", company_id).execute()
        await db.run(_upd_co)
    else:
        print(f"⚙️ Creating new company '{company_name}'...")
        def _ins_co():
            return db.client.from_("companies").insert({
                "name": company_name,
                "owner_user_id": user_id,
                "plan_id": plan_id,
                "seats_total": seats,
                "seats_used": 1,
                "status": "active"
            }).execute()
        co_res = await db.run(_ins_co)
        company_id = co_res.data[0]["id"]
        print(f"✅ Created Company ID: {company_id}")

    # 4. Create or Update Company Member (Owner)
    def _ins_mem():
        return db.client.from_("company_members").upsert({
            "company_id": company_id,
            "user_id": user_id,
            "role": "owner",
            "status": "active",
            "credits_allocated": total_credits,
            "credits_consumed": 0,
        }, on_conflict="company_id,user_id").execute()
    await db.run(_ins_mem)

    # 5. Create or Update Company Credits
    def _ins_cred():
        return db.client.from_("company_credits").upsert({
            "company_id": company_id,
            "total_allocated": total_credits,
            "total_consumed": 0
        }, on_conflict="company_id").execute()
    await db.run(_ins_cred)

    # 6. Log Subscription History
    def _ins_sub():
        return db.client.from_("company_subscription_history").insert({
            "company_id": company_id,
            "plan_id": plan_id,
            "action": "activated",
            "seats_after": seats,
            "credits_after": total_credits,
            "currency": "USD",
            "activated_by": "admin_script",
            "notes": f"Manually provisioned {plan_name}"
        }).execute()
    await db.run(_ins_sub)

    # 7. Update user profile onboarding status
    def _upd_profile():
        return db.client.from_("profiles").update({
            "company_name": company_name,
            "organization_email": email_clean,
            "onboarding_completed": True
        }).eq("user_id", user_id).execute()
    await db.run(_upd_profile)

    print(f"\n🎉 SUCCESS! Provisioned '{plan_name}' ({seats} seats, {total_credits} credits) for {email_clean}.")

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "22h51a73c6@cmrcet.ac.in"
    asyncio.run(assign_plan(email))
