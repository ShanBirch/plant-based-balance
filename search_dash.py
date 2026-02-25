import re

with open('dashboard.html', 'r', encoding='utf-8', errors='replace') as f:
    text = f.read()
    
    matches = re.finditer(r'.{0,100}game_matches.{0,100}', text, re.IGNORECASE | re.DOTALL)
    for m in matches:
        print(f"FOUND: {m.group(0)}")
        
    matches2 = re.finditer(r'.{0,100}PICK A GAME.{0,100}', text, re.IGNORECASE | re.DOTALL)
    for m in matches2:
        print(f"FOUND2: {m.group(0)}")
        
    matches3 = re.finditer(r'.{0,100}send challenge.{0,100}', text, re.IGNORECASE | re.DOTALL)
    for m in matches3:
        print(f"FOUND3: {m.group(0)}")