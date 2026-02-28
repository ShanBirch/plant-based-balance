import os, re
target = re.compile(b'daily-weigh-in-card', re.IGNORECASE)
with open('dashboard.html', 'rb') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if target.search(line):
        print(f"dashboard.html:{i}: {line.strip()}")
        # print 5 lines before and after
        for j in range(max(0, i-10), min(len(lines), i+10)):
            print(f"{j}: {lines[j].strip()}")
