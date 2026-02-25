import re
import os

def check():
    out = []
    
    # Also check the script block in dashboard.html itself
    try:
        with open('dashboard.html', 'r', encoding='utf-8') as f:
            text = f.read()
            if 'send challenge' in text.lower():
                out.append("dashboard.html")
    except:
        pass
        
    for root, _, files in os.walk('.'):
        for file in files:
            if file.endswith('.js') or file.endswith('.html'):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        text = f.read()
                        if 'failed to send challenge' in text.lower():
                            out.append(f"FOUND: {path}")
                except:
                    pass

    with open('where_is_it.txt', 'w') as f:
        f.write('\n'.join(out))

if __name__ == '__main__':
    check()