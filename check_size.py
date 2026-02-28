import os, sys
size = os.path.getsize('dashboard.html')
sys.stderr.write(f"Size is {size}")
sys.exit(1)
