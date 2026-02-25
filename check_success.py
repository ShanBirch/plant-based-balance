import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    if 'handleLogout' in f.read():
        print("Success")
