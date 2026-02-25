import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'settings-item' in line.lower() and 'onclick' in line.lower():
            print(f"Line {i}: {line.strip()}")
