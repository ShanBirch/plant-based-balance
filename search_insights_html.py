import os, re
target1 = b'insight'
target2 = b'trend'
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        if file.endswith('.js'):
            try:
                with open(os.path.join(root, file), 'rb') as f:
                    content = f.read().lower()
                    if target1 in content or target2 in content:
                        print(f"FOUND IN {os.path.join(root, file)}")
            except: pass
