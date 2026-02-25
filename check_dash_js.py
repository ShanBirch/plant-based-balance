import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f.readlines()):
        if 'function' in line and ('logout' in line.lower() or 'signout' in line.lower()):
            print(f"Line {i}: {line.strip()}")
