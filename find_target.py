import os

with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()
    
# We want to find the exact function that contains "failed to send challenge" or "PICK A GAME"
idx = text.find('failed to send challenge')
if idx == -1:
    idx = text.find('PICK A GAME')
    
if idx != -1:
    start = max(0, idx - 1000)
    end = min(len(text), idx + 2000)
    with open('target_code.txt', 'w', encoding='utf-8') as f:
        f.write(text[start:end])
else:
    with open('target_code.txt', 'w', encoding='utf-8') as f:
        f.write("NOT FOUND")