import re
with open('dashboard.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Look for JavaScript blocks
script_blocks = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
for i, block in enumerate(script_blocks):
    if 'sendChallenge' in block or 'game_matches' in block or 'Could not find the table' in block or 'PICK A GAME' in block:
        print(f"FOUND IN BLOCK {i}")
        with open(f'block_{i}.txt', 'w', encoding='utf-8') as out:
            out.write(block)