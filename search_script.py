import os
import glob

result = ""
for root, dirs, files in os.walk('.'):
    for f in files:
        if f.endswith('.js') or f.endswith('.html'):
            try:
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                    if 'loadProfileData' in content:
                        result += f"{path}\n"
                        # extract snippet
                        idx = content.find('loadProfileData')
                        result += content[max(0, idx-100):min(len(content), idx+500)] + "\n\n"
            except Exception as e:
                pass

with open('search_result.txt', 'w', encoding='utf-8') as f:
    f.write(result)
