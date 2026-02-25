import os
import re

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()
    
with open('out_dash.txt', 'w', encoding='utf-8') as out:
    for m in re.finditer(r'.{0,100}failed to send challenge.{0,100}', text, re.IGNORECASE | re.DOTALL):
        out.write(m.group(0) + '\n\n')
    for m in re.finditer(r'.{0,100}send challenge.{0,100}', text, re.IGNORECASE | re.DOTALL):
        out.write(m.group(0) + '\n\n')
