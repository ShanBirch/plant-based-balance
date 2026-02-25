import os
import subprocess

try:
    result = subprocess.run(['python', 'dashboard_extract_script.py'], capture_output=True, text=True)
    with open('output.txt', 'a') as f:
        f.write("EXTRACT SCRIPT:\n" + result.stdout + "\n")
except Exception as e:
    print(e)