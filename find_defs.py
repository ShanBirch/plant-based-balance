import os
out = []
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for f in files:
        if f.endswith(('.js', '.html')):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'checkAndShowMealTipCard' in content:
                        out.append("FOUND: " + path)
            except: pass
with open('find_defs.txt', 'w') as f: f.write('\n'.join(out))
