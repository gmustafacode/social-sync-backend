import requests
import json
import sys

url = "http://localhost:8000/api/analyze"
payload = {"batch_size": 2}

print(f"Testing {url} with {payload}...")

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("Response:")
        print(json.dumps(response.json(), indent=2))
    else:
        print("Error Response:")
        print(response.text)
except Exception as e:
    print(f"Connection Error: {e}")
    sys.exit(1)
