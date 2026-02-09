import json
import os

# Read extracted meals
with open('extracted_meals.json', 'r') as f:
    meals = json.load(f)

# HTML Header with styles from dashboard.html
html_content = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Plant Based Balance - Meal Library</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #7BA883; 
            --primary-light: #98C9A3;
            --secondary: #E8D68E;
            --accent-green: #f2f7f4;
            --bg: #f9f9f7;
            --surface: #ffffff;
            --text-main: #1a202c;
            --text-muted: #718096;
            --border-radius: 16px;
            --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text-main);
            margin: 0;
            padding: 40px 20px;
            line-height: 1.6;
        }

        h1, h2, h3 {
            font-family: 'Playfair Display', serif;
            color: var(--primary);
        }

        h1 { font-size: 2.5rem; text-align: center; margin-bottom: 10px; }
        .subtitle { text-align: center; color: var(--text-muted); margin-bottom: 50px; }

        .filters {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-bottom: 40px;
            flex-wrap: wrap;
        }

        .filter-btn {
            padding: 10px 24px;
            border-radius: 50px;
            border: 1px solid transparent;
            background: white;
            color: var(--text-muted);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        .filter-btn:hover, .filter-btn.active {
            background: var(--primary);
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(123, 168, 131, 0.3);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 30px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .card {
            background: var(--surface);
            border-radius: var(--border-radius);
            box-shadow: var(--card-shadow);
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.15);
        }

        .card-img-container {
            position: relative;
            height: 220px;
            background: #eee;
            overflow: hidden;
        }

        .card-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .card:hover .card-img {
            transform: scale(1.05);
        }

        .card-content {
            padding: 25px;
            display: flex;
            flex-direction: column;
            flex-grow: 1;
        }

        .meal-title {
            font-family: 'Playfair Display', serif;
            font-size: 1.4rem;
            font-weight: 600;
            margin: 0 0 15px 0;
            color: var(--primary);
        }

        .section-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--secondary);
            font-weight: 700;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid var(--accent-green);
            padding-bottom: 5px;
            display: inline-block;
        }

        .ingredients-list {
            list-style: none;
            padding: 0;
            margin: 0;
            font-size: 0.95rem;
            color: #555;
        }

        .ingredients-list li {
            margin-bottom: 6px;
            padding-left: 15px;
            position: relative;
        }

        .ingredients-list li::before {
            content: "•";
            color: var(--primary-light);
            position: absolute;
            left: 0;
            font-weight: bold;
        }

        .prep-text {
            font-size: 0.95rem;
            color: #666;
            white-space: pre-line;
            margin-top: 5px;
        }

        .meta-tag {
            position: absolute;
            top: 15px;
            right: 15px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(5px);
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--primary);
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .archive-section {
            margin-top: 80px;
            border-top: 1px solid #ddd;
            padding-top: 50px;
        }
    </style>
</head>
<body>

    <h1>Meal Library</h1>
    <p class="subtitle">A complete collection of "Plant Based Balance" recipes and nutritional masterpieces.</p>

    <div class="filters">
        <button class="filter-btn active" onclick="filterMeals('all')">All Recipes</button>
        <button class="filter-btn" onclick="filterMeals('breakfast')">Breakfast</button>
        <button class="filter-btn" onclick="filterMeals('lunch')">Lunch</button>
        <button class="filter-btn" onclick="filterMeals('dinner')">Dinner</button>
        <button class="filter-btn" onclick="filterMeals('snack')">Snacks</button>
        <button class="filter-btn" onclick="scrollToArchive()">Archive Gallery</button>
    </div>

    <div class="grid" id="recipe-grid">
"""

def detect_category(title, prep):
    text = (title + " " + prep).lower()
    if 'waffles' in text or 'oats' in text or 'pudding' in text or 'smoothie' in text or 'parfait' in text or 'breakfast' in text:
        return 'breakfast'
    elif 'salad' in text or 'bowl' in text or 'soup' in text or 'sandwich' in text or 'wrap' in text or 'lunch' in text:
        return 'lunch'
    elif 'curry' in text or 'stew' in text or 'fry' in text or 'pasta' in text or 'dinner' in text or 'steak' in text or 'burger' in text:
        return 'dinner'
    elif 'tea' in text or 'tonic' in text or 'truffle' in text or 'bar' in text or 'snack' in text or 'dip' in text or 'bite' in text:
        return 'snack'
    return 'other'

for meal in meals:
    category = detect_category(meal['title'], meal['prep'])
    
    # Format image path (remove leading slash if present for robustness)
    img_src = meal['image']
    if img_src and img_src.startswith('/'):
        img_src = img_src[1:]
        
    ingredients_html = "".join([f"<li>{item}</li>" for item in meal['ingredients']])
    
    html_content += f"""
        <div class="card" data-category="{category}">
            <div class="card-img-container">
                <img src="{img_src}" alt="{meal['title']}" class="card-img" loading="lazy">
                <div class="meta-tag">{category.title()}</div>
            </div>
            <div class="card-content">
                <h2 class="meal-title">{meal['title']}</h2>
                
                <div class="section-title">Ingredients</div>
                <ul class="ingredients-list">
                    {ingredients_html}
                </ul>
                
                <div class="section-title">Preparation</div>
                <p class="prep-text">{meal['prep']}</p>
            </div>
        </div>
    """

html_content += """
    </div>

    <div class="archive-section" id="archive">
        <h1>Archive Gallery</h1>
        <p class="subtitle">Generated meal visualizations not currently in the main plan.</p>
        <div class="grid">
"""

# Add unused images
root_dir = os.getcwd()
unique_photos_basenames = set(os.path.basename(m['image']) for m in meals if m['image'])
assets_dir = os.path.join(root_dir, 'assets')
archive_count = 0

if os.path.exists(assets_dir):
    for f in sorted(os.listdir(assets_dir)):
        if f.lower().endswith(('.png', '.jpg', '.webp')) and f not in unique_photos_basenames:
            # Filter for food-like filenames
            if any(x in f.lower() for x in ['meal', 'nat_', 'food', 'plate', 'bowl', 'smoothie', 'toast', 'oats', 'salad']):
                html_content += f"""
                <div class="card">
                    <div class="card-img-container">
                        <img src="assets/{f}" alt="{f}" class="card-img" loading="lazy">
                    </div>
                    <div class="card-content">
                         <h2 class="meal-title" style="font-size: 1rem; word-break: break-all;">{f}</h2>
                         <p style="font-size: 0.8rem; color: #999;">Restored from Archive</p>
                    </div>
                </div>
                """
                archive_count += 1

html_content += """
        </div>
    </div>

    <script>
        function filterMeals(category) {
            const cards = document.querySelectorAll('#recipe-grid .card');
            const btns = document.querySelectorAll('.filter-btn');
            
            // Update active button
            btns.forEach(btn => {
                if (btn.innerText.toLowerCase().includes(category) || (category === 'all' && btn.innerText.includes('All'))) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            cards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        }
        
        function scrollToArchive() {
            document.getElementById('archive').scrollIntoView({behavior: 'smooth'});
        }
    </script>
</body>
</html>
"""

with open('meal_library.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"Generated meal_library.html with {len(meals)} active recipes and {archive_count} archived images.")
