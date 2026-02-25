import subprocess

try:
    subprocess.run(['python', 'run_extract.py'])
    with open('output.txt', 'r') as f:
        print(f.read())
except Exception as e:
    print(e)