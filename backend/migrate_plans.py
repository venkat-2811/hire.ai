import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Missing SUPABASE credentials")
    exit(1)

supabase: Client = create_client(url, key)

# Update profiles
res1 = supabase.table("profiles").update({"subscription_plan": "scale"}).eq("subscription_plan", "enterprise").execute()
res2 = supabase.table("profiles").update({"subscription_plan": "growth"}).eq("subscription_plan", "professional").execute()

# Update subscriptions
res3 = supabase.table("subscriptions").update({"plan": "scale"}).eq("plan", "enterprise").execute()
res4 = supabase.table("subscriptions").update({"plan": "growth"}).eq("plan", "professional").execute()

print(f"Updated {len(res1.data)} enterprise profiles to scale")
print(f"Updated {len(res2.data)} professional profiles to growth")
print(f"Updated {len(res3.data)} enterprise subscriptions to scale")
print(f"Updated {len(res4.data)} professional subscriptions to growth")
