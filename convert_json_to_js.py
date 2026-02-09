
import json
import os

INPUT_FILE = "scanned_drive_videos.json"
OUTPUT_FILE = "exercise_videos.js"

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found!")
        return

    print(f"Reading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r') as f:
        videos = json.load(f)
    
    print(f"Found {len(videos)} videos.")
    
    # Format as JS
    js_content = "const EXERCISE_VIDEOS = " + json.dumps(videos, indent=2) + ";"
    
    print(f"Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        f.write(js_content)
        
    print("Done!")

if __name__ == '__main__':
    main()
