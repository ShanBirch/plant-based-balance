import os

with open('sw.js', 'r', encoding='utf-8') as f:
    text = f.read()
    if 'sendChallenge' in text or 'game_matches' in text:
        print("FOUND IN sw.js")