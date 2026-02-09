import csv
import glob
import os
from datetime import datetime

# Define periods
# FY Previous: July 1, 2024 to June 30, 2025
FY_START = datetime(2024, 7, 1)
FY_END = datetime(2025, 6, 30)

# Recent Quarter: Oct 1, 2025 to Dec 31, 2025
OCT_DEC_START = datetime(2025, 10, 1)
OCT_DEC_END = datetime(2025, 12, 31)

def parse_amount(amount_str):
    if not amount_str: return 0.0
    # Remove Currency symbol and commas
    clean = amount_str.replace('$', '').replace(',', '').strip()
    try:
        return float(clean)
    except ValueError:
        return 0.0

def parse_date(date_str):
    # Try multiple formats
    # NAB usually: 25 Jun 25 or 25/06/2025
    formats = ['%d %b %y', '%d/%m/%Y', '%Y-%m-%d']
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None

def load_transactions():
    files = ['Transactions.csv', 'Transactions (1).csv', 'Transactions (2).csv']
    all_transactions = []
    seen_hashes = set()

    print("Checking for transaction files...")
    for f in files:
        if os.path.exists(f):
            print(f"  -> Reading {f}...")
            try:
                with open(f, 'r', encoding='utf-8-sig') as csvfile:
                    reader = csv.reader(csvfile)
                    rows = list(reader)
                    
                    if not rows: continue
                    
                    start_idx = 1 # Skip header
                    
                    for row in rows[start_idx:]:
                        if len(row) < 6: continue 
                        
                        date_str = row[0]
                        amount_str = row[1]
                        details = row[5] # Index 5 is Transaction Details
                        
                        dt = parse_date(date_str)
                        if not dt: continue 
                        
                        amt = parse_amount(amount_str)
                        
                        txn_hash = (date_str, amount_str, details)
                        if txn_hash in seen_hashes:
                            continue
                        seen_hashes.add(txn_hash)
                        
                        all_transactions.append({
                            'date': dt,
                            'amount': amt,
                            'details': details,
                            'original_date': date_str
                        })
                        
            except Exception as e:
                print(f"  -> Error reading {f}: {e}")
        else:
            print(f"  -> File not found: {f}")
            
    print(f"Total unique transactions loaded: {len(all_transactions)}")
    return all_transactions

def categorize_expense(details):
    details = str(details).lower()
    
    # RENT
    if 'dre bre' in details or 'drebre' in details or 'dbre' in details: return 'Rent (Business Premises)'
    
    # Marketing (Prioritize to catch 'paypal *facebook')
    if 'facebook' in details or 'meta' in details or 'facebk' in details or 'fb.me' in details or 'ads' in details: 
        # Exclude 'refund' or 'credit' if appearing in details (though we filter for negative amounts anyway)
        return 'Marketing: Facebook Ads'

    # Software & Subscriptions
    if 'manychat' in details: return 'Software: ManyChat'
    if 'zapier' in details: return 'Software: Zapier'
    if 'cursor' in details: return 'Software: Cursor AI'
    if 'trainerize' in details: return 'Software: ABC Trainerize'
    if 'wix' in details: return 'Software: Wix'
    if 'google' in details: return 'Software: Google'
    if 'microsoft' in details: return 'Software: Microsoft'
    if 'canva' in details: return 'Software: Canva'
    if 'openai' in details or 'anthropic' in details or 'claude' in details or 'chatgpt' in details: return 'Software: AI Models'
    if 'apple.com/bill' in details or 'itunes' in details: return 'Software: Apple Services'
    
    # Generic PayPal (Catch-all for other subs)
    if 'paypal' in details: return 'Software: Other PayPal Services'
    
    # Internet & Phone
    if 'tpg' in details or 'vodafone' in details: return 'Internet & Phone'
    
    # Insurance
    if 'bizcover' in details or 'insurance' in details or 'nib' in details: return 'Insurance'
    
    return 'Other'

def analyze_period(transactions, start_date, end_date, period_name):
    print(f"\n=== ANALYSIS FOR {period_name.upper()} ===")
    print(f"Range: {start_date.date()} to {end_date.date()}")
    
    in_period = [t for t in transactions if start_date <= t['date'] <= end_date]
    print(f"Transactions in period: {len(in_period)}")
    
    if not in_period:
        print("[!] No transactions found for this period.")
        return {}

    expenses = [t for t in in_period if t['amount'] < 0]
    category_totals = {}
    
    for txn in expenses:
        cat = categorize_expense(txn['details'])
        amount = abs(txn['amount'])
        category_totals[cat] = category_totals.get(cat, 0) + amount
        
    sorted_cats = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
    
    total_business = 0
    print("\n--- Identified Business Expenses ---")
    for cat, total in sorted_cats:
        if cat != 'Other':
            print(f"{cat:<35} : ${total:,.2f}")
            total_business += total
            
    print("-" * 50)
    print(f"{'TOTAL IDENTIFIED BUSINESS EXPENSES':<35} : ${total_business:,.2f}")
    
    # Return averages for projection
    monthly_stats = {}
    if period_name.startswith("FY"):
        print("\n--- Calculated Monthly Averages (FY Basis) ---")
        for cat, total in sorted_cats:
            if cat != 'Other':
                avg = total / 12
                monthly_stats[cat] = avg
                print(f"{cat:<35} : ${avg:,.2f} /mo")
                
    return monthly_stats

def main():
    transactions = load_transactions()
    if not transactions:
        print("No transactions found.")
        return

    # Analyze FY2025
    monthly_avgs = analyze_period(transactions, FY_START, FY_END, "FY 2024-2025")
    
    # Analyze Oct-Dec 2025 (Projected)
    print("\n=== PROJECTION FOR OCT-DEC 2025 (Estimates) ===")
    print("(Based on FY2025 Monthly Averages * 3)")
    
    if not monthly_avgs:
        print("No FY data available to project.")
        return

    total_projected = 0
    for cat, monthly in monthly_avgs.items():
        projected = monthly * 3
        print(f"{cat:<35} : ${projected:,.2f}")
        total_projected += projected
        
    print("-" * 50)
    print(f"{'TOTAL PROJECTED QUARTERLY EXPENSES':<35} : ${total_projected:,.2f}")

if __name__ == "__main__":
    main()
