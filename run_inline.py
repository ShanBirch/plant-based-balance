import subprocess
result = subprocess.run(['python', 'inline.py'], capture_output=True, text=True)
with open('inline_out.txt', 'w') as f:
    f.write(result.stdout)