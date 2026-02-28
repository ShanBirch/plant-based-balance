import os
target = "Meal Insight".lower()
found_files = []
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        if file.endswith(('.js', '.html', '.ts', '.md', '.sql', '.css', '.txt')):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read().lower()
                    if target in content:
                        found_files.append(os.path.join(root, file))
            except Exception:
                pass
                
with open('found_target.txt', 'w') as f:
    f.write('\n'.join(found_files))
