import subprocess
with open('dash_part.txt', 'w') as f:
    subprocess.run(['python', 'read_dash_part.py'], stdout=f, text=True)