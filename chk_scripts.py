import os
import glob
for f in glob.glob("js/dashboard/*.js"):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'signOut' in content or 'logout' in content.lower() or 'log out' in content.lower():
            print(f)
    except:
        pass
