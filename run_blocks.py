import subprocess
with open('blocks_out.txt', 'w') as f:
    subprocess.run(['python', 'find_in_blocks.py'], stdout=f, text=True)