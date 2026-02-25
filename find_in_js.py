import os

files_to_check = [
    'js/dashboard/dashboard-script-1.js',
    'js/dashboard/dashboard-script-2.js',
    'js/dashboard/dashboard-script-3.js',
    'js/dashboard/dashboard-script-4.js',
    'js/dashboard/dashboard-script-5.js',
    'js/dashboard/dashboard-script-6.js',
    'js/dashboard/dashboard-script-7.js',
    'js/dashboard/dashboard-script-8.js',
    'js/dashboard/dashboard-script-9.js',
    'js/dashboard/dashboard-script-10.js',
    'js/dashboard/dashboard-script-11.js',
    'js/dashboard/dashboard-script-12.js',
    'js/dashboard/dashboard-script-13.js',
    'js/dashboard/dashboard-script-14.js',
    'js/dashboard/dashboard-script-15.js',
    'js/dashboard/dashboard-script-16.js',
]

with open('dash_out.txt', 'w') as out:
    for root, dirs, files in os.walk('js/dashboard'):
        for file in files:
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                c = f.read()
                if 'challenge' in c.lower() or 'game' in c.lower():
                    out.write(path + '\n')
