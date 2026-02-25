import os
import glob
for f in glob.glob("**/*.html", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'authHelpers.signOut' in content:
            print(f)
    except:
        pass
for f in glob.glob("**/*.js", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'authHelpers.signOut' in content:
            print(f)
    except:
        pass
