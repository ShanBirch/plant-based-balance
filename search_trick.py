import os, sys
import subprocess

result = subprocess.run(['grep', '-rin', 'Meal Insight', 'js/'], capture_output=True, text=True)
sys.stderr.write(result.stdout)
sys.stderr.write(result.stderr)
sys.exit(1) # Force fail to read stderr
