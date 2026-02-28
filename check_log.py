import subprocess
out = subprocess.run(['git', 'log', '-n', '2', '--', 'dashboard.html'], capture_output=True, text=True)
with open('dash_log.txt', 'w') as f: f.write(out.stdout)
