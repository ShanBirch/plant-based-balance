import os
import json

found_in = []
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.js') or f.endswith('.html'):
            try:
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'signOut' in content:
                        found_in.append(path)
            except Exception as e:
                pass

with open('signout_search.json', 'w', encoding='utf-8') as f:
    json.dump(found_in, f)
