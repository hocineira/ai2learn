import requests
import json

BACKEND_URL = "https://guac-edu-platform.preview.emergentagent.com/api"

# Get admin token
admin_login = {"username": "admin", "password": "admin123"}
admin_response = requests.post(f"{BACKEND_URL}/auth/login", json=admin_login, timeout=15)
admin_token = admin_response.json()["token"]
admin_headers = {"Authorization": f"Bearer {admin_token}"}

# Test submissions endpoint
submissions_response = requests.get(f"{BACKEND_URL}/submissions", headers=admin_headers, timeout=15)
print(f"Submissions status: {submissions_response.status_code}")
print(f"Submissions data: {submissions_response.json()}")

# Test result CSV endpoint with invalid ID
invalid_id = "test-invalid-submission-id"
result_csv_response = requests.get(f"{BACKEND_URL}/export/result-csv/{invalid_id}", headers=admin_headers, timeout=15)
print(f"Result CSV status: {result_csv_response.status_code}")
print(f"Result CSV content: {result_csv_response.text}")