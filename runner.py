import os
import subprocess

with open('output.txt', 'w') as f:
    try:
        result = subprocess.run(['grep', '-rl', 'game_matches', '.'], capture_output=True, text=True)
        f.write("Files containing game_matches:\n" + result.stdout + "\n")
        
        result2 = subprocess.run(['grep', '-rl', 'PICK A GAME', '.'], capture_output=True, text=True)
        f.write("Files containing PICK A GAME:\n" + result2.stdout + "\n")
    except Exception as e:
        f.write(str(e))
