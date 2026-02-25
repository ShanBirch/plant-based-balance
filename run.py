import subprocess
print(subprocess.run(['python', 'check_dash.py'], capture_output=True, text=True).stdout)