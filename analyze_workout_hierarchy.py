import re
import json

def analyze_full_structure(filename, variable_name):
    print(f"\n--- Analyzing {filename} ---")
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"File not found: {filename}")
        return

    # Extract the JS object string roughly
    # This is a bit hacky because it's JS, not JSON.
    # We'll try to parse the structure using regex indentation for a summary.
    
    lines = content.split('\n')
    current_category = None
    current_subcategory = None
    
    structure = {}
    
    for line in lines:
        # Category: "key": {
        cat_match = re.match(r'^\s{2}"([\w\s-]+)": \{', line)
        if cat_match:
            current_category = cat_match.group(1)
            structure[current_category] = []
            current_subcategory = None
            continue
            
        # Subcategory: "key": {  (usually 6 spaces indent in the file structure I saw)
        sub_match = re.match(r'^\s{6}"([\w\s-]+)": \{', line)
        if sub_match and current_category:
            sub = sub_match.group(1)
            structure[current_category].append(sub)
    
    for cat, subs in structure.items():
        print(f"Category: {cat}")
        for sub in subs:
            print(f"  - {sub}")

analyze_full_structure('workout_library.js', 'WORKOUT_LIBRARY')
analyze_full_structure('workout_library_extended.js', 'WORKOUT_LIBRARY_EXTENDED')
