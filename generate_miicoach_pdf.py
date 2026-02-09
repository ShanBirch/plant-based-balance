from playwright.sync_api import sync_playwright
import os
import sys

def run():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Input file
            input_file = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Cover_Letter_MIICOACH.html"
            
            # Ensure safe path string for URL
            path = os.path.abspath(input_file).replace("\\", "/")
            
            print(f"Loading: file:///{path}")
            page.goto(f"file:///{path}")
            
            output_path = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Cover_Letter_MIICOACH.pdf"
            
            # Generate PDF
            page.pdf(
                path=output_path, 
                format="A4", 
                print_background=True, 
                margin={"top": "2.54cm", "right": "2.54cm", "bottom": "2.54cm", "left": "2.54cm"}
            )
            
            browser.close()
            print(f"PDF Generated successfully at: {output_path}")
            
    except Exception as e:
        print(f"Error generating PDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
