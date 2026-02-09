from xhtml2pdf import pisa
import os

def convert_html_to_pdf(source_html_path, output_filename):
    # Define absolute paths
    base_dir = r"c:\Users\shann\.gemini\antigravity\plant_based_balance"
    source_path = os.path.join(base_dir, source_html_path)
    output_path = os.path.join(base_dir, output_filename)

    with open(source_path, "r", encoding='utf-8') as source_file:
        html_content = source_file.read()

    # Need to handle assets path for PDF generation
    # xhtml2pdf resolves relative paths relative to current working directory or base_url
    # We will run this script from the base_dir
    
    with open(output_path, "wb") as output_file:
        pisa_status = pisa.CreatePDF(
            src=html_content,
            dest=output_file,
            base_url=base_dir + os.sep # Ensure assets like images are found
        )

    if pisa_status.err:
        print(f"Error converting {source_html_path}: {pisa_status.err}")
    else:
        print(f"Successfully created {output_filename}")

if __name__ == "__main__":
    convert_html_to_pdf("access-cortisol.html", "Cortisol_Meal_Plan_Access.pdf")
    convert_html_to_pdf("access-estrogen.html", "Estrogen_Meal_Plan_Access.pdf")
