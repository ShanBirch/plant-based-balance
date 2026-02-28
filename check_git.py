import subprocess
res = subprocess.run(['git', 'status'], capture_output=True, text=True)
with open('git.txt', 'w') as f: f.write(res.stdout + '\n' + res.stderr)
