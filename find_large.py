import os
for root, dirs, files in os.walk('.'):
    for name in files:
        if name.endswith('.html'):
            filepath = os.path.join(root, name)
            size = os.path.getsize(filepath)
            if size > 10000: # larger than 10KB
                print(filepath, size)
