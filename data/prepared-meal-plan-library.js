/**
 * Balance prepared meal-plan library v2.
 *
 * 96 UI selections normalize to 80 templates because dairy-free is implicit
 * for vegan plans. Every template contains three daily menus: Mon-Wed,
 * Thu-Fri and Sat-Sun. Recipes are shared rather than copied into templates.
 *
 * Vegan and vegetarian plans use the plant-based bank. Omnivore plans use
 * meat-based lunches and dinners while retaining the selected restrictions.
 */
(function (root, factory) {
  const library = factory();
  if (typeof module === 'object' && module.exports) module.exports = library;
  if (root) root.BALANCE_PREPARED_MEAL_LIBRARY = library;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const STYLES = ['vegan', 'vegetarian', 'omnivore'];
  const RESTRICTIONS = ['gluten_free', 'dairy_free', 'nut_free', 'soy_free', 'low_fodmap'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const TIMES = { breakfast: '7:30 AM', am_snack: '10:30 AM', lunch: '1:00 PM', pm_snack: '4:00 PM', dinner: '7:00 PM' };
  const ALL_SAFE = ['vegan', 'vegetarian', 'omnivore', ...RESTRICTIONS];

  const ingredient = (name, amount, scalable = true) => ({ name, amount, scalable });
  const recipe = (id, slot, name, image, calories, protein, carbs, fat, ingredients, preparation, cuisine) => ({
    id, slot, name, image, base_calories: calories, protein_g: protein, carbs_g: carbs,
    fat_g: fat, fiber_g: Math.max(3, Math.round(carbs / 8)), ingredients, preparation,
    prep_time_mins: slot.includes('snack') ? 5 : 10,
    cook_time_mins: ['lunch', 'dinner'].includes(slot) ? 20 : 5,
    cuisine: cuisine || 'Australian', compatibility: ALL_SAFE.slice(),
    tags: ['prepared-library', 'gluten-free', 'dairy-free', 'nut-free', 'soy-free', 'low-FODMAP'],
    description: 'A pre-reviewed Balance meal with measured low-FODMAP ingredients and no gluten, dairy, nuts or soy.'
  });
  const omnivoreRecipe = (...args) => {
    const result = recipe(...args);
    result.compatibility = ['omnivore', ...RESTRICTIONS];
    result.tags = ['prepared-library', 'omnivore', 'gluten-free', 'dairy-free', 'nut-free', 'soy-free', 'low-FODMAP'];
    result.description = 'A pre-reviewed Balance omnivore meal with lean animal protein and measured ingredients.';
    return result;
  };

  // `scalable:false` protects ingredients with recognised low-FODMAP serving
  // limits. Calories are adjusted with rice, quinoa, potato, oil and rice
  // protein instead, preserving both the meal identity and the safe serving.
  const RECIPES = {
    b1: recipe('b1','breakfast','Strawberry Rice-Protein Overnight Oats','images/meals/baked_raspberry_almond_oats.png',500,28,67,13,[ingredient('certified gluten-free rolled oats','60 g'),ingredient('unsweetened rice milk','220 ml'),ingredient('rice protein isolate','30 g'),ingredient('strawberries, sliced','65 g',false),ingredient('chia seeds','10 g',false),ingredient('maple syrup','2 tsp',false),ingredient('ground cinnamon','1/2 tsp',false),ingredient('iodised salt','1 pinch',false)],'1. Stir the oats, rice milk, rice protein, chia, cinnamon and salt until smooth. 2. Refrigerate covered for at least 4 hours. 3. Top with the measured strawberries and maple syrup before serving.','Modern Australian'),
    b2: recipe('b2','breakfast','Kiwi Quinoa Breakfast Bowl','images/meals/green_smoothie_bowl.png',500,27,69,12,[ingredient('cooked quinoa','180 g'),ingredient('unsweetened rice milk','180 ml'),ingredient('rice protein isolate','30 g'),ingredient('kiwifruit, peeled and sliced','1 medium',false),ingredient('pumpkin seeds','15 g',false),ingredient('maple syrup','2 tsp',false),ingredient('ground cinnamon','1/2 tsp',false),ingredient('iodised salt','1 pinch',false)],'1. Warm the quinoa and rice milk over low heat for 4 minutes. 2. Whisk in the rice protein, cinnamon and salt off the heat. 3. Spoon into a bowl and finish with kiwi, pumpkin seeds and maple syrup.','Modern Australian'),
    b3: recipe('b3','breakfast','Chocolate Strawberry Protein Smoothie Bowl','images/meals/chocolate_banana_protein_shake.png',500,31,66,12,[ingredient('unsweetened rice milk','300 ml'),ingredient('rice protein isolate','35 g'),ingredient('strawberries, frozen','65 g',false),ingredient('firm unripe banana','80 g',false),ingredient('certified gluten-free oats','45 g'),ingredient('cocoa powder','2 tsp',false),ingredient('chia seeds','10 g',false),ingredient('ice','1 cup',false)],'1. Blend the rice milk, rice protein, strawberries, banana, oats, cocoa and ice until thick. 2. Add a splash of water only if needed to turn the blades. 3. Pour into a bowl and scatter with chia seeds.','Modern Australian'),
    s1: recipe('s1','am_snack','Orange, Rice Crackers & Pepita Protein Dip','images/meals/choc_dipped_orange.png',200,12,28,6,[ingredient('orange','1 medium',false),ingredient('plain certified gluten-free rice crackers','4'),ingredient('rice protein isolate','15 g'),ingredient('pumpkin seed butter','1 tbsp',false),ingredient('water','1 tbsp',false),ingredient('ground cinnamon','1/4 tsp',false)],'1. Stir the rice protein, pumpkin seed butter, water and cinnamon into a smooth dip. 2. Peel the orange and serve its segments with the rice crackers and dip.','Modern Australian'),
    s2: recipe('s2','am_snack','Strawberry Chia Rice-Yoghurt Cup','images/meals/berry_protein_yogurt.png',200,13,27,5,[ingredient('plain rice-based yoghurt','140 g'),ingredient('rice protein isolate','15 g'),ingredient('strawberries, sliced','65 g',false),ingredient('chia seeds','8 g',false),ingredient('maple syrup','1 tsp',false),ingredient('vanilla extract','1/4 tsp',false)],'1. Stir the rice yoghurt, protein, maple syrup and vanilla until smooth. 2. Top with the measured strawberries and chia seeds.','Modern Australian'),
    s3: recipe('s3','am_snack','Grape, Pepita & Rice-Cracker Snack Box','images/meals/nat_trail_mix.png',200,10,27,7,[ingredient('green grapes','75 g',false),ingredient('roasted pumpkin seeds','20 g',false),ingredient('plain certified gluten-free rice crackers','3'),ingredient('rice protein isolate','10 g'),ingredient('water','1 tbsp',false),ingredient('smoked paprika','1/8 tsp',false)],'1. Stir the rice protein, water and paprika into a thick savoury dip. 2. Pack with the measured grapes, pumpkin seeds and rice crackers.','Modern Australian'),
    l1: recipe('l1','lunch','Lemon Quinoa Roast Vegetable Bowl','images/meals/roast_veggie_quinoa_salad.png',550,30,72,16,[ingredient('cooked quinoa','210 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('red capsicum, diced','75 g',false),ingredient('zucchini, diced','65 g',false),ingredient('carrot, diced','70 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused olive oil','1 tbsp'),ingredient('lemon juice','1 tbsp',false),ingredient('pumpkin seeds','15 g',false),ingredient('dried oregano','1/2 tsp',false)],'1. Roast capsicum, zucchini and carrot with half the infused oil and oregano at 210°C for 18 minutes. 2. Whisk the rice protein with lemon juice, remaining oil and 2 tablespoons water. 3. Toss quinoa, vegetables and spinach with the dressing, then add pumpkin seeds.','Mediterranean'),
    l2: recipe('l2','lunch','Crispy Potato, Spinach & Pepita Salad','images/meals/glow_bowl.png',550,27,75,17,[ingredient('baby potatoes, quartered','300 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('baby spinach','50 g',false),ingredient('cucumber, sliced','75 g',false),ingredient('cherry tomatoes','75 g',false),ingredient('pumpkin seeds','20 g',false),ingredient('garlic-infused olive oil','1 tbsp'),ingredient('lemon juice','1 tbsp',false),ingredient('Dijon mustard, gluten-free','1 tsp',false),ingredient('smoked paprika','1/2 tsp',false)],'1. Roast potatoes with half the oil and paprika at 210°C for 22 minutes until crisp. 2. Whisk rice protein, lemon, mustard, remaining oil and 2 tablespoons water into a dressing. 3. Toss spinach, cucumber and tomato with the potatoes and dressing; finish with pumpkin seeds.','Modern Australian'),
    l3: recipe('l3','lunch','Ginger Rice Noodle Rainbow Bowl','images/meals/quinoa_black_bean_salad.png',550,28,79,13,[ingredient('dry rice noodles','90 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('carrot, julienned','70 g',false),ingredient('cucumber, julienned','75 g',false),ingredient('red capsicum, sliced','75 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused sesame oil','2 tsp'),ingredient('lime juice','1 tbsp',false),ingredient('fresh ginger, grated','1 tsp',false),ingredient('pumpkin seeds','15 g',false)],'1. Cook rice noodles according to the packet, rinse and drain. 2. Whisk rice protein, lime, ginger, infused oil and 3 tablespoons water until smooth. 3. Toss noodles with the vegetables and dressing, then scatter over pumpkin seeds.','Asian inspired'),
    s4: recipe('s4','pm_snack','Kiwi Protein Shake','images/meals/tropical_protein_shake.png',200,18,27,3,[ingredient('unsweetened rice milk','250 ml'),ingredient('rice protein isolate','20 g'),ingredient('kiwifruit','1 medium',false),ingredient('maple syrup','1 tsp',false),ingredient('lime juice','1 tsp',false),ingredient('ice','1 cup',false)],'1. Blend all ingredients for 45 seconds until completely smooth. 2. Pour immediately and serve cold.','Modern Australian'),
    s5: recipe('s5','pm_snack','Cocoa Strawberry Protein Shake','images/meals/chocolate_banana_protein_shake.png',200,19,24,3,[ingredient('unsweetened rice milk','250 ml'),ingredient('rice protein isolate','20 g'),ingredient('strawberries','65 g',false),ingredient('cocoa powder','1 tsp',false),ingredient('maple syrup','1 tsp',false),ingredient('ice','1 cup',false)],'1. Blend every ingredient for 45 seconds until smooth. 2. Pour immediately and serve cold.','Modern Australian'),
    s6: recipe('s6','pm_snack','Paprika Pepitas, Grapes & Rice Crackers','images/meals/roasted_chickpeas_snack.png',200,9,26,8,[ingredient('pumpkin seeds','25 g',false),ingredient('green grapes','75 g',false),ingredient('plain certified gluten-free rice crackers','3'),ingredient('garlic-infused olive oil','1/2 tsp'),ingredient('smoked paprika','1/4 tsp',false),ingredient('iodised salt','1 pinch',false)],'1. Toss pumpkin seeds with infused oil, paprika and salt, then toast in a dry pan for 2 minutes. 2. Cool and serve with the measured grapes and rice crackers.','Modern Australian'),
    d1: recipe('d1','dinner','Herbed Potato Quinoa Tray Bake','images/meals/crispy_tofu_sheet_pan.png',550,29,76,16,[ingredient('baby potatoes, halved','240 g'),ingredient('cooked quinoa','150 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('zucchini, chopped','65 g',false),ingredient('red capsicum, chopped','75 g',false),ingredient('carrot, chopped','70 g',false),ingredient('garlic-infused olive oil','1 tbsp'),ingredient('lemon juice','1 tbsp',false),ingredient('dried rosemary','1/2 tsp',false),ingredient('baby spinach','40 g',false)],'1. Roast potato, zucchini, capsicum and carrot with infused oil and rosemary at 210°C for 24 minutes. 2. Whisk rice protein with lemon and 3 tablespoons water. 3. Fold hot vegetables through quinoa and spinach, then spoon over the savoury lemon dressing.','Mediterranean'),
    d2: recipe('d2','dinner','Smoky Quinoa Stuffed Capsicum','images/meals/sweet_potato_black_bean_tacos.png',550,30,75,15,[ingredient('red capsicum, halved and deseeded','1 medium',false),ingredient('cooked quinoa','220 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('chopped tomatoes, no onion or garlic','75 g',false),ingredient('baby spinach, chopped','40 g',false),ingredient('garlic-infused olive oil','1 tbsp'),ingredient('pumpkin seeds','15 g',false),ingredient('smoked paprika','1 tsp',false),ingredient('ground cumin','1/2 tsp',false),ingredient('lime juice','1 tbsp',false)],'1. Roast capsicum halves cut-side up at 200°C for 12 minutes. 2. Mix quinoa, rice protein, tomatoes, spinach, oil, spices and 3 tablespoons water; fill the capsicum. 3. Bake 12 minutes more, then finish with lime and pumpkin seeds.','Mexican inspired'),
    d3: recipe('d3','dinner','Golden Ginger Rice & Vegetable Bowl','images/meals/thai_green_curry_tofu.png',550,27,83,12,[ingredient('cooked basmati rice','260 g'),ingredient('rice protein isolate, unflavoured','25 g'),ingredient('carrot, sliced','70 g',false),ingredient('zucchini, sliced','65 g',false),ingredient('red capsicum, sliced','75 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('fresh ginger, grated','1 tsp',false),ingredient('ground turmeric','1/2 tsp',false),ingredient('lime juice','1 tbsp',false)],'1. Stir-fry carrot, zucchini and capsicum in infused oil over medium-high heat for 6 minutes. 2. Whisk rice protein with ginger, turmeric, lime and 4 tablespoons water; add and simmer for 2 minutes. 3. Fold through spinach and serve over hot basmati rice.','Asian inspired'),
    ol1: omnivoreRecipe('ol1','lunch','Lemon Herb Chicken Quinoa Bowl','images/meals/prepared-v2/omnivore-chicken-quinoa.jpg',550,43,60,15,[ingredient('skinless chicken breast','170 g'),ingredient('cooked quinoa','180 g'),ingredient('red capsicum, diced','75 g',false),ingredient('zucchini, diced','65 g',false),ingredient('carrot, diced','70 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('lemon juice','1 tbsp',false),ingredient('dried oregano','1/2 tsp',false)],'1. Season and pan-sear the chicken until cooked through, then rest and slice. 2. Roast the capsicum, zucchini and carrot with half the oil. 3. Toss with quinoa, spinach, lemon and remaining oil, then top with chicken.','Mediterranean'),
    ol2: omnivoreRecipe('ol2','lunch','Baked Salmon & Crispy Potato Salad','images/meals/prepared-v2/omnivore-salmon-potato.jpg',550,39,52,21,[ingredient('skin-on salmon fillet','170 g'),ingredient('baby potatoes, quartered','260 g'),ingredient('cucumber, sliced','75 g',false),ingredient('cherry tomatoes','75 g',false),ingredient('baby spinach','50 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('lemon juice','1 tbsp',false),ingredient('fresh dill','1 tbsp',false)],'1. Roast the potatoes with half the oil at 210°C until crisp. 2. Bake the salmon beside them until just cooked. 3. Toss spinach, cucumber and tomato with lemon and remaining oil, then serve with salmon and potatoes.','Modern Australian'),
    ol3: omnivoreRecipe('ol3','lunch','Ginger Turkey Rice Noodle Bowl','images/meals/prepared-v2/omnivore-turkey-noodles.jpg',550,42,65,13,[ingredient('lean turkey mince','170 g'),ingredient('dry rice noodles','75 g'),ingredient('carrot, julienned','70 g',false),ingredient('cucumber, julienned','75 g',false),ingredient('red capsicum, sliced','75 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused sesame oil','2 tsp'),ingredient('fresh ginger, grated','1 tsp',false),ingredient('lime juice','1 tbsp',false)],'1. Cook and drain the rice noodles. 2. Brown the turkey in infused oil with ginger until cooked through. 3. Toss with noodles, vegetables and lime juice.','Asian inspired'),
    od1: omnivoreRecipe('od1','dinner','Lean Beef, Quinoa & Roast Vegetable Plate','images/meals/prepared-v2/omnivore-beef-roast.jpg',550,43,55,17,[ingredient('lean beef strips','170 g'),ingredient('cooked quinoa','140 g'),ingredient('baby potatoes, halved','160 g'),ingredient('zucchini, chopped','65 g',false),ingredient('red capsicum, chopped','75 g',false),ingredient('carrot, chopped','70 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('dried rosemary','1/2 tsp',false)],'1. Roast the potato and vegetables with half the oil and rosemary. 2. Sear the beef in the remaining oil until cooked to your liking. 3. Serve the sliced beef with quinoa and roasted vegetables.','Modern Australian'),
    od2: omnivoreRecipe('od2','dinner','Ginger Pork Rice Bowl','images/meals/prepared-v2/omnivore-pork-rice.jpg',550,42,68,12,[ingredient('pork tenderloin, sliced','170 g'),ingredient('cooked basmati rice','220 g'),ingredient('carrot, sliced','70 g',false),ingredient('zucchini, sliced','65 g',false),ingredient('red capsicum, sliced','75 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('fresh ginger, grated','1 tsp',false),ingredient('lime juice','1 tbsp',false)],'1. Sear the pork in infused oil with ginger until cooked through. 2. Stir-fry the carrot, zucchini and capsicum until tender-crisp. 3. Fold through spinach and lime, then serve over rice.','Asian inspired'),
    od3: omnivoreRecipe('od3','dinner','Golden Paprika Chicken & Rice Bowl','images/meals/prepared-v2/omnivore-chicken-rice.jpg',550,44,67,12,[ingredient('skinless chicken breast','180 g'),ingredient('cooked basmati rice','220 g'),ingredient('carrot, sliced','70 g',false),ingredient('zucchini, sliced','65 g',false),ingredient('red capsicum, sliced','75 g',false),ingredient('baby spinach','40 g',false),ingredient('garlic-infused olive oil','2 tsp'),ingredient('smoked paprika','1 tsp',false),ingredient('lemon juice','1 tbsp',false)],'1. Coat the chicken with paprika and half the oil, then pan-sear until cooked through. 2. Sauté the vegetables in the remaining oil and fold through spinach. 3. Serve the sliced chicken and vegetables over rice with lemon.','Modern Australian')
  };

  Object.entries({
    b1:'b1.jpg', b2:'b2.jpg', b3:'b3.jpg', s1:'s1.jpg', s2:'s2.jpg', s3:'s3.jpg',
    l1:'l1.jpg', l2:'l2.jpg', l3:'l3.jpg', s4:'s4.jpg', s5:'s5.jpg', s6:'s6.jpg',
    d1:'d1.jpg', d2:'d2.jpg', d3:'d3.jpg'
  }).forEach(([id, file]) => { RECIPES[id].image = `images/meals/prepared-v1/${file}`; });
  RECIPES.s1.ingredients.find(item => item.name.includes('rice crackers')).amount = '3';
  RECIPES.d2.ingredients.find(item => item.name.includes('chopped tomatoes')).name = 'plain chopped tomatoes';

  const SLOT_POOLS = {
    breakfast: ['b1','b2','b3'], am_snack: ['s1','s2','s3'],
    lunch: ['l1','l2','l3'], pm_snack: ['s4','s5','s6'], dinner: ['d1','d2','d3']
  };
  const OMNIVORE_SLOT_POOLS = {
    lunch: ['ol1','ol2','ol3'], dinner: ['od1','od2','od3']
  };

  function normalizeSelection(input) {
    const values = Array.isArray(input) ? input : input?.dietary_requirements || [];
    const set = new Set(values.map(v => String(v || '').toLowerCase()));
    let style = STYLES.find(value => set.has(value))
      || (set.has('pescatarian') ? 'pescatarian' : String(input?.diet_type || '').toLowerCase());
    // Pescatarians can safely use the vegetarian bank until a dedicated fish
    // bank is available. Never silently give them chicken, beef or pork.
    if (style === 'pescatarian') style = 'vegetarian';
    if (!STYLES.includes(style)) style = 'omnivore';
    const restrictions = RESTRICTIONS.filter(value => set.has(value));
    if (style === 'vegan') {
      const dairyIndex = restrictions.indexOf('dairy_free');
      if (dairyIndex >= 0) restrictions.splice(dairyIndex, 1);
    }
    return { style, restrictions, key: [style, ...restrictions].join('+') };
  }

  function allTemplates() {
    const templates = [];
    STYLES.forEach(style => {
      const effectiveRestrictions = style === 'vegan' ? RESTRICTIONS.filter(r => r !== 'dairy_free') : RESTRICTIONS;
      for (let mask = 0; mask < (1 << effectiveRestrictions.length); mask++) {
        const restrictions = effectiveRestrictions.filter((_, bit) => mask & (1 << bit));
        const key = [style, ...RESTRICTIONS.filter(r => restrictions.includes(r))].join('+');
        const seed = templates.length;
        const menus = [0, 1, 2].map(menuIndex => {
          const slots = {};
          Object.entries(SLOT_POOLS).forEach(([slot, ids], slotIndex) => {
            const styleIds = style === 'omnivore' && OMNIVORE_SLOT_POOLS[slot]
              ? OMNIVORE_SLOT_POOLS[slot]
              : ids;
            slots[slot] = styleIds[(seed + menuIndex + slotIndex) % styleIds.length];
          });
          return slots;
        });
        templates.push({ id: `prepared-${String(templates.length + 1).padStart(2, '0')}`, key, style, restrictions, menus });
      }
    });
    return templates;
  }

  const TEMPLATES = allTemplates();
  const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map(template => [template.key, template]));
  function selectTemplate(input) { return TEMPLATE_BY_KEY[normalizeSelection(input).key] || TEMPLATE_BY_KEY.omnivore; }

  function expandTemplate(template) {
    return DAYS.map((dayName, dayIndex) => {
      const menu = dayIndex <= 2 ? template.menus[0] : dayIndex <= 4 ? template.menus[1] : template.menus[2];
      return {
        day_of_week: dayIndex, day_name: dayName,
        meals: Object.keys(TIMES).map(slot => ({ meal_slot: slot, meal_time: TIMES[slot], recipe_id: menu[slot] }))
      };
    });
  }

  return {
    VERSION: 2, STYLES, RESTRICTIONS, RECIPES, TEMPLATES,
    RAW_SELECTION_COUNT: 96, NORMALIZED_TEMPLATE_COUNT: 80,
    DAILY_MENU_COUNT: 240, MEAL_PLACEMENT_COUNT: 1200,
    normalizeSelection, selectTemplate, expandTemplate
  };
});
