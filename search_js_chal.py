import os
print(os.path.exists('js/dashboard/dashboard-script-15.js'))

with open('js/dashboard/dashboard-script-15.js', 'r', encoding='utf-8') as f:
    text = f.read()
    
idx = text.find('function sendChallenge')
if idx == -1:
    idx = text.find('sendChallenge')
    
if idx != -1:
    with open('js_challenge.txt', 'w') as out:
        out.write(text[max(0, idx - 500) : min(len(text), idx + 2000)])
else:
    print("Not found in script 15")