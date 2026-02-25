import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()
    if 'signOut' in html:
        print("Found signout in dashboard")
