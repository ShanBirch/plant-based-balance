import os

def search():
    with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
        print(f"dashboard.html length: {len(content)}")
        if 'PICK A GAME' in content:
            print("Found in dashboard.html")
            
        # extract around it
        idx = content.find('PICK A GAME')
        if idx != -1:
            start = max(0, idx - 500)
            end = min(len(content), idx + 2000)
            with open('dashboard_extract.txt', 'w', encoding='utf-8') as out:
                out.write(content[start:end])

if __name__ == '__main__':
    search()