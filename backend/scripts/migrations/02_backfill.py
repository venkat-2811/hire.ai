"""
Migration script: Populate credit_transactions ledger baseline and backfill company_id on jobs/candidates.

Run ONCE on VPS after applying 01_ledger.sql.
"""
import os, sys
sys.path.insert(0, '/root/hire.ai/backend')

env_txt = open('/root/hire.ai/backend/.env').read()
import re
for line in env_txt.splitlines():
    if '=' in line and not line.startswith('#'):
        k, _, v = line.partition('=')
        os.environ.setdefault(k.strip(), v.strip())

from supabase import create_client
from datetime import datetime, timezone
import uuid

url = os.environ['SUPABASE_URL']
key = os.environ['SUPABASE_SERVICE_KEY']
client = create_client(url, key)
now = datetime.now(timezone.utc).isoformat()

print("=== Migration: Ledger Baseline + company_id Backfill ===")

# ── 1. Baseline individual credits_consumed → credit_transactions ──────────────
print("\n[1] Baselining individual recruiter usage into credit_transactions...")
try:
    profiles = client.from_('profiles').select('user_id, candidates_consumed').execute()
    for p in (profiles.data or []):
        uid = p.get('user_id')
        consumed = float(p.get('candidates_consumed') or 0)
        if consumed > 0 and uid:
            # Check if baseline already exists
            existing = client.from_('credit_transactions').select('id').eq('user_id', uid).eq('action_type', 'baseline_sync').execute()
            if not (existing.data):
                client.from_('credit_transactions').insert({
                    'user_id': uid,
                    'company_id': None,
                    'action_type': 'baseline_sync',
                    'amount': consumed,
                    'metadata': {'note': 'Initial migration baseline from profiles.candidates_consumed'},
                }).execute()
                print(f"  ✓ Baseline for individual user {uid}: {consumed} credits")
except Exception as e:
    print(f"  ✗ Individual baseline failed: {e}")

# ── 2. Baseline company member credits_consumed → credit_transactions ──────────
print("\n[2] Baselining company member usage into credit_transactions...")
try:
    members = client.from_('company_members').select('id, user_id, company_id, credits_consumed, status').eq('status', 'active').execute()
    for m in (members.data or []):
        uid = m.get('user_id')
        cid = m.get('company_id')
        consumed = float(m.get('credits_consumed') or 0)
        if consumed > 0 and uid and cid:
            existing = client.from_('credit_transactions').select('id').eq('user_id', uid).eq('company_id', cid).eq('action_type', 'baseline_sync').execute()
            if not (existing.data):
                client.from_('credit_transactions').insert({
                    'user_id': uid,
                    'company_id': cid,
                    'action_type': 'baseline_sync',
                    'amount': consumed,
                    'metadata': {'note': 'Initial migration baseline from company_members.credits_consumed'},
                }).execute()
                print(f"  ✓ Baseline for company member {uid} (company={cid}): {consumed} credits")
except Exception as e:
    print(f"  ✗ Company baseline failed: {e}")

# ── 3. Backfill company_id on job_descriptions ────────────────────────────────────
print("\n[3] Backfilling company_id on job_descriptions...")
try:
    # Get all active company members
    members = client.from_('company_members').select('user_id, company_id').eq('status', 'active').execute()
    uid_to_company = {m['user_id']: m['company_id'] for m in (members.data or [])}
    
    # Get all job_descriptions without company_id created by company members
    # Uses the correct column name 'created_by'
    jobs = client.from_('job_descriptions').select('id, created_by').is_('company_id', 'null').execute()
    updated = 0
    for j in (jobs.data or []):
        rid = j.get('created_by')
        if rid and rid in uid_to_company:
            client.from_('job_descriptions').update({'company_id': uid_to_company[rid]}).eq('id', j['id']).execute()
            updated += 1
    print(f"  ✓ Backfilled {updated} job_descriptions with company_id")
except Exception as e:
    print(f"  ✗ Jobs backfill failed: {e}")

# ── 4. Backfill company_id on candidates ──────────────────────────────────────────────
print("\n[4] Backfilling company_id on candidates...")
try:
    # candidates.user_id = the recruiter who created them
    cands = client.from_('candidates').select('id, user_id').is_('company_id', 'null').execute()
    updated = 0
    for c in (cands.data or []):
        uid = c.get('user_id')
        if uid and uid in uid_to_company:
            client.from_('candidates').update({'company_id': uid_to_company[uid]}).eq('id', c['id']).execute()
            updated += 1
    print(f"  ✓ Backfilled {updated} candidate records with company_id")
except Exception as e:
    print(f"  ✗ Candidates backfill failed: {e}")

print("\n=== Migration complete ===")
