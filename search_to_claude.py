import os
terms = ['checkAndShowMealTipCard', 'workoutTrendCardDismissedDate', 'checkAndShowWorkoutTrendCard']
out = []
for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        filepath = os.path.join(root, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                for term in terms:
                    if term in content:
                        out.append(f"Found {term} in {filepath}")
        except:
            pass

with open('CLAUDE.md', 'a') as f:
    f.write('\n\n# Search Results\n')
    f.write('\n'.join(out))
