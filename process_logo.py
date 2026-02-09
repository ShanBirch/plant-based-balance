
from PIL import Image
import os

def process_logo():
    input_path = "assets/logo.png"
    output_path = "assets/logo_optimized.png"
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found")
        return

    try:
        img = Image.open(input_path).convert("RGBA")
        
        # 1. Trim Whitespace (if any transparent borders)
        # GetBoundingBox
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        # 2. Add White Background
        # Create new image with white background
        # Make it square + padding
        max_dim = max(img.width, img.height)
        size = int(max_dim * 1.2) # 20% padding
        
        background = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        
        # Paste centered
        offset = ((size - img.width) // 2, (size - img.height) // 2)
        background.paste(img, offset, img)
        
        # 3. Save
        background.save(output_path)
        print(f"Saved optimized logo to {output_path}")
        
    except Exception as e:
        print(f"Failed to process logo: {e}")

if __name__ == "__main__":
    process_logo()
