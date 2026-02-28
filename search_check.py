import os, re
target = re.compile(b'checkandshow', re.IGNORECASE)
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        if file.endswith(('.js', '.html', '.ts')):
            try:
                with open(os.path.join(root, file), 'rb') as f:
                    content = f.read()
                    if target.search(content):
                        print(f"FOUND IN {os.path.join(root, file)}")
            except: pass
