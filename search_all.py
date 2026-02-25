import os
import re

matches = []

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'send_challenge' in content.lower() or 'game_matches' in content.lower() or 'game_moves' in content.lower() or 'send challenge' in content.lower():
                        matches.append(path)
            except:
                pass

with open('found_files.txt', 'w') as f:
    f.write('\n'.join(matches))