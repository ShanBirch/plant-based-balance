import subprocess
with open('log_output.txt', 'w') as f:
    res = subprocess.run(['git', 'log', '-n', '5', '--', 'dashboard.html'], capture_output=True, text=True)
    f.write(res.stdout + '\n' + res.stderr)
    res2 = subprocess.run(['git', 'status'], capture_output=True, text=True)
    f.write(res2.stdout + '\n' + res2.stderr)
