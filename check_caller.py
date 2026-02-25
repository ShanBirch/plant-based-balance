import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'signout' in line.lower().replace(" ", ""):
            print(f"Line {i}: {line.strip()}")
