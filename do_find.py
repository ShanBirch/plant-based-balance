import os
import glob

with open('search_out.txt', 'w', encoding='utf-8') as out:
    for f in glob.glob("**/*.html", recursive=True) + glob.glob("**/*.js", recursive=True):
        try:
            content = open(f, 'r', encoding='utf-8').read()
            if 'signOut' in content or 'logout' in content.lower() or 'log out' in content.lower():
                out.write(f + "\n")
        except:
            pass
