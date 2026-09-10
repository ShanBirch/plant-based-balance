const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../lib/prepared-diet-engine.js');
const shopping = require('../lib/meal-plan-shopping-list.js');

function checkPlan(style, target, restrictions = []) {
  const plan = engine.buildPlan({calorie_goal: target}, {dietary_requirements: [style, ...restrictions]});
  assert.equal(plan.diet_type, style);
  assert.equal(plan.weeks[0].days.length, 7);
  const selected = engine.normalizeSelection({dietary_requirements: [style, ...restrictions]});
  for (const day of plan.weeks[0].days) {
    assert.equal(day.meals.length, 5);
    const ingredients = day.meals.flatMap(m => m.ingredients);
    const actual = engine.nutrition(ingredients);
    assert.ok(Math.abs(actual.calories - target) <= target * .05, style + ' ' + target);
    if (style === 'keto') {
      assert.ok(actual.carbs_g <= 30);
      assert.ok(actual.fat_g * 9 / actual.calories >= .6);
      assert.ok(actual.fat_g * 9 / actual.calories <= .8);
    }
    if (restrictions.includes('low_sodium')) assert.ok(actual.sodium_mg <= 1500);
    for (const meal of day.meals) {
      assert.ok(engine.compatible(engine.RECIPES[meal.recipe_id], selected), meal.name);
      const expected = engine.nutrition(meal.ingredients);
      assert.ok(Math.abs(meal.calories - expected.calories) <= .501);
      for (const key of ['protein_g','fat_g','carbs_g','fiber_g']) assert.ok(Math.abs(meal[key] - expected[key]) <= .051);
      assert.ok(fs.existsSync(path.join(__dirname, '..', meal.image_url)));
      for (const ingredient of meal.ingredients) {
        assert.equal(ingredient.amount, ingredient.grams + ' g');
        assert.match(ingredient.nutrition_source, /^F\d+/);
        if (restrictions.includes('low_fodmap')) assert.ok(ingredient.grams <= engine.FOODS[ingredient.food_id].low_fodmap_max_g);
      }
    }
  }
  const expected = new Map();
  for (const i of plan.weeks[0].days.flatMap(d => d.meals.flatMap(m => m.ingredients))) expected.set(i.name, (expected.get(i.name) || 0) + i.grams);
  const items = shopping.buildWeekItems(plan.weeks[0]);
  assert.equal(items.length, expected.size);
  for (const item of items) {
    const match = item.amount.match(/^([\d.]+)\s*(kg|g)$/);
    assert.ok(match, item.amount);
    assert.ok(Math.abs(Number(match[1]) * (match[2] === 'kg' ? 1000 : 1) - expected.get(item.name)) < .11, item.name + ' ' + item.amount);
  }
  return plan;
}

for (const style of engine.STYLES) {
  test(style + ' has measured plans and exact shopping quantities at supported targets', () => {
    for (const target of [1200, 1500, 2000, 2500, 3000]) checkPlan(style, target);
  });
  test(style + ' enforces every individual restriction', () => {
    for (const restriction of engine.RESTRICTIONS) checkPlan(style, 2000, [restriction]);
  });
}

test('combined exclusions remain applied; unavailable combinations fail explicitly', () => {
  for (const style of engine.STYLES) checkPlan(style, 2000, ['gluten_free','dairy_free','nut_free','soy_free','egg_free','shellfish_free']);
  assert.throws(() => engine.buildPlan({}, {dietary_requirements:['vegan'], allergies:['seeds','soy','unknown allergen']}), /review/);
});
test('legacy styles are preserved and unknown/conflicting choices never fall back', () => {
  assert.equal(engine.selectTemplate({diet_type:'pescatarian'}).style, 'pescatarian');
  assert.throws(() => engine.selectTemplate({diet_type:'unknown'}), /review/);
  assert.throws(() => engine.selectTemplate({dietary_requirements:['vegan','keto']}), /one eating style/);
  assert.throws(() => engine.buildPlan({calorie_goal:'invalid'}, {}), /target/);
  assert.throws(() => engine.buildPlan({calorie_goal:0}, {}), /target/);
  assert.throws(() => engine.buildPlan({protein_goal_g:-10}, {}), /targets/);
});
test('AFCD energy and available carbohydrate are used directly, including fibre', () => {
  const food = engine.FOODS.chia;
  const n = engine.nutrition([{food_id:'chia', grams:100}]);
  assert.equal(n.carbs_g, food.per100g.carbs_g);
  assert.equal(n.calories, food.per100g.energy_kj / 4.184);
  assert.ok(food.per100g.fiber_g > 0);
  assert.match(engine.FOODS.boiled_egg.source.food_name, /boiled/i);
});
test('each recipe has its own photo and complete nutrient provenance', () => {
  assert.equal(new Set(Object.values(engine.RECIPES).map(r=>r.image)).size, 24);
  for (const food of Object.values(engine.FOODS)) {
    assert.equal(food.source.release, 'AFCD Release 3');
    assert.match(food.source.url, /foodstandards.gov.au/);
    for (const value of Object.values(food.per100g)) assert.ok(Number.isFinite(value) && value >= 0);
  }
});

