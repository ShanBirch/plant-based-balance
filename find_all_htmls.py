import os
with open('all_htmls.txt', 'w') as f:
    for root, _, files in os.walk('.'):
        if '.git' in root or 'node_modules' in root: continue
        for file in files:
            if file.endswith('.html'):
                f.write(os.path.join(root, file) + '\n')
