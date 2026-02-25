import os
print(os.path.getsize('dashboard.html'))
with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()
    print(len(content))
    print(content[:500])
