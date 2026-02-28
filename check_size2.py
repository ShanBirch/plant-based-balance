import os
size = os.path.getsize('dashboard.html')
print(f"dashboard.html size: {size}")
with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read(200)
print(f"Content start: {text}")
