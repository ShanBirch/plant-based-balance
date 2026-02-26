import os

with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'OR CHALLENGE A FRIEND' in line or 'sendChallenge' in line or 'Failed to send challenge' in line:
            print(f"Line {i}: {line.strip()}")