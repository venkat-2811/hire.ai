import asyncio
from dotenv import load_dotenv
load_dotenv('.env')
from app.services.db.supabase_service import get_db_admin_service

async def main():
    db = get_db_admin_service()
    res = await db.run(lambda: db.client.from_('companies').select('*').execute())
    for co in getattr(res, "data", []):
        print(f"Company: '{co['name']}' (ID: {co['id']})")

if __name__ == "__main__":
    asyncio.run(main())
