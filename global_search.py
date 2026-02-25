import os

with open('global_search.txt', 'w', encoding='utf-8') as out:
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.html') or file.endswith('.js'):
                try:
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        if 'Failed to send challenge' in f.read():
                            out.write(os.path.join(root, file) + '\n')
                except:
                    pass