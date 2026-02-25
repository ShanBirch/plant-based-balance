import re

with open('dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()
    
# Extract all src attributes from script tags
scripts = re.findall(r'<script[^>]+src=["\'](.*?)["\']', html)
print(scripts)

for s in scripts:
    if s.startswith('js/') or s.startswith('lib/'):
        # strip query params if any
        s = s.split('?')[0]
        try:
            with open(s, 'r', encoding='utf-8') as sf:
                c = sf.read()
                if 'challenge' in c.lower() or 'game' in c.lower():
                    print(f"FOUND IN {s}")
        except:
            pass