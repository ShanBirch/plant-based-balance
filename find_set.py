import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'settings-item' in line.lower() and ('logout' in line.lower() or 'log out' in line.lower() or 'signout' in line.lower() or 'sign out' in line.lower() or 'authHelpers' in line):
            print(f"Line {i}: {line.strip()}")
