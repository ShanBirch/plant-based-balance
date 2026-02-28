import os, sys
import subprocess
result = subprocess.run(['find', '.', '-name', 'dashboard.html'], capture_output=True, text=True)
sys.stderr.write(result.stdout)
sys.exit(1)
