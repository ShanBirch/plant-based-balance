import os
import re

with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

# search for push notification
m = re.search(r'(.{0,200}push notification.{0,200})', text, re.IGNORECASE)
if m:
    print(m.group(1))
    
# search for anything related to push or onesignal
m = re.search(r'(.{0,200}OneSignal.{0,200})', text, re.IGNORECASE)
if m:
    print("Found OneSignal")
    
# look for sendChallenge definition
m = re.search(r'(function\s+sendChallenge.*?})', text, re.IGNORECASE | re.DOTALL)
if m:
    print("Found sendChallenge")
    with open('send_chal.txt', 'w') as out:
        out.write(m.group(1))