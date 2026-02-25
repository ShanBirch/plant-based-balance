import os

matches = []

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'Failed to send challenge' in content or 'game_matches' in content:
                        matches.append(os.path.join(root, file))
            except:
                pass

with open('search_js.txt', 'w') as f:
    f.write('\n'.join(matches))