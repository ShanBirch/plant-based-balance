import subprocess
try:
    with open('size.txt', 'w') as f:
        subprocess.run(['python', 'check_dash_size.py'], stdout=f, text=True)
except Exception as e:
    pass