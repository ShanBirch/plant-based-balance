import csv
import glob

def debug_dates():
    csv_files = glob.glob('Transactions*.csv')
    for filename in csv_files:
        print(f"Checking {filename}...")
        with open(filename, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            date_col = next((k for k in reader.fieldnames if 'Date' in k), None)
            if not date_col: continue
            
            # Print first 5 dates
            count = 0
            for row in reader:
                print(f"  Raw Date: '{row[date_col]}'")
                count += 1
                if count > 5: break

if __name__ == "__main__":
    debug_dates()
