import requests

url = "http://127.0.0.1:8000/api/v2/assessments/test_session_id_123/screenshot"
files = {'file': ('latest.jpg', b'dummy_image_content', 'image/jpeg')}

response = requests.post(url, files=files)
print(response.status_code, response.text)
