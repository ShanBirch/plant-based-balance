import re
import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'out' in line.lower() or 'sign' in line.lower():
            print(f"{i}: {line.strip()}")
