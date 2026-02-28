import os, re
target1 = re.compile(b'workouttrend', re.IGNORECASE)
target2 = re.compile(b'mealtip', re.IGNORECASE)
target3 = re.compile(b'meal insight', re.IGNORECASE)
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        if file.endswith(('.js', '.html', '.ts', '.css')):
            try:
                with open(os.path.join(root, file), 'rb') as f:
                    content = f.read()
                    if target1.search(content) or target2.search(content) or target3.search(content):
                        print(f"FOUND IN {os.path.join(root, file)}")
            except: pass
