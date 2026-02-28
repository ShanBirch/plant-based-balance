import os
target = 'mealTipCardDismissedDate'
found = []
for root, _, files in os.walk('.'):
    if '.git' in root: continue
    for file in files:
        if file.endswith(('.js', '.html', '.ts', '.py')):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if target in content:
                        found.append(os.path.join(root, file))
            except: pass
with open('found_meal.txt', 'w') as f:
    f.write('\n'.join(found))
