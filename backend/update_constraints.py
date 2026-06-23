import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

sql = """
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'starter', 'growth', 'scale', 'enterprise', 'professional'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_subscription_plan;
ALTER TABLE public.profiles ADD CONSTRAINT valid_subscription_plan CHECK (subscription_plan IN ('free', 'starter', 'growth', 'scale', 'enterprise', 'professional'));
"""

res = supabase.rpc("run_sql", {"query": sql}).execute()
print("Constraints updated:", res.data)
