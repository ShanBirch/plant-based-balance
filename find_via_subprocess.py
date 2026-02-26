import subprocess

def search():
    try:
        # Search for the exact error message
        res = subprocess.run(['grep', '-rl', 'Could not find the table', '.'], capture_output=True, text=True)
        print("TABLE NOT FOUND IN:")
        print(res.stdout)
        
        # Search for the alert/toast function that would throw this
        res2 = subprocess.run(['grep', '-rn', 'Failed to send challenge', '.'], capture_output=True, text=True)
        print("FAILED MESSAGE IN:")
        print(res2.stdout)
    except Exception as e:
        print(e)

if __name__ == '__main__':
    search()