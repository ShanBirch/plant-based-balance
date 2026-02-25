import subprocess

try:
    with open('grep_results.txt', 'w') as f:
        subprocess.run(['grep', '-rn', 'Failed to send challenge', '.'], stdout=f, text=True)
except Exception as e:
    pass