import csv
import glob
from datetime import datetime

def find_latest_date():
    csv_files = glob.glob('Transactions*.csv')
    max_date = datetime(2000, 1, 1)
    
    for filename in csv_files:
        with open(filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            date_col = next((k for k in reader.fieldnames if 'Date' in k), None)
            if not date_col: continue

            for row in reader:
                try:
                    d = datetime.strptime(row[date_col], "%d %b %y")
                    if d > max_date: max_date = d
                except:
                    pass
    
    print(f"LATEST TRANSACTION DATE FOUND: {max_date.strftime('%d %b %Y')}")

if __name__ == "__main__":
    find_latest_date()
