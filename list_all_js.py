import os
files = []
for root, _, fs in os.walk('js/dashboard'):
    files.extend([os.path.join(root, f) for f in fs if f.endswith('.js')])

with open('all_js.txt', 'w') as f:
    f.write('\n'.join(files))