function fakeDatabase(failTable, preferences) {
  const events=[];
  return {events, from(table) {
    let operation, payload;
    const chain = {
      insert(value) { operation='insert'; payload=value; return chain; },
      update(value) { operation='update'; payload=value; return chain; },
      delete() { operation='delete'; return chain; },
      select() { return chain; }, single() { return chain; }, maybeSingle() { return chain; }, eq() { return chain; }, neq() { return chain; },
      then(resolve, reject) {
        events.push({table, operation, payload});
        if (table===failTable && operation==='insert') return Promise.resolve({error:new Error('Simulated failed save')}).then(resolve,reject);
        const data = table==='user_food_preferences' ? preferences : table==='ai_generated_meal_plans' ? {id:'new-plan'} : Array.isArray(payload) ? payload.map((row,i)=>({...row,id:'meal-'+i})) : [];
        return Promise.resolve({data,error:null}).then(resolve,reject);
      }
    }; return chain;
  }};
}
test('save activates only after all meals exist; failed child save preserves the previous plan', async () => {
  const context={window:{BALANCE_PREPARED_MEAL_LIBRARY:engine},console};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/meal-plan-populator.js'),'utf8'), context);
  const db=fakeDatabase();
  const result=await context.window.populatePreparedMealPlan(db, 'test-user', {calorie_goal:2000}, {diet_type:'pescatarian'});
  assert.equal(result.plan.weeks[0].days[0].meals[0].id,'meal-0');
  const inserts=db.events.findIndex(e=>e.table==='ai_generated_meals'&&e.operation==='insert');
  const activation=db.events.findIndex(e=>e.payload?.status==='active');
  const retirement=db.events.findIndex(e=>e.payload?.status==='archived');
  assert.ok(inserts < activation && activation < retirement);
  const failed=fakeDatabase('ai_generated_meals');
  await assert.rejects(context.window.populatePreparedMealPlan(failed,'test-user',{},{}), /Simulated/);
  assert.ok(!failed.events.some(e=>e.payload?.status==='archived'||e.payload?.status==='active'));
  assert.ok(failed.events.some(e=>e.operation==='delete'));
});

test('next week persists all weeks before replacing the cache and preserves original IDs on failure', async () => {
  const source=fs.readFileSync(path.join(__dirname,'../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
  const start=source.indexOf('async function generateNextWeek() {');
  const fn=source.slice(start,source.indexOf('// Initialize meal plan view when meals tab is opened',start));
  for(const fail of [false,true]) {
    const previous=engine.buildPlan({calorie_goal:2000},{diet_type:'vegan'});
    previous.id='old-plan';previous.weeks[0].days[0].meals[0].id='old-meal';
    const db=fakeDatabase(fail?'ai_generated_meals':undefined);
    const context={window:{BALANCE_PREPARED_MEAL_LIBRARY:engine,currentUser:{id:'test-user'},supabaseClient:db},console,
      _aiMealPlanCache:previous,_aiMealPlanGenerationInProgress:false,_aiMealPlanCurrentWeek:1,_aiMealPlanCurrentDay:0,
      showAiPlanGenerating(){},showAiPlanLoaded(){},updateAiPlanGeneratingStatus(){},alert(){},
      waitForMealPlanDependencies:async()=>true,loadWeeklyEvolutionPreferences:async()=>({diet_type:'vegan'}),localStorage:{setItem(){}}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/meal-plan-populator.js'),'utf8'),context);
    context.window.getUserNutritionTargets=async()=>({calorie_goal:2000});
    vm.runInNewContext(fn,context);await context.generateNextWeek();
    assert.equal(previous.weeks.length,1);assert.equal(previous.weeks[0].days[0].meals[0].id,'old-meal');
    assert.equal(context._aiMealPlanGenerationInProgress,false);
    if(fail){assert.equal(context._aiMealPlanCache,previous);assert.ok(!db.events.some(e=>e.payload?.status==='archived'));}
    else{assert.equal(context._aiMealPlanCache.weeks.length,2);assert.equal(context._aiMealPlanCache.total_meals,70);assert.equal(context._aiMealPlanCurrentWeek,2);}
  }
});

test('changing eating style preserves separately saved allergies but removes explicitly unticked derived restrictions',async()=>{
  for(const previousRequirements of [[],['gluten_free']]){
    const stored=new Map([['user_food_preferences',JSON.stringify({allergies:['nuts','gluten'],dietary_requirements:previousRequirements})]]);
    const storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
    const context={window:{generateAiMealPlan:async prefs=>{context.saved=prefs;}},localStorage:storage,sessionStorage:storage,console,document:{getElementById:()=>({style:{},dataset:{}})}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/dashboard/pbb-deferred-pickers.js'),'utf8'),context);
    context.toggleDietaryPickerChip('pescatarian');await context.saveDietaryPreferences();
    assert.equal(context.saved.diet_type,'pescatarian');
    assert.ok(context.saved.allergies.includes('nuts'));
    assert.equal(context.saved.allergies.includes('gluten'),previousRequirements.length===0);
  }
});

test('challenge auto-plans honour saved style and use measured recipes even with no preferences yet',async()=>{
  for(const preferences of [undefined,{diet_type:'pescatarian',allergies:['eggs']},{dietary_requirements:['whole30','dairy_free']}]){
    const context={window:{BALANCE_PREPARED_MEAL_LIBRARY:engine},console};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/meal-plan-populator.js'),'utf8'),context);
    const result=await context.window.populateVeganChallengeMealPlan(fakeDatabase(undefined,preferences),'test-user',{calorie_goal:2000});
    assert.equal(result.plan.diet_type,preferences?.dietary_requirements?.[0]||preferences?.diet_type||'vegan');
    assert.equal(result.plan.library_version,3);
    if(preferences?.allergies)assert.ok(result.plan.weeks[0].days.flatMap(d=>d.meals.flatMap(m=>m.ingredients)).every(i=>!engine.FOODS[i.food_id].tags.includes('egg')));
  }
});
