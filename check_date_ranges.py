import csv
import glob
from datetime import datetime

def check_dates():
    files = glob.glob('Transactions*.csv')
    min_date = datetime.max
    max_date = datetime.min
    
    # Date formats to try
    formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%b-%y", "%d/%m/%y"]

    for filename in files:
        print(f"Checking {filename}...")
        with open(filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames: continue
            
            # Find date column
            date_col = next((k for k in reader.fieldnames if 'Date' in k), None)
            if not date_col: continue

            for row in reader:
                d_str = row[date_col].strip()
                if not d_str: continue
                
                dt = None
                for fmt in formats:
                    try:
                        dt = datetime.strptime(d_str, fmt)
                        break
                    except ValueError:
                        continue
                
                if dt:
                    if dt < min_date: min_date = dt
                    if dt > max_date: max_date = dt
    
    if min_date != datetime.max:
        print(f"Range found: {min_date.strftime('%Y-%m-%d')} to {max_date.strftime('%Y-%m-%d')}")
    else:
        print("No valid dates found.")

if __name__ == "__main__":
    check_dates()
