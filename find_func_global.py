import os
import glob
for f in glob.glob("**/*.html", recursive=True):
    try:
        lines = open(f, 'r', encoding='utf-8').readlines()
        for i, line in enumerate(lines):
            if 'function handleLogout' in line or 'function logout' in line:
                print(f"{f} Line {i}: {line.strip()}")
    except:
        pass
for f in glob.glob("**/*.js", recursive=True):
    try:
        lines = open(f, 'r', encoding='utf-8').readlines()
        for i, line in enumerate(lines):
            if 'function handleLogout' in line or 'function logout' in line or 'window.handleLogout =' in line:
                print(f"{f} Line {i}: {line.strip()}")
    except:
        pass
