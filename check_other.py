import os
import glob
for f in glob.glob("**/*.html", recursive=True):
    if f == 'dashboard.html': continue
    try:
        lines = open(f, 'r', encoding='utf-8').readlines()
        for i, line in enumerate(lines):
            if 'signout' in line.lower().replace(" ", ""):
                print(f"{f} Line {i}: {line.strip()}")
    except:
        pass
