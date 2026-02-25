import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f.readlines()):
        if 'handleLogout' in line:
            print(f"Line {i}: {line.strip()}")
