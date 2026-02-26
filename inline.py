import os

results = []

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'game_matches' in content or 'Could not find the table' in content:
                        results.append(path)
            except:
                pass

print(results)