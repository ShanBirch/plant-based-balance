import os
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
    if 'signOut' in html:
        print("Found sign out in index.html")
