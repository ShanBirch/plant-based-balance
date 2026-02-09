import os
import csv
import glob

print("--- Directory Content ---")
files = os.listdir('.')
for f in files:
    if 'csv' in f:
        print(f"FOUND: '{f}'")

print("\n--- CSV Inspection ---")
csv_files = [f for f in files if f.endswith('.csv')]
for f in csv_files:
    print(f"\nFILE: {f}")
    try:
        with open(f, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.reader(csvfile)
            rows = []
            for i in range(3):
                try:
                    rows.append(next(reader))
                except StopIteration:
                    break
            
            for i, row in enumerate(rows):
                print(f"Row {i}: {row}")
                
            if len(rows) > 0:
                print("Column Index Guess:")
                for idx, val in enumerate(rows[0]):
                    print(f"  {idx}: {val}")
    except Exception as e:
        print(f"Error reading {f}: {e}")
