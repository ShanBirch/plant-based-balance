import subprocess
with open('local_search_out.txt', 'w') as f:
    subprocess.run(['python', 'local_search.py'], stdout=f, text=True)