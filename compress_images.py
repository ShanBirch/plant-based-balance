from PIL import Image
import os

def compress_images(directory):
    print(f"Compressing images in {directory}...")
    for filename in os.listdir(directory):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            filepath = os.path.join(directory, filename)
            try:
                with Image.open(filepath) as img:
                    # Convert to RGB (in case of RGBA pngs) for saving as JPEG if we wanted, 
                    # but let's keep format and just resize/optimize.
                    # actually converting to JPEG is much better for photos.
                    
                    if img.mode in ('RGBA', 'P'):
                        img = img.convert('RGB')
                        
                    # Calculate new size maintaining aspect ratio
                    max_size = 1000
                    ratio = min(max_size / float(img.size[0]), max_size / float(img.size[1]))
                    
                    if ratio < 1:
                        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                        img = img.resize(new_size, Image.Resampling.LANCZOS)
                        print(f"Resized {filename} to {new_size}")
                    
                    # Save as JPEG with optimization
                    # We will replace the original PNGs with JPEGs in the code later, or 
                    # actually, let's just overwrite the file as a compressed PNG or JPEG depending on original?
                    # "Screenshot_..." are likely PNGs. PNGs can be large.
                    # Best to save as optimized JPEG.
                    
                    new_filename = os.path.splitext(filename)[0] + ".jpg"
                    new_filepath = os.path.join(directory, new_filename)
                    
                    img.save(new_filepath, 'JPEG', quality=60, optimize=True)
                    print(f"Saved compressed {new_filename}")
                    
            except Exception as e:
                print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    compress_images(r"C:\Users\shann\.gemini\antigravity\plant_based_balance\images")
