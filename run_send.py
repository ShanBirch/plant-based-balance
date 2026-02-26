import subprocess

with open('send_out.txt', 'w') as f:
    subprocess.run(['python', 'find_send.py'], stdout=f, text=True)