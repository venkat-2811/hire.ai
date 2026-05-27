"""Quick diagnostic: check invite_delivery status in recent AI interview sessions."""
import json, os, sys

# Manually parse .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
res = sb.from_("ai_interview_sessions").select("id,created_at,proctoring_data").order("created_at", desc=True).limit(5).execute()
for r in res.data:
    pd = r.get("proctoring_data") or {}
    inv = pd.get("invite_delivery") or {}
    print(f"Session {r['id'][:8]}  created={r.get('created_at','')}  invite={json.dumps(inv)}")
