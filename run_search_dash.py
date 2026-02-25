import subprocess

try:
    result = subprocess.run(['python', 'search_dash.py'], capture_output=True, text=True)
    with open('output_dash.txt', 'w') as f:
        f.write(result.stdout)
except Exception as e:
    pass