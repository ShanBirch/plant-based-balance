import os
import sys
import json
import time
from b2sdk.v2 import *

KEY_ID = "0055c4034c6a45e0000000001"
APP_KEY = "K005rPzmGgPJnFwNycp12DCxs24Eer4"
BUCKET_NAME = "shannonsvideos"
LOCAL_FOLDER = r"C:\Users\shann\Downloads\Trainerize_Videos"
OUTPUT_JS = "exercise_videos.js"
LOG_FILE = "upload_log.txt"


def log(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode('ascii', 'replace').decode('ascii'))
    
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(msg + "\n")

def load_existing_map():
    if not os.path.exists(OUTPUT_JS):
        return {}
    try:
        with open(OUTPUT_JS, 'r', encoding='utf-8') as f:
            content = f.read()
            # extract JSON part
            if "const EXERCISE_VIDEOS = " in content:
                json_str = content.replace("const EXERCISE_VIDEOS = ", "").rstrip(";")
                return json.loads(json_str)
    except Exception as e:
        log(f"Error loading existing JS: {e}")
    return {}

def save_map(video_map):
    js_content = "const EXERCISE_VIDEOS = " + json.dumps(video_map, indent=2) + ";"
    with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
        f.write(js_content)

def main():
    log("Initializing B2 Upload Process...")
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    
    log("Authenticating...")
    try:
        b2_api.authorize_account("production", KEY_ID, APP_KEY)
        bucket = b2_api.get_bucket_by_name(BUCKET_NAME)
        log(f"Connected to bucket: {bucket.name}")
    except Exception as e:
        log(f"Auth Failed: {e}")
        return

    # Load current map to preserve data
    video_map = load_existing_map()
    log(f"Loaded {len(video_map)} existing entries in JS map.")

    # 1. List B2 Files (to skip uploads)
    log("Listing existing B2 files...")
    b2_files = set()
    download_url = b2_api.account_info.get_download_url()
    
    # We might have thousands, B2 ls yields generators
    count = 0
    for file_version, _ in bucket.ls():
        b2_files.add(file_version.file_name)
        count += 1
        if count % 500 == 0:
            log(f"Listed {count} files...")
    
    log(f"Found {len(b2_files)} existing files in bucket.")

    # 2. List Local Files
    if not os.path.exists(LOCAL_FOLDER):
        log(f"Error: Local {LOCAL_FOLDER} not found.")
        return
        
    local_files = [f for f in os.listdir(LOCAL_FOLDER) if f.lower().endswith(('.mp4', '.mov'))]
    log(f"Found {len(local_files)} local videos to process.")

    # 3. Process
    updates = 0
    for i, filename in enumerate(local_files):
        key_name = os.path.splitext(filename)[0]
        
        # B2 friendly URL
        import urllib.parse
        safe_filename = urllib.parse.quote(filename)
        public_url = f"{download_url}/file/{BUCKET_NAME}/{safe_filename}"
        
        # If already in B2
        if filename in b2_files:
            # Update map if needed
            if video_map.get(key_name) != public_url:
                video_map[key_name] = public_url
                updates += 1
        else:
            # Upload
            log(f"Uploading {i+1}/{len(local_files)}: {filename}...")
            try:
                local_path = os.path.join(LOCAL_FOLDER, filename)
                bucket.upload_local_file(local_path, filename)
                
                # Update map
                video_map[key_name] = public_url
                updates += 1
                b2_files.add(filename) # Mark as done
                
                # Save periodically
                if updates % 5 == 0:
                    save_map(video_map)
                    log(f"Saved progress ({updates} updates)")
                    
            except Exception as e:
                log(f"Failed to upload {filename}: {e}")

    # Final save
    save_map(video_map)
    log("Sync Complete. JS file updated.")

if __name__ == "__main__":
    main()
