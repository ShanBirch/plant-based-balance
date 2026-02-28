import os
size = os.path.getsize('dashboard.html')
with open('size.txt', 'w') as f:
    f.write(str(size))
