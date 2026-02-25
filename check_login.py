import os
with open('login.html', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f.readlines()):
        if 'signOut' in line:
            print(f"Line {i}: {line.strip()}")
