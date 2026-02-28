import os
import subprocess
print("Finding dashboard")
res = subprocess.run(['find', '.', '-name', 'dashboard.html'], capture_output=True, text=True)
with open('dash_paths.txt', 'w') as f:
    f.write(res.stdout)
