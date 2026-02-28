import os, re
target1 = b'fetch('
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        if file.endswith(('.js', '.ts', '.html')):
            try:
                with open(os.path.join(root, file), 'rb') as f:
                    lines = f.readlines()
                    for i, line in enumerate(lines):
                        if target1 in line and b'/' in line:
                            print(f"{os.path.join(root, file)}:{i}: {line.strip()}")
            except: pass
