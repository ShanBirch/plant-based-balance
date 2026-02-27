import os

for root, _, files in os.walk("."):
    for file in files:
        if file.endswith(('.js', '.html', '.json', '.sql', '.md', '.ts', '.tsx')):
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'epigenetic' in content.lower():
                        print(f"Found in {os.path.join(root, file)}")
            except Exception:
                pass
