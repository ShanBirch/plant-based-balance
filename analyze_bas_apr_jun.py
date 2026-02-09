import csv
import glob
from datetime import datetime

def analyze_bas_apr_jun():
    files = glob.glob('Transactions.csv') + glob.glob('Transactions (1).csv') + glob.glob('Transactions (2).csv')
    
    # Target Period
    START_DATE = datetime(2025, 4, 1)
    END_DATE = datetime(2025, 6, 30)

    total_sales = 0.0
    expenses_gst = 0.0
    expenses_no_gst = 0.0

    seen_signatures = set() # Avoid duplicates if multiple files cover same txns

    # Keywords (Same as text parser)
    SALES_KW = ["STRIPE", "DEPOSIT", "CREDIT", "JEROME"]
    EXP_GST_KW = ["FACEBOOK", "GOOGLE", "DBRE", "WIX", "CURSOR", "MICROSOFT", "TRAINERIZE", "TPG", "MOBILE", "NETFLIX", "SPOTIFY", "AMAZON", "ADOBE", "MANYCHAT", "SQUASH", "UBER", "TAXI", "OFFICE", "POST", "LOCKSMITH", "IQUMULATE", "INSURANCE", "NIB", "ORIGIN", "ENERGY", "FEES"] 
    EXCLUDE_KW = ["INTERNAL", "TRANSFER", "IGA ", "WOOLWORTHS", "COLES", "GROCER", "ALDI", "LIQUOR", "CHEMIST", "PHARMACY", "DOCTOR", "DENTIST", "GYM", "FITNESS", "EMF", "BAYSIDE", "CHICKEN", "BURLEIGH", "ZAMBRERO", "MC DONALDS", "KFC", "REDY EXPRESS", "SHELL", "BP ", "7-ELEVEN", "AMPOL", "FUEL", "CAFE", "RESTAURANT", "BAR", "PUB", "EATS", "DELIV", "PERSONAL"]

    print(f"Analyzing Apr-Jun 2025 BAS...")

    for filename in files:
        with open(filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames: continue

            # Map Columns
            date_col = next((k for k in reader.fieldnames if 'Date' in k), 'Date')
            amt_col = next((k for k in reader.fieldnames if 'Amount' in k), 'Amount')
            desc_cols = [k for k in reader.fieldnames if 'Details' in k or 'Description' in k or 'Merchant' in k]

            for row in reader:
                d_str = row[date_col].strip()
                try:
                    # Format "30 Jun 25"
                    dt = datetime.strptime(d_str, "%d %b %y")
                except ValueError:
                    continue

                if not (START_DATE <= dt <= END_DATE):
                    continue

                # Signature for dedup
                # (Date, Amount, Balance) or similar
                amt_str = row[amt_col].replace('$', '').replace(',', '')
                try:
                    amount = float(amt_str)
                except:
                    continue
                
                # Deduplicate
                sig = f"{dt.isoformat()}|{amount}|{row.get('Balance','')}|{row.get(desc_cols[0], '')}"
                if sig in seen_signatures: continue
                seen_signatures.add(sig)

                # Combine description
                desc = " ".join([row.get(c, '') for c in desc_cols])
                desc_upper = desc.upper()

                # INCOME (Positive)
                if amount > 0:
                    # Filter internal
                    if "INTERNAL" in desc_upper or "LINKED" in desc_upper:
                        continue
                    # Assume Income
                    total_sales += amount
                
                # EXPENSES (Negative)
                elif amount < 0:
                    val = abs(amount)
                    
                    # Exclude?
                    is_excluded = False
                    for kw in EXCLUDE_KW:
                        if kw in desc_upper:
                            is_excluded = True
                            break
                    
                    if is_excluded:
                        expenses_no_gst += val
                        continue
                    
                    # GST?
                    is_business = False
                    for kw in EXP_GST_KW:
                        if kw in desc_upper:
                            is_business = True
                            break
                    
                    if "DBRE" in desc_upper: is_business = True # Rent
                    
                    if is_business:
                        expenses_gst += val
                    else:
                        expenses_no_gst += val

    # Calculation
    gst_1a = total_sales / 11
    gst_1b = expenses_gst / 11
    payable = gst_1a - gst_1b

    print("-" * 50)
    print(f"BAS ESTIMATE (Apr 1 - Jun 30, 2025)")
    print("-" * 50)
    print(f"G1 (Total Sales):           ${total_sales:,.2f}")
    print(f"1A (GST on Sales):          ${gst_1a:,.2f}")
    print("-" * 50)
    print(f"G11 (Non-Capital Purch):    ${expenses_gst:,.2f}")
    print(f"1B (GST on Purchases):      ${gst_1b:,.2f}")
    print("-" * 50)
    print(f"PAYABLE AMOUNT:             ${payable:,.2f}")
    print("-" * 50)

if __name__ == "__main__":
    analyze_bas_apr_jun()
