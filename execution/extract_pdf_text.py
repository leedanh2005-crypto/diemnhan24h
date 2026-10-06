"""
Extract text from all PDF files in the workspace.
Outputs text content to .tmp/ for analysis.
"""
import fitz  # PyMuPDF
import os
import glob
import sys

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

workspace = r"d:\ý tưởng kd"
output_dir = os.path.join(workspace, ".tmp")
os.makedirs(output_dir, exist_ok=True)

# Find all PDF files
pdf_files = sorted(glob.glob(os.path.join(workspace, "*.pdf")))

print(f"Found {len(pdf_files)} PDF files:\n")

for pdf_path in pdf_files:
    filename = os.path.basename(pdf_path)
    print(f"{'='*80}")
    print(f"FILE: {filename}")
    print(f"{'='*80}")
    
    try:
        doc = fitz.open(pdf_path)
        full_text = ""
        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                print(f"\n--- Page {page_num + 1} ---")
                print(text)
                full_text += f"\n--- Page {page_num + 1} ---\n{text}"
        
        # Save extracted text
        txt_filename = filename.replace(".pdf", ".txt")
        txt_path = os.path.join(output_dir, txt_filename)
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(full_text)
        
        doc.close()
        print(f"\n[Saved to .tmp/{txt_filename}]")
    except Exception as e:
        print(f"Error reading {filename}: {e}")
    
    print()
