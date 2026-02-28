import os
files = []
for root, _, fs in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for f in fs:
        if f.endswith('.js') and 'dashboard-script' in f:
            files.append(os.path.join(root, f))
with open('dash_scripts.txt', 'w') as f:
    f.write('\n'.join(files))
