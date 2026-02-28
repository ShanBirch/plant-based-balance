import os, sys, subprocess
res = subprocess.run(['grep', '-rin', 'Workout Trend', '.'], capture_output=True, text=True)
with open('output_search.txt', 'w') as f:
    f.write(res.stdout + "\n" + res.stderr)
