import os
with open('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'out' in line.lower() and ('log' in line.lower() or 'sign' in line.lower()):
            print(f"Line {i}: {line.strip()}")
