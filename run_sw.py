import subprocess
with open('sw_out.txt', 'w') as f:
    subprocess.run(['python', 'check_sw.py'], stdout=f, text=True)