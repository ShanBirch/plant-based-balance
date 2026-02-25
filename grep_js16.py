import os
with open('js/dashboard/dashboard-script-16-chat_state.js', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f.readlines()):
        if 'function' in line and ('logout' in line.lower() or 'signout' in line.lower()):
            print(f"Line {i}: {line.strip()}")
