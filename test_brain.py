
import requests
import json
import os

API_KEY = "AIzaSyCu5U2fhK5gptQ-A959MdSaIUxz9XKQM-Q"
URL = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
print(f"Checking available models with key: {API_KEY[:5]}...")
response = requests.get(URL)
print(response.text)
exit()


payload = {
    "contents": [{
        "parts": [{"text": "Hello, are you online?"}]
    }]
}

try:
    print(f"Testing Gemini API with key: {API_KEY[:5]}...")
    response = requests.post(URL, headers={"Content-Type": "application/json"}, json=payload)
    
    if response.status_code == 200:
        print("\nSUCCESS! The AI is online and responding.")
        data = response.json()
        print("Response:", data.get('candidates')[0].get('content').get('parts')[0].get('text'))
    else:
        print(f"\nFAILURE. Status Code: {response.status_code}")
        print("Error:", response.text)

except Exception as e:
    print(f"\nERROR: {e}")
