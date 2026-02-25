import os
with open('lib/auth-guard.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'out' in line.lower() and ('log' in line.lower() or 'sign' in line.lower()):
            print(f"Line {i}: {line.strip()}")
