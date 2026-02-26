import os
print(os.path.exists('dashboard.html'))

def search_text():
    with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
        print(len(text))
        
        # look for push notification function
        idx = text.find('sendChallenge')
        if idx != -1:
            print("Found sendChallenge")
            start = max(0, idx - 500)
            end = min(len(text), idx + 2000)
            with open('challenge_code.txt', 'w') as out:
                out.write(text[start:end])
                
        else:
            print("sendChallenge not found in dashboard.html")

search_text()