import os, sys
import subprocess
result = subprocess.run(['ls', '-la', 'js/dashboard/'], capture_output=True, text=True)
sys.stderr.write(result.stdout)
sys.exit(1)
