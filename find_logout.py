import os
import glob
for f in glob.glob("*.html") + glob.glob("js/**/*.js", recursive=True):
    try:
        content = open(f, 'r').read()
        if 'signOut()' in content or 'logout' in content.lower():
            print(f)
    except:
        pass
