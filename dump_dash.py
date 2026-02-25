with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

with open('dash_dump.txt', 'w', encoding='utf-8') as f:
    f.write(str(len(text)))