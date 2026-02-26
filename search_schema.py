import os

matches = []

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'Could not find the table' in content or 'game_matches' in content:
                        matches.append(os.path.join(root, file))
            except:
                pass

with open('schema_search.txt', 'w') as f:
    f.write('\n'.join(matches))