import os
print(os.path.getsize('login.html'))
with open('login.html', 'r', encoding='utf-8') as f:
    s = f.read()
    if 'signOut' in s:
        print("Found in login")
