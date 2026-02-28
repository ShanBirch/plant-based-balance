import os
with open('large_html.txt', 'w') as f:
    for root, dirs, files in os.walk('.'):
        for name in files:
            if name.endswith('.html'):
                filepath = os.path.join(root, name)
                size = os.path.getsize(filepath)
                if size > 5000:
                    f.write(f"{filepath} {size}\n")
