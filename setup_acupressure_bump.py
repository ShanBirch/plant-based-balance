
import os
import shutil

source_images_dir = r"c:\Users\shann\.gemini\antigravity\perimenopause_reset_plan\protocols\cortisol\images"
dest_images_dir = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\assets\acupressure"
source_html = r"c:\Users\shann\.gemini\antigravity\perimenopause_reset_plan\protocols\cortisol\adrenal_acupressure_guide.html"
dest_html = r"c:\Users\shann\.gemini\antigravity\plant_based_balance\acupressure-guide.html"

# Create stats
stats = {"copied_images": 0, "html_status": "pending"}

# 1. Create Dist Directory
if not os.path.exists(dest_images_dir):
    os.makedirs(dest_images_dir)

# 2. Copy Images
if os.path.exists(source_images_dir):
    for filename in os.listdir(source_images_dir):
        if filename.startswith("acupressure") and filename.endswith(".png"):
            shutil.copy2(os.path.join(source_images_dir, filename), os.path.join(dest_images_dir, filename))
            stats["copied_images"] += 1

# 3. Create HTML File with Updated Image Paths
try:
    with open(source_html, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update image paths: src="images/" -> src="assets/acupressure/"
    new_content = content.replace('src="images/', 'src="assets/acupressure/')
    
    with open(dest_html, 'w', encoding='utf-8') as f:
        f.write(new_content)
    stats["html_status"] = "created"
except Exception as e:
    stats["html_status"] = f"error: {str(e)}"

print(stats)
