import subprocess

try:
    subprocess.run(['python', 'run_grep.py'])
except Exception as e:
    pass