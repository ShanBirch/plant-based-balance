from playwright.sync_api import sync_playwright
import os
import sys

def run():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Resume PDF
            resume_path = os.path.abspath(r"c:\Users\shann\.gemini\antigravity\plant_based_balance\resume_ai_ml.html").replace("\\", "/")
            print(f"Loading Resume: file:///{resume_path}")
            page.goto(f"file:///{resume_path}")
            
            resume_output = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Resume_AI_ML_Shannon_Birch_Updated.pdf"
            # Using 2.54cm (1 inch) margins
            page.pdf(path=resume_output, format="A4", print_background=True, margin={"top": "2.54cm", "right": "2.54cm", "bottom": "2.54cm", "left": "2.54cm"})
            print(f"Resume PDF Generated at: {resume_output}")

            browser.close()
            
    except Exception as e:
        print(f"Error generating PDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
