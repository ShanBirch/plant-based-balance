import re

with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('PICK A GAME')
if idx != -1:
    with open('games_modal.txt', 'w', encoding='utf-8') as f:
        f.write(text[max(0, idx-500) : min(len(text), idx+3000)])
else:
    with open('games_modal.txt', 'w', encoding='utf-8') as f:
        f.write('NOT FOUND')