import os

for root, _, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    if 'sendChallenge' in f.read():
                        print(os.path.join(root, file))
            except:
                pass