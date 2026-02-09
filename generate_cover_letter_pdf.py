from playwright.sync_api import sync_playwright
import os
import sys

def run():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            # Ensure absolute path with file protocol
            # Using forward slashes for URL consistency
            path = os.path.abspath(r"c:\Users\shann\.gemini\antigravity\plant_based_balance\affinda_cover_letter.html").replace("\\", "/")
            
            print(f"Loading: file:///{path}")
            page.goto(f"file:///{path}")
            
            output_path = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Affinda_Cover_Letter_Shannon_Birch.pdf"
            # Using 2.54cm (1 inch) margins to ensure per-page whitespace
            page.pdf(path=output_path, format="A4", print_background=True, margin={"top": "2.54cm", "right": "2.54cm", "bottom": "2.54cm", "left": "2.54cm"})
            
            browser.close()
            print(f"PDF Generated successfully at: {output_path}")
            
    except Exception as e:
        print(f"Error generating PDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
