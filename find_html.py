import os
import glob
for f in glob.glob("**/*.html", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'log out' in content.lower():
            print(f)
    except:
        pass
