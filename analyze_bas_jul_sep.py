import csv
import glob
from datetime import datetime

def calculate_bas():
    # Date Range: 1 Jul 2025 - 30 Sep 2025
    START_DATE = datetime(2025, 7, 1)
    END_DATE = datetime(2025, 9, 30)

    csv_files = glob.glob('Transactions*.csv')
    
    total_sales_g1 = 0.0
    total_expenses_with_gst = 0.0
    
    unique_txns = set()

    for filename in csv_files:
        print(f"Reading {filename}...")
        try:
            with open(filename, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                # Check for required columns
                amt_col = next((k for k in reader.fieldnames if 'Amount' in k), None)
                date_col = next((k for k in reader.fieldnames if 'Date' in k), None)
                desc_col = next((k for k in reader.fieldnames if 'Details' in k or 'Description' in k), None)

                if not (amt_col and date_col and desc_col):
                    print("  Missing columns, skipping.")
                    continue

                for row in reader:
                    date_str = row[date_col]
                    # Try parsing date
                    try:
                        txn_date = datetime.strptime(date_str, "%d %b %y")
                    except:
                        try:
                            # 05 Jul 24
                            txn_date = datetime.strptime(date_str, "%d %b %Y") 
                        except:
                            try:
                                txn_date = datetime.strptime(date_str, "%d/%m/%Y")
                            except:
                                continue

                    if not (START_DATE <= txn_date <= END_DATE):
                        continue

                    # Unique check
                    row_id = f"{date_str}-{row[amt_col]}-{row[desc_col]}"
                    if row_id in unique_txns: continue
                    unique_txns.add(row_id)

                    try:
                        amount = float(row[amt_col].replace('$', '').replace(',', ''))
                    except:
                        continue

                    desc_lower = row[desc_col].lower()

                    if amount > 0:
                        # CREDIT (Sales)
                        # Assume all positive inflow excluding 'Transfer' is Sales
                        if "transfer" not in desc_lower:
                            total_sales_g1 += amount
                    else:
                        # DEBIT (Expenses)
                        val = abs(amount)
                        # GST Logic
                        # DBRE (Rent) = GST
                        # Stripe Fees = GST
                        # Generic software = GST
                        # Exclude: Loan repayments, Salary (if any), ATO payments, Drawings
                        
                        exclude = False
                        if "transfer" in desc_lower and "internal" in desc_lower: exclude = True
                        if "ato" in desc_lower: exclude = True
                        
                        if not exclude:
                            total_expenses_with_gst += val

        except Exception as e:
            print(f"Error reading {filename}: {e}")

    gst_collected_1a = total_sales_g1 / 11
    gst_paid_1b = total_expenses_with_gst / 11
    
    # Net tax calculation (if less than 0, refund)
    net_gst = gst_collected_1a - gst_paid_1b

    print("-" * 40)
    print(f"BAS FIGURES (Jul-Sep 2025)")
    print("-" * 40)
    print(f"G1 (Total Sales):      ${total_sales_g1:,.2f}")
    print(f"1A (GST on Sales):     ${gst_collected_1a:,.2f}")
    print(f"1B (GST on Purchases): ${gst_paid_1b:,.2f}")
    print("-" * 40)
    print(f"NET GST PAYABLE:       ${net_gst:,.2f}")
    print("-" * 40)

if __name__ == "__main__":
    calculate_bas()
