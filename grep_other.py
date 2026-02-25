import os
import glob
for f in glob.glob("**/*.html", recursive=True):
    if f == 'dashboard.html' or f == 'login.html': continue
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'signOut' in content:
            print(f"Found in {f}")
    except:
        pass
