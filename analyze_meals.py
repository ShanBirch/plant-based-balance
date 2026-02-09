import os
from bs4 import BeautifulSoup
import json

def extract_meals_from_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    soup = BeautifulSoup(content, 'html.parser')
    meals = []
    
    # Assumption: Meals are in .card divs and have an image, title, ingredients, and prep
    cards = soup.find_all('div', class_='card')
    for card in cards:
        # Check if it's a meal card
        title_div = card.find('div', class_='meal-title')
        if not title_div:
            continue
        
        title = title_div.get_text(strip=True)
        
        img = card.find('img')
        img_src = img['src'] if img else None
        
        # Check for Ingredients section
        body = card.find('div', class_='card-body')
        if not body:
            continue
            
        ingredients_header = body.find('h4', string=lambda t: t and 'Ingredients' in t)
        if not ingredients_header:
            # Try searching text content if string exact match fails (e.g. whitespace)
            for h4 in body.find_all('h4'):
                if 'Ingredients' in h4.get_text():
                    ingredients_header = h4
                    break
        
        ingredients = []
        if ingredients_header:
            ul = ingredients_header.find_next('ul')
            if ul:
                ingredients = [li.get_text(strip=True) for li in ul.find_all('li')]
        
        # Check for Preparation section
        prep_header = body.find('h4', string=lambda t: t and 'Preparation' in t)
        if not prep_header:
             for h4 in body.find_all('h4'):
                if 'Preparation' in h4.get_text():
                    prep_header = h4
                    break
        
        prep_text = ""
        if prep_header:
            # Usually the prep is in the next <p> or multiple <p>s
            # We can find all siblings until the next div or end
            curr = prep_header.find_next_sibling()
            while curr:
                if curr.name == 'p':
                    prep_text += curr.get_text(strip=True) + "\n"
                elif curr.name in ['div', 'h4']: # Stop if we hit another section
                    break
                curr = curr.find_next_sibling()
        
        if ingredients or prep_text or img_src:
            meals.append({
                'title': title,
                'image': img_src,
                'ingredients': ingredients,
                'prep': prep_text.strip(),
                'source_file': os.path.basename(filepath)
            })
            
    return meals

files_to_scan = [
    'dashboard.html',
    'plantbasedswitch.html',
    'switch28.html'
]

all_meals = []
root_dir = os.getcwd() # Should be c:\Users\shann\.gemini\antigravity\plant_based_balance

for filename in files_to_scan:
    try:
        meals = extract_meals_from_file(os.path.join(root_dir, filename))
        print(f"Found {len(meals)} meals in {filename}")
        all_meals.extend(meals)
    except Exception as e:
        print(f"Error processing {filename}: {e}")

# Deduplicate
unique_meals = {}
for meal in all_meals:
    # Use title + image as key to avoid duplicates if same meal in multiple files
    key = (meal['title'], meal['image'])
    if key not in unique_meals:
        unique_meals[key] = meal

print(f"Total separate meal entries found: {len(all_meals)}")
print(f"Unique meals found: {len(unique_meals)}")

# Count unique photos
unique_photos = set()
for meal in unique_meals.values():
    if meal['image']:
        unique_photos.add(meal['image'])

print(f"Unique meal photos found: {len(unique_photos)}")

# Parse assets directory for "phantom" meal photos (unused or from old plans)
assets_dir = os.path.join(root_dir, 'assets')
all_asset_images = []
if os.path.exists(assets_dir):
    for f in os.listdir(assets_dir):
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
             # Simple heuristic: if it has "meal" or "nat" or looks like a food name
             # This is fuzzy, so we'll just report the total count of images that *might* be food
             # But let's check against the used images
             all_asset_images.append(f)

# Normalize paths for comparison
used_images_basenames = set()
for p in unique_photos:
    used_images_basenames.add(os.path.basename(p))

print(f"Images in assets folder: {len(all_asset_images)}")
unused_potential_meals = [img for img in all_asset_images if img not in used_images_basenames and ('meal' in img or 'nat_' in img or 'smoothie' in img or 'bowl' in img)]
print(f"Potential unused meal images found based on keywords: {len(unused_potential_meals)}")

# Save to JSON for the next step (generating the library page)
with open('extracted_meals.json', 'w') as f:
    json.dump(list(unique_meals.values()), f, indent=2)

print("Saved extracted_meals.json")
