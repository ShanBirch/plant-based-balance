import os
with open('dashboard.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's see if we can find the handleLogout function inside dashboard.html
# We know from earlier search that "authHelpers.signOut()" is called directly on a button:
# dashboard.html Line 2172:                     <button onclick="authHelpers.signOut()" style="width: 100%; padding: 12px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 12px; font-weight: 600; cursor: pointer; margin-top: 20px;">Log Out</button>

print("Found button:", 'authHelpers.signOut()' in content)
