import os

def find_game_matches():
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.html') or f.endswith('.js'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                        if 'game_matches' in content:
                            print(f"Found in: {path}")
                except Exception as e:
                    pass

if __name__ == '__main__':
    find_game_matches()