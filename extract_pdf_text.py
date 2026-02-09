import sys
import glob
import os

def try_extract(path):
    print(f"--- Extracting: {path} ---")
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(text)
        return
    except ImportError:
        pass

    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(text)
        return
    except ImportError:
        pass
    
    print("Could not find pypdf or PyPDF2 libraries to extract text.")

files = [
    "Balance – PlantBased-Balance – Stripe.pdf",
    "Balance – PlantBased-Balance – Stripe - oct-dec.pdf"
]

for f in files:
    if os.path.exists(f):
        try_extract(f)
    else:
        print(f"File not found: {f}")
