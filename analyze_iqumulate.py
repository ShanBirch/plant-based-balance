from datetime import datetime
import re

# Text provided by user
raw_text = """17 Nov 2025	
INTEREST CHARGED
Loans
−$3.19
−$3.19
...
06 Nov 2025	
REVERSAL OF DEBIT IQUMULATE FUNDING SE000092871661
Other income
+$479.10
−$485.62
...
05 Nov 2025	
IQumulate Premium Funding
Insurance
−$479.10
−$964.72
...
31 Oct 2025	
INTEREST CHARGED
Loans
−$6.27
−$485.62
...
20 Oct 2025	
REVERSAL OF DEBIT IQUMULATE FUNDING SE000092871661
Other income
+$509.10
−$479.35
...
17 Oct 2025	
IQumulate Premium Funding
Insurance
−$509.10
−$988.45
...
07 Oct 2025	
REVERSAL OF DEBIT IQUMULATE FUNDING SE000092871661
Other income
+$479.10
−$479.35
...
06 Oct 2025	
IQumulate Premium Funding
Insurance
−$479.10
−$958.45
...
30 Sep 2025	
INTEREST CHARGED
Loans
−$5.01
−$479.35
...
05 Sep 2025	
IQumulate Premium Funding
Insurance
−$479.10
−$474.34
...
06 Aug 2025	
IQumulate Premium Funding
Insurance
−$958.20
+$1,074.76
"""

def parse_iqumulate():
    print("--- PARSING NEW TRANSACTIONS (IQumulate) ---")
    
    # Oct-Dec 2025 Range
    start_date = datetime(2025, 10, 1)
    end_date = datetime(2025, 12, 31)
    
    lines = raw_text.split('\n')
    current_date = None
    total_insurance = 0.0
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line: continue
        
        # Try to parse date line (e.g. "06 Nov 2025")
        try:
            dt = datetime.strptime(line, "%d %b %Y")
            current_date = dt
            continue
        except ValueError:
            pass
            
        if "IQumulate Premium Funding" in line and "REVERSAL" not in line:
            # Look ahead for amount (negative)
            # usually 2 lines down
            found_amount = False
            for offset in range(1, 4):
                if i + offset >= len(lines): break
                check_line = lines[i+offset].strip()
                if check_line.startswith('−$'):
                    amt_str = check_line.replace('−$', '').replace(',', '')
                    try:
                        amt = float(amt_str)
                        if start_date <= current_date <= end_date:
                            print(f"Found Insurance: {current_date.date()} | ${amt}")
                            total_insurance += amt
                        found_amount = True
                        break
                    except:
                        continue
            if not found_amount:
                print(f"Warning: Could not find amount for IQumulate on {current_date}")

    print("-" * 30)
    print(f"Total Extra Insurance (Oct-Dec 2025): ${total_insurance:.2f}")

if __name__ == "__main__":
    parse_iqumulate()
