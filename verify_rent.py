import csv
import glob

def analyze_dbre():
    csv_files = glob.glob('Transactions*.csv') + glob.glob('*Campaigns*.csv')
    dbre_txns = []
    total_dbre = 0.0

    print(f"Scanning files: {csv_files}")

    for filename in csv_files:
        print(f"Reading {filename}...")
        try:
            with open(filename, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                # Check expected keys
                if not reader.fieldnames:
                    print(f"  Skipping {filename} (no headers)")
                    continue
                
                # Find amount and description keys roughly
                desc_key = next((k for k in reader.fieldnames if 'Details' in k or 'Description' in k), None)
                amount_key = next((k for k in reader.fieldnames if 'Amount' in k), None)
                date_key = next((k for k in reader.fieldnames if 'Date' in k), None)

                if not desc_key or not amount_key:
                    print(f"  Skipping {filename} (cols missing: need Amount/Details, found {reader.fieldnames})")
                    continue

                for row in reader:
                    desc = row[desc_key]
                    amount_str = row[amount_key]
                    date_str = row[date_key] if date_key else "?"

                    if not amount_str: continue
                    try:
                        amount = float(amount_str.replace('$', '').replace(',', ''))
                        if 'DBRE' in desc.upper():
                            if amount < 0:
                                dbre_txns.append((date_str, desc, amount))
                                total_dbre += abs(amount)
                    except ValueError:
                        continue
        except Exception as e:
            print(f"  Error reading {filename}: {e}")

    # Remove duplicates? The user might have overlapping exports.
    # A simple dedup by (Date, Description, Amount) might be safe enough for this check.
    unique_txns = sorted(list(set(dbre_txns)), key=lambda x: x[0]) # Sort by date string (approx)
    
    unique_total = sum(abs(t[2]) for t in unique_txns)

    print("-" * 50)
    print(f"TOTAL DBRE PAYMENTS (Unique): ${unique_total:,.2f}")
    print("-" * 50)
    for d, desc, a in unique_txns:
        print(f"{d} | {desc} | {a}")

if __name__ == "__main__":
    analyze_dbre()
