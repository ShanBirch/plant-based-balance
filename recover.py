import subprocess
subprocess.run(['git', 'fetch', 'origin'])
subprocess.run(['git', 'checkout', 'origin/main', '--', 'dashboard.html'])
