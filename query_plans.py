import asyncio
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.database import db

async def main():
    await db.connect()
    res = await db.run(lambda: db.client.from_('profiles').select('user_id, subscription_plan').in_('user_id', ['user_39pzPSlCnNtQdxV5H9ByKm9Ofsk', 'user_3DvWIyhFOmEDopxWyYKMl6jfn0z']).execute())
    print(res.data)

if __name__ == "__main__":
    asyncio.run(main())
