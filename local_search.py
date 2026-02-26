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
                    if 'Failed to send challenge' in content or 'game_matches' in content:
                        print(f"FOUND: {path}")
            except Exception as e:
                pass