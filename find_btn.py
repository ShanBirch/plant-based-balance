import os
import glob
for f in glob.glob("**/*.html", recursive=True) + glob.glob("**/*.js", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'log out' in content.lower() or 'logout' in content.lower() or 'sign out' in content.lower() or 'signout' in content.lower():
            print(f)
    except:
        pass
