with open('lib/games.js', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if 'showGameToast(\'Challenge accepted!' in line:
        start = max(0, i-5)
        end = min(len(lines), i+10)
        for j in range(start, end):
            print(f"{j}: {repr(lines[j])}")
