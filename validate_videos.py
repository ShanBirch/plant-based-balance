import json
import requests
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT_FILE = "exercise_videos.js"
OUTPUT_FILE = "exercise_videos.js"

def load_videos():
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
        if "const EXERCISE_VIDEOS = " in content:
            json_str = content.replace("const EXERCISE_VIDEOS = ", "").rstrip(";")
            return json.loads(json_str)
    return {}

def check_url(item):
    name, url = item
    try:
        # Just check headers, don't download the whole video
        response = requests.head(url, timeout=10, allow_redirects=True)
        if response.status_code == 200:
            return (name, url, True)
        else:
            print(f"❌ BROKEN ({response.status_code}): {name}")
            return (name, url, False)
    except Exception as e:
        print(f"❌ ERROR: {name} - {e}")
        return (name, url, False)

def main():
    print("Loading video map...")
    videos = load_videos()
    print(f"Found {len(videos)} videos to check.\n")
    
    valid_videos = {}
    broken_videos = []
    
    # Use thread pool for faster checking
    print("Checking URLs (this may take a few minutes)...")
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(check_url, item): item for item in videos.items()}
        
        checked = 0
        for future in as_completed(futures):
            name, url, is_valid = future.result()
            checked += 1
            
            if is_valid:
                valid_videos[name] = url
            else:
                broken_videos.append(name)
            
            if checked % 100 == 0:
                print(f"Progress: {checked}/{len(videos)} checked, {len(broken_videos)} broken so far...")
    
    print(f"\n{'='*50}")
    print(f"RESULTS:")
    print(f"  Total videos: {len(videos)}")
    print(f"  Valid videos: {len(valid_videos)}")
    print(f"  Broken videos: {len(broken_videos)}")
    print(f"{'='*50}\n")
    
    if broken_videos:
        print("BROKEN VIDEOS REMOVED:")
        for name in sorted(broken_videos):
            print(f"  - {name}")
        
        # Save clean version
        js_content = "const EXERCISE_VIDEOS = " + json.dumps(valid_videos, indent=2) + ";"
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(js_content)
        print(f"\n✅ Cleaned file saved with {len(valid_videos)} valid videos.")
    else:
        print("✅ All videos are valid! No changes needed.")

if __name__ == "__main__":
    main()
