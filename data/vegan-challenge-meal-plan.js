/**
 * 30-Day Plant-Based Challenge — Curated 4-Week Meal Plan Template
 *
 * Recipe pool (31 recipes) + 28-day rotation schedule. The populator
 * (lib/meal-plan-populator.js) scales these per-user based on their
 * calorie/macro targets and inserts into ai_generated_meal_plans.
 *
 * Base recipes assume a 2000 cal/day plan with this slot split:
 *   breakfast 25% (500 cal), am_snack 8% (160 cal), lunch 28% (560 cal),
 *   pm_snack 8% (160 cal), dinner 31% (620 cal). Totals to 100%.
 *
 * Scaling preserves the recipe's intrinsic protein/carb/fat ratio while
 * matching the user's overall calorie target.
 */

(function () {
  const IMG = (name) => `images/meals/${name}`;

  // ---------------------------------------------------------------------------
  // RECIPE POOL
  // ---------------------------------------------------------------------------
  const RECIPES = {
    // ------- BREAKFASTS (8) -------
    b_berry_almond_oats: {
      slot: 'breakfast',
      name: 'Berry Almond Baked Oats',
      description: 'Cosy baked oats with raspberries and almond butter — warm, jammy, and high-fiber to keep you full till lunch.',
      cuisine: 'Modern',
      tags: ['high-fiber', 'whole-food', 'sweet'],
      base_calories: 500, protein_g: 18, carbs_g: 70, fat_g: 16, fiber_g: 11,
      ingredients: [
        { name: 'Rolled oats', amount: '3/4 cup' },
        { name: 'Unsweetened almond milk', amount: '1 cup' },
        { name: 'Almond butter', amount: '1 tbsp' },
        { name: 'Frozen raspberries', amount: '1/2 cup' },
        { name: 'Maple syrup', amount: '1 tsp' },
        { name: 'Chia seeds', amount: '1 tsp' },
        { name: 'Cinnamon', amount: 'pinch' }
      ],
      preparation: 'Stir oats, milk, chia, syrup and cinnamon in an oven dish. Top with raspberries and dollop almond butter. Bake 180°C / 350°F for 22 minutes until golden on top.',
      prep_time_mins: 5, cook_time_mins: 22,
      image: IMG('baked_raspberry_almond_oats.png')
    },
    b_avocado_toast: {
      slot: 'breakfast',
      name: 'Smashed Avocado Toast Stack',
      description: 'Sourdough piled with smashed avocado, hemp seeds, lemon and a chilli kick — the classic, done properly.',
      cuisine: 'Cafe',
      tags: ['quick', 'savory', 'healthy-fats'],
      base_calories: 500, protein_g: 17, carbs_g: 50, fat_g: 25, fiber_g: 13,
      ingredients: [
        { name: 'Sourdough bread', amount: '2 thick slices' },
        { name: 'Ripe avocado', amount: '1 medium' },
        { name: 'Hemp seeds', amount: '1 tbsp' },
        { name: 'Lemon juice', amount: '1 tsp' },
        { name: 'Cherry tomatoes, halved', amount: '6' },
        { name: 'Chilli flakes', amount: 'to taste' },
        { name: 'Sea salt + cracked pepper', amount: 'to taste' }
      ],
      preparation: 'Toast sourdough. Smash avocado with lemon, salt and pepper. Spread thickly, scatter cherry tomatoes, hemp seeds and chilli flakes.',
      prep_time_mins: 7, cook_time_mins: 0,
      image: IMG('avocado_smash_toast.png')
    },
    b_tofu_scramble: {
      slot: 'breakfast',
      name: 'Turmeric Tofu Scramble Plate',
      description: 'Golden, eggy-style tofu scramble with spinach and toast — protein-packed and savory.',
      cuisine: 'Cafe',
      tags: ['high-protein', 'savory', 'iron-rich'],
      base_calories: 500, protein_g: 30, carbs_g: 45, fat_g: 22, fiber_g: 9,
      ingredients: [
        { name: 'Firm tofu, crumbled', amount: '180g' },
        { name: 'Turmeric', amount: '1/4 tsp' },
        { name: 'Garlic powder', amount: '1/4 tsp' },
        { name: 'Black salt (kala namak)', amount: 'pinch' },
        { name: 'Baby spinach', amount: '1 cup' },
        { name: 'Sourdough toast', amount: '1 slice' },
        { name: 'Olive oil', amount: '1 tsp' }
      ],
      preparation: 'Heat oil in a pan, add crumbled tofu, turmeric, garlic and black salt. Cook 4 minutes. Wilt in spinach. Serve with toast.',
      prep_time_mins: 5, cook_time_mins: 6,
      image: IMG('tofu_scramble_plate.png')
    },
    b_berry_yogurt: {
      slot: 'breakfast',
      name: 'Berry Protein Yogurt Bowl',
      description: 'Thick soy yogurt loaded with berries, granola and a scoop of protein — fast, fresh and filling.',
      cuisine: 'Modern',
      tags: ['high-protein', 'no-cook', 'fast'],
      base_calories: 500, protein_g: 32, carbs_g: 55, fat_g: 12, fiber_g: 8,
      ingredients: [
        { name: 'Plain soy yogurt', amount: '1 cup' },
        { name: 'Vanilla plant protein', amount: '1 scoop (25g)' },
        { name: 'Mixed berries', amount: '3/4 cup' },
        { name: 'Granola', amount: '1/4 cup' },
        { name: 'Maple syrup', amount: '1 tsp' }
      ],
      preparation: 'Whisk protein into yogurt until smooth. Top with berries, granola and a drizzle of maple.',
      prep_time_mins: 3, cook_time_mins: 0,
      image: IMG('berry_protein_yogurt.png')
    },
    b_green_smoothie_bowl: {
      slot: 'breakfast',
      name: 'Green Smoothie Bowl',
      description: 'Spinach, banana and protein blended thick — top with granola and seeds for crunch.',
      cuisine: 'Modern',
      tags: ['greens', 'no-cook', 'antioxidant'],
      base_calories: 500, protein_g: 24, carbs_g: 65, fat_g: 14, fiber_g: 12,
      ingredients: [
        { name: 'Frozen banana', amount: '1 large' },
        { name: 'Baby spinach', amount: '1 cup' },
        { name: 'Vanilla plant protein', amount: '1 scoop' },
        { name: 'Almond milk', amount: '1/2 cup' },
        { name: 'Granola', amount: '1/4 cup' },
        { name: 'Pumpkin seeds', amount: '1 tbsp' },
        { name: 'Kiwi, sliced', amount: '1' }
      ],
      preparation: 'Blend banana, spinach, protein and milk until thick. Pour in a bowl, top with granola, kiwi and pumpkin seeds.',
      prep_time_mins: 5, cook_time_mins: 0,
      image: IMG('green_smoothie_bowl.png')
    },
    b_coconut_yogurt_granola: {
      slot: 'breakfast',
      name: 'Coconut Yogurt Granola Cup',
      description: 'Creamy coconut yogurt layered with crunchy granola and seasonal fruit — light but satisfying.',
      cuisine: 'Modern',
      tags: ['no-cook', 'gut-health', 'sweet'],
      base_calories: 500, protein_g: 16, carbs_g: 65, fat_g: 18, fiber_g: 9,
      ingredients: [
        { name: 'Coconut yogurt', amount: '1 cup' },
        { name: 'Granola', amount: '1/3 cup' },
        { name: 'Strawberries, sliced', amount: '1/2 cup' },
        { name: 'Banana, sliced', amount: '1/2' },
        { name: 'Honey or maple syrup', amount: '1 tsp' }
      ],
      preparation: 'Layer yogurt, granola and fruit in a glass. Drizzle with sweetener.',
      prep_time_mins: 3, cook_time_mins: 0,
      image: IMG('coconut_yogurt_granola.png')
    },
    b_choc_protein_shake: {
      slot: 'breakfast',
      name: 'Chocolate Banana Protein Shake',
      description: 'Rich chocolate-banana shake with peanut butter — like a milkshake, but it covers your morning macros.',
      cuisine: 'Modern',
      tags: ['high-protein', 'fast', 'on-the-go'],
      base_calories: 500, protein_g: 35, carbs_g: 55, fat_g: 14, fiber_g: 7,
      ingredients: [
        { name: 'Frozen banana', amount: '1 large' },
        { name: 'Chocolate plant protein', amount: '1 scoop' },
        { name: 'Cocoa powder', amount: '1 tsp' },
        { name: 'Oat milk', amount: '1 1/4 cups' },
        { name: 'Peanut butter', amount: '1 tbsp' },
        { name: 'Rolled oats', amount: '2 tbsp' }
      ],
      preparation: 'Blend everything until thick and frothy. Pour and serve immediately.',
      prep_time_mins: 3, cook_time_mins: 0,
      image: IMG('chocolate_banana_protein_shake.png')
    },
    b_pb_banana_toast: {
      slot: 'breakfast',
      name: 'PB Banana Toast',
      description: 'Wholegrain toast with peanut butter, banana coins, chia and a drizzle of honey — old-school breakfast win.',
      cuisine: 'Modern',
      tags: ['quick', 'sweet', 'kid-friendly'],
      base_calories: 500, protein_g: 18, carbs_g: 60, fat_g: 20, fiber_g: 10,
      ingredients: [
        { name: 'Wholegrain bread', amount: '2 slices' },
        { name: 'Natural peanut butter', amount: '2 tbsp' },
        { name: 'Banana, sliced', amount: '1' },
        { name: 'Chia seeds', amount: '1 tsp' },
        { name: 'Honey or maple syrup', amount: '1 tsp' }
      ],
      preparation: 'Toast bread, spread with peanut butter, top with banana coins and a sprinkle of chia. Drizzle with honey.',
      prep_time_mins: 4, cook_time_mins: 0,
      image: IMG('pb_banana_toast.png')
    },

    // ------- LUNCHES (7) -------
    l_med_lentil_salad: {
      slot: 'lunch',
      name: 'Mediterranean Lentil Salad',
      description: 'Bright, lemony lentil salad with cherry tomatoes, cucumber, olives and a drizzle of tahini.',
      cuisine: 'Mediterranean',
      tags: ['high-fiber', 'iron-rich', 'meal-prep'],
      base_calories: 560, protein_g: 28, carbs_g: 60, fat_g: 22, fiber_g: 14,
      ingredients: [
        { name: 'Cooked green lentils', amount: '1 cup' },
        { name: 'Cherry tomatoes, halved', amount: '1 cup' },
        { name: 'Cucumber, diced', amount: '1/2' },
        { name: 'Kalamata olives', amount: '8' },
        { name: 'Red onion, finely sliced', amount: '1/4' },
        { name: 'Tahini', amount: '1 tbsp' },
        { name: 'Lemon juice', amount: '1 tbsp' },
        { name: 'Olive oil', amount: '1 tbsp' },
        { name: 'Fresh parsley', amount: '1/4 cup' }
      ],
      preparation: 'Whisk tahini, lemon and olive oil. Toss with lentils, vegetables and herbs. Season generously.',
      prep_time_mins: 12, cook_time_mins: 0,
      image: IMG('mediterranean_lentil_salad.png')
    },
    l_hummus_wrap: {
      slot: 'lunch',
      name: 'Loaded Hummus Veggie Wrap',
      description: 'Wholegrain wrap stuffed with hummus, crisp veg and greens — packable, fresh, never boring.',
      cuisine: 'Mediterranean',
      tags: ['quick', 'meal-prep', 'fiber'],
      base_calories: 560, protein_g: 22, carbs_g: 70, fat_g: 18, fiber_g: 12,
      ingredients: [
        { name: 'Wholegrain wrap (large)', amount: '1' },
        { name: 'Hummus', amount: '3 tbsp' },
        { name: 'Mixed greens', amount: '1 cup' },
        { name: 'Carrot, grated', amount: '1/2' },
        { name: 'Cucumber, julienned', amount: '1/4' },
        { name: 'Roasted peppers', amount: '1/4 cup' },
        { name: 'Sunflower seeds', amount: '1 tbsp' },
        { name: 'Apple', amount: '1 medium (side)' }
      ],
      preparation: 'Spread hummus across the wrap, layer greens and veg, sprinkle seeds. Roll tight, slice in half. Serve with apple.',
      prep_time_mins: 6, cook_time_mins: 0,
      image: IMG('hummus_veggie_wrap.png')
    },
    l_chickpea_tuna_wrap: {
      slot: 'lunch',
      name: 'Chickpea "Tuna" Wrap',
      description: 'Smashed chickpeas with vegan mayo, celery, dill and lemon — a plant-based take on the classic tuna salad.',
      cuisine: 'American',
      tags: ['high-protein', 'meal-prep', 'kid-friendly'],
      base_calories: 560, protein_g: 26, carbs_g: 65, fat_g: 20, fiber_g: 13,
      ingredients: [
        { name: 'Cooked chickpeas', amount: '1 cup' },
        { name: 'Vegan mayo', amount: '2 tbsp' },
        { name: 'Celery, finely diced', amount: '1 stalk' },
        { name: 'Red onion, minced', amount: '1 tbsp' },
        { name: 'Fresh dill', amount: '1 tbsp' },
        { name: 'Lemon juice', amount: '1 tsp' },
        { name: 'Wholegrain wrap', amount: '1 large' },
        { name: 'Lettuce', amount: '1 cup' }
      ],
      preparation: 'Mash chickpeas roughly with a fork. Mix in mayo, celery, onion, dill, lemon, salt and pepper. Spread on wrap with lettuce, roll and slice.',
      prep_time_mins: 8, cook_time_mins: 0,
      image: IMG('chickpea_tuna_wrap.png')
    },
    l_quinoa_black_bean: {
      slot: 'lunch',
      name: 'Quinoa Black Bean Power Salad',
      description: 'Quinoa, black beans, corn, avocado and lime — a crowd-pleasing protein-packed salad you can eat warm or cold.',
      cuisine: 'Mexican',
      tags: ['high-protein', 'meal-prep', 'gluten-free'],
      base_calories: 560, protein_g: 24, carbs_g: 75, fat_g: 16, fiber_g: 16,
      ingredients: [
        { name: 'Cooked quinoa', amount: '1 cup' },
        { name: 'Black beans, rinsed', amount: '3/4 cup' },
        { name: 'Sweet corn', amount: '1/2 cup' },
        { name: 'Cherry tomatoes', amount: '1/2 cup' },
        { name: 'Avocado, diced', amount: '1/2' },
        { name: 'Lime juice', amount: '1 tbsp' },
        { name: 'Olive oil', amount: '1 tsp' },
        { name: 'Coriander, chopped', amount: '2 tbsp' },
        { name: 'Cumin', amount: '1/4 tsp' }
      ],
      preparation: 'Whisk lime, oil, cumin and salt. Toss with quinoa, beans, corn and tomatoes. Top with avocado and coriander.',
      prep_time_mins: 10, cook_time_mins: 0,
      image: IMG('quinoa_black_bean_salad.png')
    },
    l_glow_bowl: {
      slot: 'lunch',
      name: 'Glow Bowl',
      description: 'Quinoa, roast sweet potato, kale and chickpeas with creamy tahini-lemon dressing.',
      cuisine: 'Modern',
      tags: ['gluten-free', 'high-fiber', 'meal-prep'],
      base_calories: 560, protein_g: 22, carbs_g: 78, fat_g: 18, fiber_g: 14,
      ingredients: [
        { name: 'Cooked quinoa', amount: '3/4 cup' },
        { name: 'Roast sweet potato', amount: '1 cup' },
        { name: 'Massaged kale', amount: '1 cup' },
        { name: 'Chickpeas', amount: '1/2 cup' },
        { name: 'Tahini', amount: '1 tbsp' },
        { name: 'Lemon juice', amount: '1 tbsp' },
        { name: 'Maple syrup', amount: '1 tsp' },
        { name: 'Pumpkin seeds', amount: '1 tbsp' }
      ],
      preparation: 'Massage kale with a pinch of salt. Build the bowl: quinoa, kale, sweet potato, chickpeas. Whisk dressing and drizzle. Top with seeds.',
      prep_time_mins: 8, cook_time_mins: 0,
      image: IMG('glow_bowl.png')
    },
    l_roast_veggie_quinoa: {
      slot: 'lunch',
      name: 'Roast Veggie Quinoa Bowl',
      description: 'Roasted pumpkin, beetroot and red onion piled over quinoa and chickpeas with herby greens.',
      cuisine: 'Mediterranean',
      tags: ['meal-prep', 'high-fiber', 'iron-rich'],
      base_calories: 560, protein_g: 23, carbs_g: 80, fat_g: 16, fiber_g: 15,
      ingredients: [
        { name: 'Cooked quinoa', amount: '3/4 cup' },
        { name: 'Roast pumpkin', amount: '3/4 cup' },
        { name: 'Roast beetroot', amount: '1/2 cup' },
        { name: 'Red onion, roasted', amount: '1/4' },
        { name: 'Chickpeas', amount: '1/2 cup' },
        { name: 'Rocket', amount: '1 cup' },
        { name: 'Balsamic vinegar', amount: '1 tbsp' },
        { name: 'Olive oil', amount: '1 tsp' }
      ],
      preparation: 'Use leftover roast veg or roast at 200°C for 25 min. Pile over quinoa with chickpeas and rocket. Drizzle balsamic and oil.',
      prep_time_mins: 5, cook_time_mins: 25,
      image: IMG('roast_veggie_quinoa_salad.png')
    },
    l_mexican_bean_salad: {
      slot: 'lunch',
      name: 'Mexican Bean Salad',
      description: 'Black beans, kidney beans, corn, peppers and coriander tossed in a smoky lime dressing.',
      cuisine: 'Mexican',
      tags: ['high-fiber', 'meal-prep', 'iron-rich'],
      base_calories: 560, protein_g: 25, carbs_g: 78, fat_g: 14, fiber_g: 18,
      ingredients: [
        { name: 'Black beans', amount: '3/4 cup' },
        { name: 'Kidney beans', amount: '3/4 cup' },
        { name: 'Corn kernels', amount: '1/2 cup' },
        { name: 'Capsicum, diced', amount: '1/2' },
        { name: 'Red onion', amount: '1/4' },
        { name: 'Lime juice', amount: '1 tbsp' },
        { name: 'Olive oil', amount: '1 tsp' },
        { name: 'Smoked paprika', amount: '1/2 tsp' },
        { name: 'Coriander', amount: '1/4 cup' }
      ],
      preparation: 'Whisk lime, oil and paprika. Toss with all ingredients. Best after 10 minutes for flavors to meld.',
      prep_time_mins: 10, cook_time_mins: 0,
      image: IMG('mexican_bean_salad.png')
    },

    // ------- DINNERS (8) -------
    d_lentil_bolognese: {
      slot: 'dinner',
      name: 'Lentil Bolognese Zoodles',
      description: 'Slow-simmered lentil bolognese over zucchini noodles — cosy, comforting, hidden veg power.',
      cuisine: 'Italian',
      tags: ['high-protein', 'gluten-free', 'family-friendly'],
      base_calories: 620, protein_g: 30, carbs_g: 75, fat_g: 18, fiber_g: 18,
      ingredients: [
        { name: 'Brown lentils, dry', amount: '3/4 cup' },
        { name: 'Crushed tomatoes', amount: '1.5 cups' },
        { name: 'Onion, diced', amount: '1' },
        { name: 'Garlic, minced', amount: '3 cloves' },
        { name: 'Carrot, grated', amount: '1' },
        { name: 'Celery', amount: '1 stalk' },
        { name: 'Italian herbs', amount: '1 tsp' },
        { name: 'Zucchini', amount: '2 medium' },
        { name: 'Olive oil', amount: '1 tbsp' },
        { name: 'Nutritional yeast', amount: '1 tbsp' }
      ],
      preparation: 'Sauté onion, garlic, carrot, celery 5 min. Add lentils, tomatoes, herbs and 2 cups water. Simmer 25 min. Spiralize zucchini, sauté 2 min, top with sauce and nutritional yeast.',
      prep_time_mins: 10, cook_time_mins: 25,
      image: IMG('lentil_bolognese_zoodles.png')
    },
    d_crispy_tofu_sheet: {
      slot: 'dinner',
      name: 'Crispy Tofu Sheet Pan Dinner',
      description: 'One-tray dinner — crispy tofu, broccoli and sweet potato with garlic-soy glaze.',
      cuisine: 'Asian',
      tags: ['high-protein', 'one-pan', 'meal-prep'],
      base_calories: 620, protein_g: 35, carbs_g: 65, fat_g: 22, fiber_g: 12,
      ingredients: [
        { name: 'Firm tofu, cubed', amount: '200g' },
        { name: 'Broccoli florets', amount: '2 cups' },
        { name: 'Sweet potato, cubed', amount: '1 medium' },
        { name: 'Soy sauce', amount: '2 tbsp' },
        { name: 'Maple syrup', amount: '1 tbsp' },
        { name: 'Garlic, minced', amount: '3 cloves' },
        { name: 'Sesame oil', amount: '1 tsp' },
        { name: 'Cornstarch', amount: '1 tbsp' },
        { name: 'Sesame seeds', amount: '1 tsp' }
      ],
      preparation: 'Toss tofu in cornstarch and 1 tsp soy. Spread tofu, broccoli, sweet potato on tray. Drizzle remaining soy, maple, garlic, oil. Bake 200°C / 400°F for 25 min, flipping halfway. Top with sesame seeds.',
      prep_time_mins: 10, cook_time_mins: 25,
      image: IMG('crispy_tofu_sheet_pan.png')
    },
    d_coconut_lentil_soup: {
      slot: 'dinner',
      name: 'Coconut Curry Red Lentil Soup',
      description: 'Velvety red lentil soup with coconut milk, ginger and warming spices — a hug in a bowl.',
      cuisine: 'Indian',
      tags: ['anti-inflammatory', 'comfort', 'gluten-free'],
      base_calories: 620, protein_g: 24, carbs_g: 80, fat_g: 22, fiber_g: 14,
      ingredients: [
        { name: 'Red lentils, dry', amount: '3/4 cup' },
        { name: 'Light coconut milk', amount: '1 cup' },
        { name: 'Vegetable broth', amount: '2 cups' },
        { name: 'Onion, diced', amount: '1' },
        { name: 'Garlic', amount: '3 cloves' },
        { name: 'Fresh ginger', amount: '1 tbsp' },
        { name: 'Curry powder', amount: '1 tbsp' },
        { name: 'Turmeric', amount: '1/2 tsp' },
        { name: 'Spinach', amount: '2 cups' },
        { name: 'Brown rice (cooked)', amount: '1/2 cup' },
        { name: 'Lime', amount: '1/2' }
      ],
      preparation: 'Sauté onion, garlic, ginger 4 min. Stir in spices, then lentils, broth and coconut milk. Simmer 20 min until lentils break down. Wilt in spinach. Serve over rice with a squeeze of lime.',
      prep_time_mins: 10, cook_time_mins: 20,
      image: IMG('coconut_curry_red_lentil_soup.png')
    },
    d_thai_green_curry: {
      slot: 'dinner',
      name: 'Thai Green Curry Tofu',
      description: 'Fragrant Thai green curry with tofu, bamboo shoots and basil over jasmine rice.',
      cuisine: 'Thai',
      tags: ['comfort', 'aromatic', 'high-protein'],
      base_calories: 620, protein_g: 26, carbs_g: 75, fat_g: 24, fiber_g: 8,
      ingredients: [
        { name: 'Firm tofu, cubed', amount: '180g' },
        { name: 'Light coconut milk', amount: '1 cup' },
        { name: 'Green curry paste', amount: '2 tbsp' },
        { name: 'Bamboo shoots', amount: '1/2 cup' },
        { name: 'Snow peas', amount: '1 cup' },
        { name: 'Bok choy', amount: '1 cup' },
        { name: 'Jasmine rice (cooked)', amount: '3/4 cup' },
        { name: 'Thai basil', amount: '1/4 cup' },
        { name: 'Lime', amount: '1/2' },
        { name: 'Soy sauce', amount: '1 tsp' }
      ],
      preparation: 'Pan-fry tofu until golden. Add curry paste, cook 1 min. Pour in coconut milk, simmer 5 min. Add veg, simmer 5 min. Stir in basil and lime. Serve over rice.',
      prep_time_mins: 8, cook_time_mins: 15,
      image: IMG('thai_green_curry_tofu.png')
    },
    d_moroccan_chickpea: {
      slot: 'dinner',
      name: 'Moroccan Chickpea Stew',
      description: 'Warming chickpea stew with cinnamon, cumin and apricots — served over fluffy couscous.',
      cuisine: 'Moroccan',
      tags: ['fiber', 'comfort', 'meal-prep'],
      base_calories: 620, protein_g: 24, carbs_g: 95, fat_g: 14, fiber_g: 18,
      ingredients: [
        { name: 'Chickpeas', amount: '1.5 cups' },
        { name: 'Crushed tomatoes', amount: '1 cup' },
        { name: 'Onion, diced', amount: '1' },
        { name: 'Garlic', amount: '3 cloves' },
        { name: 'Carrot, sliced', amount: '1' },
        { name: 'Cumin', amount: '1 tsp' },
        { name: 'Cinnamon', amount: '1/2 tsp' },
        { name: 'Smoked paprika', amount: '1/2 tsp' },
        { name: 'Dried apricots, chopped', amount: '4' },
        { name: 'Wholewheat couscous', amount: '1/2 cup dry' },
        { name: 'Coriander', amount: '2 tbsp' }
      ],
      preparation: 'Sauté onion, garlic, carrot 5 min. Add spices, cook 1 min. Add tomatoes, chickpeas, apricots and 1/2 cup water. Simmer 15 min. Cook couscous per pack. Serve stew over couscous, top with coriander.',
      prep_time_mins: 8, cook_time_mins: 18,
      image: IMG('moroccan_chickpea_stew.png')
    },
    d_tempeh_chili: {
      slot: 'dinner',
      name: 'Hearty Tempeh Chili',
      description: 'Smoky tempeh chili with two types of beans, tomato and a touch of dark chocolate. Even better next day.',
      cuisine: 'American',
      tags: ['high-protein', 'meal-prep', 'iron-rich'],
      base_calories: 620, protein_g: 35, carbs_g: 75, fat_g: 18, fiber_g: 22,
      ingredients: [
        { name: 'Tempeh, crumbled', amount: '150g' },
        { name: 'Black beans', amount: '3/4 cup' },
        { name: 'Kidney beans', amount: '3/4 cup' },
        { name: 'Crushed tomatoes', amount: '1.5 cups' },
        { name: 'Onion, diced', amount: '1' },
        { name: 'Garlic', amount: '3 cloves' },
        { name: 'Capsicum, diced', amount: '1' },
        { name: 'Chili powder', amount: '2 tsp' },
        { name: 'Cumin', amount: '1 tsp' },
        { name: 'Smoked paprika', amount: '1 tsp' },
        { name: 'Dark chocolate', amount: '1 square' },
        { name: 'Brown rice (cooked, optional)', amount: '1/3 cup' }
      ],
      preparation: 'Sauté onion, garlic, capsicum 5 min. Add tempeh, brown 5 min. Add spices, beans and tomatoes. Simmer 20 min. Stir in chocolate at the end. Serve over rice if using.',
      prep_time_mins: 10, cook_time_mins: 25,
      image: IMG('hearty_tempeh_chili.png')
    },
    d_sweet_potato_tacos: {
      slot: 'dinner',
      name: 'Sweet Potato Black Bean Tacos',
      description: 'Soft corn tortillas piled with smoky sweet potato, black beans, slaw and lime crema.',
      cuisine: 'Mexican',
      tags: ['family-friendly', 'gluten-free', 'fun'],
      base_calories: 620, protein_g: 22, carbs_g: 95, fat_g: 18, fiber_g: 18,
      ingredients: [
        { name: 'Sweet potato, cubed', amount: '1 medium' },
        { name: 'Black beans', amount: '3/4 cup' },
        { name: 'Corn tortillas', amount: '3' },
        { name: 'Smoked paprika', amount: '1/2 tsp' },
        { name: 'Cumin', amount: '1/2 tsp' },
        { name: 'Olive oil', amount: '1 tsp' },
        { name: 'Red cabbage, shredded', amount: '1 cup' },
        { name: 'Lime', amount: '1' },
        { name: 'Vegan yogurt', amount: '2 tbsp' },
        { name: 'Avocado', amount: '1/2' },
        { name: 'Coriander', amount: '2 tbsp' }
      ],
      preparation: 'Roast sweet potato with spices and oil at 200°C for 20 min. Warm tortillas. Mix yogurt with lime juice. Build tacos: sweet potato, beans, slaw, avocado, drizzle of lime crema, coriander.',
      prep_time_mins: 8, cook_time_mins: 20,
      image: IMG('sweet_potato_black_bean_tacos.png')
    },
    d_miso_tempeh_bowl: {
      slot: 'dinner',
      name: 'Miso Glazed Tempeh Bowl',
      description: 'Sticky miso-maple tempeh over brown rice with edamame, cucumber and sesame.',
      cuisine: 'Japanese',
      tags: ['high-protein', 'umami', 'gut-health'],
      base_calories: 620, protein_g: 36, carbs_g: 70, fat_g: 18, fiber_g: 12,
      ingredients: [
        { name: 'Tempeh, sliced', amount: '180g' },
        { name: 'White miso paste', amount: '1 tbsp' },
        { name: 'Maple syrup', amount: '1 tbsp' },
        { name: 'Soy sauce', amount: '1 tbsp' },
        { name: 'Rice vinegar', amount: '1 tsp' },
        { name: 'Brown rice (cooked)', amount: '3/4 cup' },
        { name: 'Edamame', amount: '1/2 cup' },
        { name: 'Cucumber, sliced', amount: '1/2' },
        { name: 'Sesame seeds', amount: '1 tsp' },
        { name: 'Spring onion', amount: '1' }
      ],
      preparation: 'Whisk miso, maple, soy and vinegar. Pan-fry tempeh 3 min each side, then add glaze and cook 2 min until sticky. Build bowl: rice, edamame, cucumber, tempeh. Top with sesame and spring onion.',
      prep_time_mins: 8, cook_time_mins: 12,
      image: IMG('miso_glazed_tempeh.png')
    },

    // ------- AM SNACKS (4) -------
    s_apple_almond: {
      slot: 'am_snack',
      name: 'Apple Slices + Almond Butter',
      description: 'Crisp apple with almond butter — fiber + healthy fats to bridge the gap to lunch.',
      cuisine: 'Modern',
      tags: ['no-cook', 'fast', 'whole-food'],
      base_calories: 160, protein_g: 4, carbs_g: 22, fat_g: 8, fiber_g: 5,
      ingredients: [
        { name: 'Apple', amount: '1 medium' },
        { name: 'Almond butter', amount: '1 tbsp' }
      ],
      preparation: 'Slice apple, dip in almond butter.',
      prep_time_mins: 2, cook_time_mins: 0,
      image: IMG('apple_slices_nut_butter.png')
    },
    s_edamame_fruit: {
      slot: 'am_snack',
      name: 'Edamame + Satsuma',
      description: 'Steamed edamame with sea salt and a juicy satsuma — protein, fiber and natural sweetness.',
      cuisine: 'Japanese',
      tags: ['high-protein', 'no-prep', 'fast'],
      base_calories: 160, protein_g: 11, carbs_g: 18, fat_g: 5, fiber_g: 6,
      ingredients: [
        { name: 'Shelled edamame', amount: '3/4 cup' },
        { name: 'Sea salt', amount: 'pinch' },
        { name: 'Satsuma or mandarin', amount: '1' }
      ],
      preparation: 'Steam or microwave edamame 2 min. Sprinkle salt. Eat with the satsuma.',
      prep_time_mins: 1, cook_time_mins: 2,
      image: IMG('edamame_fruit_snack.png')
    },
    s_tropical_shake: {
      slot: 'am_snack',
      name: 'Tropical Protein Shake',
      description: 'Mango, banana and coconut water blended with plant protein — refreshing pre-workout pick-me-up.',
      cuisine: 'Modern',
      tags: ['high-protein', 'on-the-go', 'fast'],
      base_calories: 160, protein_g: 18, carbs_g: 18, fat_g: 2, fiber_g: 3,
      ingredients: [
        { name: 'Frozen mango', amount: '1/2 cup' },
        { name: 'Banana', amount: '1/2' },
        { name: 'Vanilla plant protein', amount: '1 scoop' },
        { name: 'Coconut water', amount: '1 cup' }
      ],
      preparation: 'Blend everything until smooth. Drink immediately.',
      prep_time_mins: 3, cook_time_mins: 0,
      image: IMG('tropical_protein_shake.png')
    },
    s_trail_mix: {
      slot: 'am_snack',
      name: 'Trail Mix Cup',
      description: 'Almonds, walnuts, raisins and dark chocolate chips — small handful, big satisfaction.',
      cuisine: 'Modern',
      tags: ['no-prep', 'on-the-go', 'healthy-fats'],
      base_calories: 160, protein_g: 5, carbs_g: 15, fat_g: 10, fiber_g: 3,
      ingredients: [
        { name: 'Almonds', amount: '8' },
        { name: 'Walnuts', amount: '5 halves' },
        { name: 'Raisins', amount: '1 tbsp' },
        { name: 'Dark chocolate chips', amount: '1 tsp' }
      ],
      preparation: 'Combine in a small container. Portion ahead for the week.',
      prep_time_mins: 1, cook_time_mins: 0,
      image: IMG('nat_trail_mix.png')
    },

    // ------- PM SNACKS (4) -------
    s_energy_balls: {
      slot: 'pm_snack',
      name: 'Carrot Cake Energy Balls',
      description: 'No-bake date and walnut energy balls with carrot, oats and cinnamon — like dessert with benefits.',
      cuisine: 'Modern',
      tags: ['no-bake', 'meal-prep', 'sweet'],
      base_calories: 160, protein_g: 4, carbs_g: 22, fat_g: 7, fiber_g: 4,
      ingredients: [
        { name: 'Medjool dates, pitted', amount: '4' },
        { name: 'Walnuts', amount: '1/4 cup' },
        { name: 'Rolled oats', amount: '1/4 cup' },
        { name: 'Carrot, finely grated', amount: '2 tbsp' },
        { name: 'Cinnamon', amount: '1/2 tsp' },
        { name: 'Vanilla', amount: 'splash' }
      ],
      preparation: 'Blitz everything in a food processor until sticky. Roll into 8 balls. Chill 20 min. Store in fridge up to a week — eat 2.',
      prep_time_mins: 8, cook_time_mins: 0,
      image: IMG('carrot_cake_energy_balls.png')
    },
    s_roasted_chickpeas: {
      slot: 'pm_snack',
      name: 'Crunchy Roasted Chickpeas',
      description: 'Smoky roasted chickpeas — the salty crunch you crave, with fiber and plant protein instead of empty calories.',
      cuisine: 'Mediterranean',
      tags: ['high-fiber', 'meal-prep', 'crunchy'],
      base_calories: 160, protein_g: 8, carbs_g: 22, fat_g: 4, fiber_g: 6,
      ingredients: [
        { name: 'Chickpeas, drained + dried', amount: '3/4 cup' },
        { name: 'Olive oil', amount: '1 tsp' },
        { name: 'Smoked paprika', amount: '1/2 tsp' },
        { name: 'Garlic powder', amount: '1/4 tsp' },
        { name: 'Sea salt', amount: '1/4 tsp' }
      ],
      preparation: 'Pat chickpeas very dry. Toss with oil and spices. Roast at 200°C / 400°F for 28 min, shaking halfway. Cool to crisp up.',
      prep_time_mins: 5, cook_time_mins: 28,
      image: IMG('roasted_chickpeas_snack.png')
    },
    s_rice_cake_hummus: {
      slot: 'pm_snack',
      name: 'Rice Cakes + Hummus',
      description: 'Crisp rice cakes topped with hummus, cucumber and a sprinkle of paprika — fast, light, savoury.',
      cuisine: 'Mediterranean',
      tags: ['no-cook', 'fast', 'low-cal'],
      base_calories: 160, protein_g: 6, carbs_g: 22, fat_g: 5, fiber_g: 4,
      ingredients: [
        { name: 'Brown rice cakes', amount: '2' },
        { name: 'Hummus', amount: '2 tbsp' },
        { name: 'Cucumber, sliced', amount: '6 rounds' },
        { name: 'Smoked paprika', amount: 'pinch' }
      ],
      preparation: 'Spread hummus on rice cakes, layer cucumber, dust with paprika.',
      prep_time_mins: 2, cook_time_mins: 0,
      image: IMG('nat_rice_cakes_hummus.png')
    },
    s_choc_orange: {
      slot: 'pm_snack',
      name: 'Choc-Dipped Orange Segments',
      description: 'Juicy orange segments dipped in melted dark chocolate — the after-dinner sweet that plays nicely with your goals.',
      cuisine: 'Modern',
      tags: ['no-bake', 'sweet', 'antioxidant'],
      base_calories: 160, protein_g: 3, carbs_g: 25, fat_g: 6, fiber_g: 4,
      ingredients: [
        { name: 'Orange, segmented', amount: '1' },
        { name: 'Dark chocolate (70%+)', amount: '15g' }
      ],
      preparation: 'Melt chocolate gently. Dip half of each orange segment in chocolate. Set on parchment 10 min until firm.',
      prep_time_mins: 5, cook_time_mins: 0,
      image: IMG('choc_dipped_orange.png')
    }
  };

  // ---------------------------------------------------------------------------
  // 4-WEEK SCHEDULE
  // Built via rotation so each recipe lands ~3-4 times across 28 days.
  // ---------------------------------------------------------------------------
  const BREAKFAST_ROT = [
    'b_berry_almond_oats', 'b_avocado_toast', 'b_tofu_scramble', 'b_berry_yogurt',
    'b_green_smoothie_bowl', 'b_coconut_yogurt_granola', 'b_choc_protein_shake', 'b_pb_banana_toast'
  ];
  const LUNCH_ROT = [
    'l_med_lentil_salad', 'l_hummus_wrap', 'l_chickpea_tuna_wrap', 'l_quinoa_black_bean',
    'l_glow_bowl', 'l_roast_veggie_quinoa', 'l_mexican_bean_salad'
  ];
  const DINNER_ROT = [
    'd_lentil_bolognese', 'd_crispy_tofu_sheet', 'd_coconut_lentil_soup', 'd_thai_green_curry',
    'd_moroccan_chickpea', 'd_tempeh_chili', 'd_sweet_potato_tacos', 'd_miso_tempeh_bowl'
  ];
  const AM_SNACK_ROT = [
    's_apple_almond', 's_edamame_fruit', 's_tropical_shake', 's_trail_mix',
    's_apple_almond', 's_tropical_shake', 's_edamame_fruit'
  ];
  const PM_SNACK_ROT = [
    's_energy_balls', 's_roasted_chickpeas', 's_rice_cake_hummus', 's_choc_orange',
    's_energy_balls', 's_rice_cake_hummus', 's_roasted_chickpeas'
  ];

  // 28-day plan: builds {breakfast, am_snack, lunch, pm_snack, dinner} per day
  const SCHEDULE = [];
  for (let day = 0; day < 28; day++) {
    SCHEDULE.push({
      breakfast: BREAKFAST_ROT[day % BREAKFAST_ROT.length],
      am_snack:  AM_SNACK_ROT[day % AM_SNACK_ROT.length],
      lunch:     LUNCH_ROT[day % LUNCH_ROT.length],
      pm_snack:  PM_SNACK_ROT[day % PM_SNACK_ROT.length],
      dinner:    DINNER_ROT[day % DINNER_ROT.length]
    });
  }

  // Week themes for the 4 weeks
  const WEEK_THEMES = [
    { week_number: 1, theme: 'Reset & Foundation',
      theme_description: 'Build the habit. Whole-food, plant-based meals that feel familiar and satisfying.' },
    { week_number: 2, theme: 'Build & Energize',
      theme_description: 'Add variety. More flavors and bigger flavors — your tastebuds wake up.' },
    { week_number: 3, theme: 'Peak Performance',
      theme_description: 'Optimised macros to support training, recovery and steady energy through the day.' },
    { week_number: 4, theme: 'Sustain & Thrive',
      theme_description: 'Lock in the habits that worked. These are the meals you keep cooking after Day 30.' }
  ];

  // Slot → percentage of daily calories
  const SLOT_DISTRIBUTION = {
    breakfast: 0.25,
    am_snack:  0.08,
    lunch:     0.28,
    pm_snack:  0.08,
    dinner:    0.31
  };

  const MEAL_TIMES = {
    breakfast: '7:30 AM',
    am_snack:  '10:30 AM',
    lunch:     '12:30 PM',
    pm_snack:  '3:30 PM',
    dinner:    '6:30 PM'
  };

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  window.VEGAN_CHALLENGE_MEAL_PLAN = {
    RECIPES,
    SCHEDULE,
    WEEK_THEMES,
    SLOT_DISTRIBUTION,
    MEAL_TIMES,
    DAY_NAMES,
    PLAN_NAME: '30-Day Plant-Based Meal Plan',
    PLAN_DESCRIPTION: 'Your tailored 4-week vegan meal plan — designed for your calorie and macro goals.'
  };
})();
