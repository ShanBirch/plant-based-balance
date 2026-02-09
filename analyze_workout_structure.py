import re

def analyze_keys(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    top_level_keys = []
    current_key = None
    
    # Simple state machine or regex
    # We look for "key": {  at start of line (with indent) inside the main object
    
    # We assume the file defines a const at the top
    # const WORKOUT_LIBRARY = {
    
    print(f"--- Analyzing {filename} ---")
    
    for line in lines:
        # Regex for top level keys: "key": {
        # assuming 2 spaces indentation
        match = re.match(r'^\s{2}"([\w\s-]+)": \{', line)
        if match:
            key = match.group(1)
            print(f"Found Category: {key}")
            # we could also look for subcategories if we wanted
            
analyze_keys('workout_library.js')
analyze_keys('workout_library_extended.js')
