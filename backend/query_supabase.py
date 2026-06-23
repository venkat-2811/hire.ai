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

response = supabase.table("profiles").select("user_id, subscription_plan").in_("user_id", ["user_39pzPSlCnNtQdxV5H9ByKm9Ofsk", "user_3DvWIyhFOmEDopxWyYKMl6jfn0z"]).execute()
print(response.data)
