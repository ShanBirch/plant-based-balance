import os
import glob
for f in glob.glob("**/*.js", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'function' in content and 'logout' in content.lower():
            print(f)
    except:
        pass
