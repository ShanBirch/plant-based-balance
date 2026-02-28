import subprocess, sys

with open("git_info.txt", "w") as f:
    res1 = subprocess.run(['git', 'log', '-n', '2', 'dashboard.html'], capture_output=True, text=True)
    res2 = subprocess.run(['git', 'status'], capture_output=True, text=True)
    f.write(res1.stdout + "\n" + res1.stderr + "\n")
    f.write(res2.stdout + "\n" + res2.stderr + "\n")
