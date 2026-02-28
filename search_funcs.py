import os, re
target = "checkAndShowMealTipCard"
for root, _, files in os.walk('.'):
    if '.git' in root: continue
    for file in files:
        if file.endswith('.js'):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if target in content:
                        print(f"FOUND IN {os.path.join(root, file)}")
            except: pass
