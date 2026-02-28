import os, sys
import subprocess
result = subprocess.run(['grep', '-rin', 'checkAndShowWorkoutTrendCard', 'js/'], capture_output=True, text=True)
sys.stderr.write(result.stdout)
sys.exit(1)
