import subprocess
with open('subprocess_out.txt', 'w') as f:
    subprocess.run(['python', 'find_via_subprocess.py'], stdout=f, text=True)