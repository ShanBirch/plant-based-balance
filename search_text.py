import os

def search_text():
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.html') or f.endswith('.js'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                        if 'PICK A GAME' in content or 'OR CHALLENGE A FRIEND' in content or 'game_matches' in content:
                            print(f"Found in: {path}")
                except Exception as e:
                    pass

if __name__ == '__main__':
    search_text()