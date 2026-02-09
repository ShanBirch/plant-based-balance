from playwright.sync_api import sync_playwright
import os
import sys

def run():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Input file: resume.html (Standard Fitness Resume)
            input_file = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\resume.html"
            path = os.path.abspath(input_file).replace("\\", "/")
            
            print(f"Loading: file:///{path}")
            page.goto(f"file:///{path}")
            
            output_path = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Resume_Shannon_Birch.pdf"
            
            # Generate PDF
            page.pdf(
                path=output_path, 
                format="A4", 
                print_background=True,
                margin={"top": "1cm", "right": "1cm", "bottom": "1cm", "left": "1cm"}
            )
            
            browser.close()
            print(f"PDF Generated successfully at: {output_path}")
            
    except Exception as e:
        print(f"Error generating PDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
