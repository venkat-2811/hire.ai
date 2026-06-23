import sqlite3

conn = sqlite3.connect('local_db.sqlite3')
cur = conn.cursor()
cur.execute("SELECT user_id, subscription_plan FROM profiles WHERE user_id IN ('user_39pzPSlCnNtQdxV5H9ByKm9Ofsk', 'user_3DvWIyhFOmEDopxWyYKMl6jfn0z')")
print(cur.fetchall())
