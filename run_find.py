import os
import glob

matches = []
for file in glob.glob("**/*.html", recursive=True) + glob.glob("**/*.js", recursive=True):
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'signOut' in content or 'logout' in content.lower():
                matches.append(file)
    except:
        pass

with open('find_results.txt', 'w') as f:
    for m in matches:
        f.write(m + "\n")
