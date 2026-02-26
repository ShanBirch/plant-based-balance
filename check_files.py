import os

print("Files in dir:")
for f in os.listdir('.'):
    if f.endswith('.txt'):
        print(f)