import os
with open('ls.txt', 'w') as f:
    f.write('\n'.join(os.listdir('.')))
