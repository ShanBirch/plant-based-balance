import os
import glob
for f in glob.glob("**/*.js", recursive=True):
    try:
        content = open(f, 'r', encoding='utf-8').read()
        if 'authHelpers.signOut' in content or 'supabase.auth.signOut' in content:
            print(f)
    except:
        pass
