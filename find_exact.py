import os
import sys

terms = ['checkAndShowMealTipCard', 'workoutTrendCardDismissedDate', 'Meal Insight']

for root, _, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root: continue
    for file in files:
        filepath = os.path.join(root, file)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                for term in terms:
                    if term in content:
                        print(f"Found {term} in {filepath}")
        except:
            pass
