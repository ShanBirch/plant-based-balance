with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('><', '>\n<')
with open('dashboard_fmt.html', 'w', encoding='utf-8') as f:
    f.write(text)
