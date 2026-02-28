import subprocess, sys
res = subprocess.run(['git', 'log', '--name-status', '-n', '5'], capture_output=True, text=True)
with open('recent.txt', 'w') as f:
    f.write(res.stdout + "HELLO")
