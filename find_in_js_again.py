import os
import glob

for js_file in glob.glob('js/dashboard/*.js'):
    with open(js_file, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'sendChallenge' in content or 'Could not find the table' in content or 'game_matches' in content:
            print(f"FOUND IN {js_file}")