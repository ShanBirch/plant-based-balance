import subprocess, sys
res = subprocess.run(['git', 'diff', 'HEAD', 'dashboard.html'], capture_output=True, text=True)
with open('diff.txt', 'w') as f:
    f.write(res.stdout)
