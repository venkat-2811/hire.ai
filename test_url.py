import requests

url = "https://upssvrvshcqwcuyrkehj.supabase.co/storage/v1/object/public/session-screenshots/assessment/test_session_id_123/latest.jpg"
response = requests.get(url)
print(response.status_code)
print(response.headers.get("Content-Type"))
