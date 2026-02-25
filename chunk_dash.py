import os

def chunk_file():
    with open('dashboard.html', 'r', encoding='utf-8') as f:
        content = f.read()

    chunk_size = 50000
    for i in range(0, len(content), chunk_size):
        chunk = content[i:i+chunk_size]
        with open(f'dash_chunk_{i//chunk_size}.txt', 'w', encoding='utf-8') as out:
            out.write(chunk)

if __name__ == '__main__':
    chunk_file()