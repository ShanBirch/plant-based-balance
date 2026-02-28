import subprocess, sys
result = subprocess.run(['git', 'status'], capture_output=True, text=True)
sys.stderr.write(result.stdout)
sys.exit(1)
