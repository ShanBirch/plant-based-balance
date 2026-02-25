import os

def search_in_dir(directory, search_term):
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.js') or file.endswith('.html'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            if search_term in line:
                                print(f"Found in {filepath}:{i+1}: {line.strip()}")
                except Exception as e:
                    pass

search_in_dir('.', 'Evening Check-In')
