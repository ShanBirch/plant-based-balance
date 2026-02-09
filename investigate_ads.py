import csv
import glob
import os
from datetime import datetime

def parse_amount(amount_str):
    if not amount_str: return 0.0
    clean = amount_str.replace('$', '').replace(',', '').strip()
    try:
        return float(clean)
    except ValueError:
        return 0.0

def load_transactions():
    files = ['Transactions.csv', 'Transactions (1).csv', 'Transactions (2).csv']
    all_rows = []
    
    for f in files:
        if os.path.exists(f):
            try:
                with open(f, 'r', encoding='utf-8-sig') as csvfile:
                    reader = csv.reader(csvfile)
                    rows = list(reader)
                    if len(rows) > 1:
                        # Skip header (row 0), extract Date (0), Amount (1), Details (5)
                        for r in rows[1:]:
                            if len(r) >= 6:
                                all_rows.append({
                                    'date': r[0],
                                    'amount': parse_amount(r[1]),
                                    'details': r[5]
                                })
            except Exception as e:
                print(f"Error reading {f}: {e}")
    return all_rows

def investigate():
    transactions = load_transactions()
    expenses = [t for t in transactions if t['amount'] < 0]
    
    print(f"Total Expense Transactions: {len(expenses)}")
    
    # 1. Search for keywords
    keywords = ['face', 'meta', 'ads', 'bill', 'commbank', 'card', 'paypal']
    print(f"\n--- Searching for Keywords: {keywords} ---")
    found_count = 0
    for kw in keywords:
        matches = [t for t in expenses if kw in t['details'].lower()]
        total_kw = sum(t['amount'] for t in matches)
        print(f"Keyword '{kw}': {len(matches)} items, Total: ${abs(total_kw):,.2f}")
        if len(matches) > 0:
            # Show top 3 examples
            sorted_matches = sorted(matches, key=lambda x: x['amount']) # ascend because negative
            for m in sorted_matches[:3]:
                print(f"  Example: {m['date']} | ${m['amount']} | {m['details']}")
    
    # 2. List Top 30 Uncategorized "Other" expenses that are NOT Rent
    # Simplified categorizer to exclude knowns
    print("\n--- Top 30 Largest UNKNOWN Expenses (excluding Rent/Known) ---")
    unknowns = []
    known_keys = ['manychat', 'zapier', 'cursor', 'trainerize', 'wix', 'google', 
                  'microsoft', 'canva', 'openai', 'anthropic', 'claude', 'tpg', 
                  'vodafone', 'bizcover', 'insurance', 'nib', 'dre bre', 'dbre', 'drebre']
    
    for t in expenses:
        details = t['details'].lower()
        if any(k in details for k in known_keys):
            continue
        unknowns.append(t)
        
    unknowns.sort(key=lambda x: x['amount']) # Most negative first
    
    for i, t in enumerate(unknowns[:30]):
        print(f"{i+1}. {t['date']} | ${t['amount']} | {t['details']}")

if __name__ == "__main__":
    investigate()
