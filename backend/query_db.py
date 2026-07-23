import asyncio
from dotenv import load_dotenv
load_dotenv('.env')
from app.services.db.supabase_service import get_db_admin_service

async def main():
    db = get_db_admin_service()
    res = await db.run(lambda: db.client.from_('companies').update({"name": "FNDORA"}).eq("id", "dff113ad-3b20-40d5-9ddc-d65277ff69f4").execute())
    print("Update result:", getattr(res, "data", []))

if __name__ == "__main__":
    asyncio.run(main())
