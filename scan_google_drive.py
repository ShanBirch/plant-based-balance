
import os
import pathlib
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Config
TOKEN_FILE = r"C:\Users\shann\Downloads\Trainerize_Videos\drive_token.json"
CLIENT_SECRETS_FILE = r"C:\Users\shann\Downloads\Trainerize_Videos\client_secrets.json"
TARGET_FOLDER_NAME = "Trainerize_Videos"
OUTPUT_FILE = "scanned_drive_videos.json"

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def get_service():
    creds = None
    # 1. Load existing
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except Exception:
            print("Existing settings invalid, re-authenticating...")

    # 2. Refresh or Login
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception:
                print("Token refresh failed. Re-initiating login...")
                creds = None
        
        if not creds:
            if not os.path.exists(CLIENT_SECRETS_FILE):
                print(f"ERROR: {CLIENT_SECRETS_FILE} not found!")
                return None
            
            print("Launching browser for authentication...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
            
            # Save new token
            with open(TOKEN_FILE, 'w') as token:
                token.write(creds.to_json())

    return build('drive', 'v3', credentials=creds)

def main():
    print("Authenticating...")
    service = get_service()
    
    # 1. Find the folder
    print(f"Searching for folder '{TARGET_FOLDER_NAME}'...")
    query = f"name = '{TARGET_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    results = service.files().list(q=query, fields="files(id, name, parents)").execute()
    folders = results.get('files', [])
    
    if not folders:
        print("Folder not found.")
        return
    
    # If multiple, assume the one inside another folder (nested) or just pick the one with most items?
    # For now, pick the first one and check it.
    folder_id = folders[0]['id']
    print(f"Found folder ID: {folder_id}")
    
    # 2. List files
    print("Listing files (this may take a moment)...")
    videos = {}
    page_token = None
    count = 0
    
    while True:
        q = f"'{folder_id}' in parents and mimeType contains 'video/' and trashed = false"
        results = service.files().list(
            q=q,
            pageSize=1000,
            fields="nextPageToken, files(id, name)",
            pageToken=page_token
        ).execute()
        
        items = results.get('files', [])
        for item in items:
            # Clean name (remove extension)
            name = item['name']
            if name.lower().endswith('.mp4'):
                name = name[:-4]
            elif name.lower().endswith('.mov'):
                name = name[:-4]
                
            # Construct preview URL
            url = f"https://drive.google.com/file/d/{item['id']}/preview"
            videos[name] = url
            count += 1
            
        page_token = results.get('nextPageToken')
        print(f"Scanned {count} files so far...")
        if not page_token:
            break
            
    print(f"Total videos found: {count}")
    
    # 3. Save
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(videos, f, indent=2)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
