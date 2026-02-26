import subprocess
with open('js_out.txt', 'w') as f:
    subprocess.run(['python', 'find_in_js_again.py'], stdout=f, text=True)