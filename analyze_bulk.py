from datetime import datetime
import re

# Text provided by user (truncated for brevity in script, but I will process the full logic)
# This script is designed to handle the user's specific copy-paste format
raw_text_file = "c:/Users/shann/.gemini/antigravity/plant_based_balance/bulk_transactions.txt"

def parse_bulk_transactions():
    print("--- PARSING BULK ENTRIES (Oct-Dec 2025) ---")
    
    # Oct-Dec 2025 Range
    start_date = datetime(2025, 10, 1)
    end_date = datetime(2025, 12, 31)
    
    # Categories to track
    expenses = {
        "Facebook": 0.0,
        "Google": 0.0, # Google Australia, Google Cloud, Google One
        "Trainerize": 0.0, # ABC Trainerize
        "Cursor": 0.0,
        "Wix": 0.0,
        "Microsoft": 0.0,
        "Netflix": 0.0,
        "Zapier": 0.0,
        "Render": 0.0,
        "ElevenLabs": 0.0,
        "Spotify": 0.0,
        "Perplexity": 0.0,
        "ManyChat": 0.0,
        "Insurance": 0.0, # NIB, RACQ, IQumulate (already done but checking matches)
        "Internet": 0.0, # Felix, Woolworths Mobile
        "Fees": 0.0, # INTL TXN FEE
        "Other_Tech": 0.0
    }
    
    try:
        with open(raw_text_file, "r", encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print("Error: bulk_transactions.txt not found. Please create it with the pasted content.")
        return

    current_date = None
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line: continue
        
        # Try to parse date line (e.g. "17 Nov 2025")
        try:
            dt = datetime.strptime(line, "%d %b %Y")
            current_date = dt
            continue
        except ValueError:
            pass
            
        if not current_date: continue
        if not (start_date <= current_date <= end_date): continue

        # Identify transaction amount (look ahead logic)
        amount = 0.0
        # The amount is usually 2-3 lines down, starting with minus sign for debits
        # Format: −$37.16
        
        # First, let's identify the description from the current line if it matches known keywords
        desc = line.lower()
        category = None
        
        if "facebook" in desc or "facebk" in desc: category = "Facebook"
        elif "google" in desc: category = "Google"
        elif "trainerize" in desc: category = "Trainerize"
        elif "cursor" in desc: category = "Cursor"
        elif "wix" in desc: category = "Wix"
        elif "microsoft" in desc: category = "Microsoft"
        elif "netflix" in desc: category = "Netflix"
        elif "zapier" in desc: category = "Zapier"
        elif "render" in desc: category = "Render"
        elif "elevenlabs" in desc: category = "ElevenLabs"
        elif "spotify" in desc: category = "Spotify"
        elif "perplexity" in desc: category = "Perplexity"
        elif "manychat" in desc: category = "ManyChat"
        elif "nib" in desc or "racq" in desc: category = "Insurance"
        elif "felix" in desc or "everyday mobile" in desc: category = "Internet"
        elif "intl txn fee" in desc: category = "Fees"
        
        if category:
            # Look for amount in next few lines
            found_amt = False
            for offset in range(1, 5):
                if i + offset >= len(lines): break
                check_line = lines[i+offset].strip()
                # Check for debit amount format: −$123.45 or -$123.45
                if (check_line.startswith('−$') or check_line.startswith('-$')):
                    amt_str = check_line.replace('−$', '').replace('-$', '').replace(',', '')
                    try:
                        amount = float(amt_str)
                        expenses[category] += amount
                        found_amt = True
                        # print(f"Found {category}: {amount} on {current_date.date()}")
                        break
                    except:
                        pass
    
    print("-" * 30)
    print("TOTALS (Oct-Dec 2025):")
    total_ops = 0.0
    for cat, val in expenses.items():
        if val > 0:
            print(f"{cat}: ${val:.2f}")
            if cat != "Fees": # Fees are separate in P&L
                 total_ops += val
    
    print("-" * 30)
    print(f"Total Operating Expenses Found: ${total_ops:.2f}")
    print(f"Total Fees Found: ${expenses['Fees']:.2f}")

if __name__ == "__main__":
    parse_bulk_transactions()
