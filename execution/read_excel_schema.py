import pandas as pd
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

file_path = r'd:\ý tưởng kd\KSKD_PICKO_DATA.xlsx'
if not os.path.exists(file_path):
    print("File not found:", file_path)
    sys.exit(1)

try:
    xls = pd.ExcelFile(file_path)
    for sheet_name in xls.sheet_names:
        print(f"\n--- Sheet: {sheet_name} ---")
        df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=5)
        print("Columns:")
        for col in df.columns:
            print(f"- {col}")
except Exception as e:
    print("Error reading excel:", e)
