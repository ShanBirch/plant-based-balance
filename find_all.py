import os
import glob
for f in glob.glob("**/*.*", recursive=True):
    if f.endswith('.py') or f.endswith('.png') or f.endswith('.jpg') or f.endswith('.jpeg') or f.endswith('.glb'): continue
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'authHelpers.signOut' in content:
            print(f)
    except:
        pass
