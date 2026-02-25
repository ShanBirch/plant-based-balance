import os
import glob
for f in glob.glob("**/*.js", recursive=True):
    try:
        lines = open(f, 'r', encoding='utf-8').readlines()
        for i, line in enumerate(lines):
            if 'logout' in line.lower():
                print(f"{f} Line {i}: {line.strip()}")
    except:
        pass
