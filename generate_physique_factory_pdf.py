from playwright.sync_api import sync_playwright
import os
import sys

def run():
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            
            # Input file
            input_file = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Cover_Letter_Physique_Factory.html"
            
            # Ensure safe path string for URL
            path = os.path.abspath(input_file).replace("\\", "/")
            
            print(f"Loading: file:///{path}")
            page.goto(f"file:///{path}")
            
            # Wait for images to load explicitly to be safe
            page.wait_for_load_state("networkidle")
            
            output_path = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\Cover_Letter_Physique_Factory.pdf"
            
            # Generate PDF
            page.pdf(
                path=output_path, 
                format="A4", 
                print_background=True, 
                # Margins can be adjusted, but css @page usually handles it. 
                # Setting minimal margins here to let CSS take control or avoid cutting off content.
                margin={"top": "1cm", "right": "1cm", "bottom": "1cm", "left": "1cm"}
            )
            
            browser.close()
            print(f"PDF Generated successfully at: {output_path}")
            
    except Exception as e:
        print(f"Error generating PDF: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
