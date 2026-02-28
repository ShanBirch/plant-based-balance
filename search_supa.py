import os, re
target = re.compile(b'from', re.IGNORECASE)
with open('lib/supabase.js', 'rb') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if target.search(line):
        print(f"lib/supabase.js:{i}: {line.strip()}")
