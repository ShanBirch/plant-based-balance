import subprocess
with open('dash_lines_out.txt', 'w') as f:
    subprocess.run(['python', 'search_dash_lines.py'], stdout=f, text=True)