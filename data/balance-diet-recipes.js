/* Recipe quantities are edible grams. Nutrition is calculated separately from AFCD records. */
(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;if(root)root.BALANCE_DIET_RECIPES=data;})(typeof window!=='undefined'?window:globalThis,function(){
  const recipes = {};
  function add(id, slots, name, portions, method, cuisine='Modern Australian') {
    recipes[id] = {id, slots:slots.split(','), slot:slots.split(',')[0], name, ingredients:Object.entries(portions).map(([food_id,grams])=>({food_id,grams})), preparation:method, cuisine,
      image:'images/meals/diets-v3/'+id+'.jpg', prep_time_mins:10, cook_time_mins:20,
      description:'Measured ingredients with nutrition calculated from Australian food data.'};
  }
  add('berry-rice-porridge','breakfast','Strawberry Chia Rice Porridge',{rice:220,strawberry:50,chia:12,hemp:15,cinnamon:1,water:150},
    '1. Place the cooked rice, water and cinnamon in a saucepan. Simmer gently for 5 minutes, stirring until creamy. 2. Stir in the chia and hemp seeds and stand for 5 minutes to thicken. 3. Slice the measured strawberries and arrange over the porridge.');
  add('kiwi-quinoa-bowl','breakfast','Kiwi and Pepita Quinoa Bowl',{quinoa:155,kiwi:70,pumpkin_seed:15,hemp:15,chia:8,cinnamon:1,water:100},
    '1. Warm the cooked quinoa with water and cinnamon over low heat for 4 minutes. 2. Stir in chia and hemp seeds and stand for 3 minutes. 3. Spoon into a bowl and top with sliced kiwi and pumpkin seeds.');
  add('egg-potato-hash','breakfast','Egg and Potato Breakfast Hash',{egg:120,potato:180,spinach:40,tomato:40,oil:10,parsley:3,pepper:0.3},
    '1. Dice the raw potato into 1 cm pieces and simmer in water for 10 minutes until just tender, then drain. 2. Heat the measured oil in a pan over medium heat and fry the potato for 6 minutes until golden. 3. Add chopped tomato and spinach, then crack in the weighed eggs. Cover and cook gently until the whites and yolks are set. Finish with parsley and pepper.');
  add('spinach-herb-omelette','breakfast,lunch,dinner','Spinach and Herb Omelette',{egg:150,egg_white:100,spinach:40,tomato:40,oil:15,parsley:3,pepper:0.3},
    '1. Whisk the weighed whole eggs and egg whites with pepper and chopped parsley. 2. Warm the measured oil in a non-stick pan over medium-low heat. Wilt the spinach for 1 minute, then pour in the eggs. 3. Cook gently for 4 to 6 minutes until fully set, fold, and serve with sliced tomato.');
  add('turmeric-tofu-scramble','breakfast,lunch','Turmeric Tofu and Potato Scramble',{tofu:170,potato:180,spinach:40,tomato:40,oil:10,turmeric:1,parsley:3,pepper:0.3},
    '1. Dice the raw potato and simmer for 10 minutes until tender; drain. 2. Heat the measured oil in a pan over medium heat and cook the potato for 5 minutes. Crumble in the drained tofu and add turmeric and pepper. 3. Cook for 5 minutes, then fold through spinach and chopped tomato until hot. Finish with parsley.');
  add('berry-seed-cup','am_snack,pm_snack','Strawberry and Seed Cup',{strawberry:50,pumpkin_seed:15,hemp:15,chia:8,cinnamon:0.5,water:60},
    '1. Stir chia, hemp seeds, cinnamon and water together and refrigerate for 20 minutes until thick. 2. Add chopped strawberries and pumpkin seeds just before serving.');
  add('orange-pepita-box','am_snack,pm_snack','Orange and Pepita Snack Box',{orange:100,pumpkin_seed:15,hemp:15,cinnamon:0.5},
    '1. Peel and weigh the orange flesh, then separate into segments. 2. Pack with unsalted pumpkin and hemp seeds and a light dusting of cinnamon.');
  add('kiwi-seed-cup','am_snack,pm_snack','Kiwi Chia Seed Cup',{kiwi:70,chia:12,hemp:15,pumpkin_seed:10,water:70},
    '1. Stir chia and hemp seeds into the water; refrigerate for 20 minutes until thickened. 2. Peel and weigh the kiwi, chop it and spoon over the chia cup with pumpkin seeds.');
  add('yoghurt-berries','breakfast,am_snack,pm_snack','Natural Yoghurt with Strawberries and Seeds',{yogurt:200,strawberry:50,chia:10,pumpkin_seed:15,cinnamon:0.5},
    '1. Spoon the unsweetened natural yoghurt into a bowl and stir through chia and cinnamon. 2. Top with weighed chopped strawberries and unsalted pumpkin seeds.');
  add('eggs-cucumber-box','am_snack,pm_snack','Egg and Cucumber Snack Box',{boiled_egg:110,cucumber:60,oil:5,lemon:5,dill:2,pepper:0.2},
    '1. Hard-boil eggs for 10 to 12 minutes and cool promptly. Peel, then weigh the listed cooked edible portion. 2. Halve and serve with cucumber; drizzle with measured oil and lemon, then add dill and pepper.');
  add('chicken-lettuce-cups','breakfast,am_snack,pm_snack,lunch,dinner','Lemon Chicken Lettuce Cups',{chicken:150,lettuce:60,cucumber:60,oil:18,lemon:10,parsley:3,pepper:0.3},
    '1. Slice the raw chicken. Heat half the oil in a pan over medium heat and cook for 6 to 8 minutes, turning, until the centre reaches 75°C. 2. Chop cucumber and parsley and mix with lemon and remaining measured oil. 3. Spoon chicken and cucumber into washed lettuce leaves and season with pepper.');
  add('salmon-cucumber-plate','breakfast,am_snack,pm_snack,lunch,dinner','Dill Salmon and Cucumber Plate',{salmon:140,cucumber:60,lettuce:40,oil:10,lemon:10,dill:3,pepper:0.3},
    '1. Place the raw salmon on a lined tray, brush with half the oil and season with pepper. Bake at 200°C for 12 to 15 minutes until the centre reaches 63°C. 2. Slice cucumber and dress with lemon, dill and the remaining oil. 3. Serve salmon with the cucumber and lettuce.');
  add('salmon-quinoa-bowl','lunch,dinner','Lemon Salmon and Quinoa Bowl',{salmon:160,quinoa:155,carrot:75,zucchini:40,spinach:40,oil:10,lemon:10,dill:3,pepper:0.3},
    '1. Dice carrot and zucchini and roast with half the oil at 200°C for 10 minutes. 2. Add the raw salmon to the tray and bake for 12 to 15 minutes more until its centre reaches 63°C. 3. Warm the cooked quinoa. Wilt spinach into it, add the vegetables and salmon, and finish with lemon, dill, pepper and remaining oil.','Mediterranean');
  add('salmon-potato-tray','lunch,dinner','Salmon and Rosemary Potato Tray Bake',{salmon:160,potato:220,carrot:75,spinach:40,oil:12,lemon:10,rosemary:1,pepper:0.3},
    '1. Cut potato and carrot into small pieces. Toss with half the oil and rosemary and roast at 210°C for 20 minutes. 2. Add the raw salmon and roast for another 12 to 15 minutes until its centre reaches 63°C and the potato is tender. 3. Wilt spinach into the hot vegetables and finish with lemon, remaining measured oil and pepper.','Mediterranean');
  add('ginger-salmon-rice','lunch,dinner','Ginger Salmon Rice Bowl',{salmon:160,rice:210,carrot:75,zucchini:40,spinach:40,oil:10,lime:10,ginger:4,pepper:0.3},
    '1. Brush salmon with half the measured oil and bake at 200°C for 12 to 15 minutes until its centre reaches 63°C. 2. Stir-fry finely sliced carrot, zucchini and ginger with the remaining oil over medium heat for 6 minutes; add spinach until wilted. 3. Serve over hot cooked rice with the salmon, lime juice and pepper.','Asian inspired');
  add('chicken-quinoa-bowl','lunch,dinner','Lemon Chicken Quinoa Bowl',{chicken:170,quinoa:155,carrot:75,zucchini:40,spinach:40,oil:15,lemon:10,oregano:1,pepper:0.3},
    '1. Dice carrot and zucchini and roast with half the oil and oregano at 210°C for 18 minutes. 2. Slice chicken and pan-fry in the remaining oil over medium heat for 6 to 8 minutes until its centre reaches 75°C. 3. Toss the vegetables, chicken and hot cooked quinoa with spinach, lemon and pepper.','Mediterranean');
  add('chicken-potato-tray','lunch,dinner','Rosemary Chicken and Potato Tray Bake',{chicken:170,potato:250,carrot:75,zucchini:40,oil:15,lemon:10,rosemary:1,pepper:0.3},
    '1. Cut potato and carrot into small pieces, toss with half the oil and rosemary and roast at 210°C for 20 minutes. 2. Add sliced raw chicken and zucchini with the remaining oil. Roast for another 15 to 20 minutes until the chicken centre reaches 75°C and potato is tender. 3. Add lemon and pepper and serve hot.');
  add('beef-rice-bowl','lunch,dinner','Ginger Beef and Rice Bowl',{beef:170,rice:210,carrot:75,zucchini:40,spinach:40,oil:12,lime:10,ginger:4,pepper:0.3},
    '1. Slice the raw beef into thin strips. Stir-fry in half the measured oil over medium-high heat until cooked through, then remove. 2. Cook sliced carrot, zucchini and ginger in the remaining oil for 6 minutes; add spinach to wilt. 3. Return the beef and juices to the pan, heat through and serve with hot cooked rice, lime and pepper.');
  add('chicken-greens','breakfast,lunch,dinner','Herb Chicken with Green Vegetables',{chicken:170,zucchini:40,spinach:50,cucumber:60,oil:25,lemon:10,oregano:1,pepper:0.3},
    '1. Slice the raw chicken and pan-fry with half the oil and oregano over medium heat for 6 to 8 minutes until the centre reaches 75°C. 2. Saute sliced zucchini in the same pan for 4 minutes and stir in spinach until wilted. 3. Serve with cucumber, lemon, pepper and the remaining measured oil as a dressing.');
  add('salmon-greens','lunch,dinner','Lemon Salmon with Green Vegetables',{salmon:170,zucchini:40,spinach:50,cucumber:60,oil:22,lemon:10,dill:3,pepper:0.3},
    '1. Bake the raw salmon with half the oil and pepper at 200°C for 12 to 15 minutes until the centre reaches 63°C. 2. Saute zucchini for 4 minutes and wilt spinach into it, using some of the remaining oil. 3. Serve with cucumber, lemon, dill and the rest of the measured oil as a dressing.','Mediterranean');
  add('tofu-quinoa-bowl','lunch,dinner','Crispy Tofu Quinoa Bowl',{tofu:170,quinoa:155,carrot:75,zucchini:40,spinach:40,oil:12,lemon:10,oregano:1,pepper:0.3},
    '1. Pat the drained firm tofu dry and cut into cubes. Roast with half the oil at 210°C for 20 minutes, turning halfway. 2. Roast diced carrot and zucchini with remaining oil and oregano for 18 minutes. 3. Toss with hot cooked quinoa, spinach, lemon and pepper and top with tofu.');
  add('chickpea-quinoa-salad','lunch,dinner','Chickpea Quinoa and Pepita Salad',{chickpea:150,quinoa:155,carrot:75,cucumber:60,spinach:40,pumpkin_seed:15,oil:10,lemon:10,parsley:3,pepper:0.3},
    '1. Drain and rinse canned chickpeas and weigh the drained portion. Warm the cooked quinoa if desired. 2. Grate carrot, chop cucumber and parsley, and combine with spinach, chickpeas and quinoa. 3. Dress with all the measured oil, lemon and pepper and scatter with pumpkin seeds.','Mediterranean');
  add('lentil-potato-bowl','lunch,dinner','Lentil and Rosemary Potato Bowl',{lentil:200,potato:200,carrot:75,spinach:40,pumpkin_seed:15,oil:12,lemon:10,rosemary:1,pepper:0.3},
    '1. Cut potato and carrot into small pieces and roast with half the measured oil and rosemary at 210°C for 25 minutes until tender. 2. Warm the weighed cooked lentils with a splash of water and fold through spinach until wilted. 3. Top with roast vegetables and pumpkin seeds, then dress with remaining oil, lemon and pepper.','Mediterranean');
  add('quinoa-pepita-bowl','lunch,dinner','Quinoa and Pepita Vegetable Bowl',{quinoa:155,pumpkin_seed:15,hemp:15,carrot:75,zucchini:40,spinach:40,oil:15,lemon:10,parsley:3,pepper:0.3},
    '1. Roast diced carrot and zucchini with half the measured oil at 210°C for 18 minutes until tender. 2. Warm cooked quinoa and fold through spinach until wilted. 3. Add roast vegetables, pumpkin and hemp seeds, parsley, lemon, pepper and the remaining measured oil.','Mediterranean');
  const cookingMinutes = [5,4,22,8,20,0,0,0,0,12,8,15,25,35,15,18,40,12,12,15,20,0,25,18];
  Object.values(recipes).forEach((recipe,index) => { recipe.cook_time_mins=cookingMinutes[index]; recipe.prep_time_mins=recipe.slot.includes('snack')?5:10; });
  return recipes;
});
