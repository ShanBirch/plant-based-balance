import subprocess

try:
    with open('script_output.txt', 'w') as f:
        subprocess.run(['python', 'check_scripts.py'], stdout=f, text=True)
except Exception as e:
    pass