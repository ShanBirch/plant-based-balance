import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()
    print("Logout button exists:", "Log Out" in html or "Logout" in html)
