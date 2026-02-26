import subprocess
with open('dash_logic_out.txt', 'w') as f:
    subprocess.run(['python', 'check_dash_logic.py'], stdout=f, text=True)