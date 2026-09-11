const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../lib/prepared-diet-engine');
const shopping=require('../lib/meal-plan-shopping-list');
test('saved six-week plans advance weekly and wrap without resetting the start date',()=>{
  const source=fs.readFileSync(require.resolve('../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
  const start=source.indexOf('function getAiMealPlanScheduledWeek(');
  const context={Date};vm.runInNewContext(source.slice(start,source.indexOf('function showAiPlanLoaded(',start)),context);
  const plan={generated_at:'2026-09-01T00:00:00Z',weeks:Array.from({length:6},(_,i)=>({week_number:i+1}))};
  for(let week=0;week<14;week++)assert.equal(context.getAiMealPlanScheduledWeek(plan,Date.parse(plan.generated_at)+week*7*86400000),(week%6)+1);
  assert.equal(context.getAiMealPlanScheduledWeek({...plan,generated_at:'invalid'},Date.now()),1);
  assert.equal(context.getAiMealPlanScheduledWeek({...plan,weeks:[{week_number:1},{week_number:2}],current_week:2},Date.now()),2);
});
for(const style of engine.STYLES)test(style+' introduces recipes through all six weeks and reconciles every shopping list',()=>{
  const plan=engine.buildPlan({calorie_goal:2000},{diet_type:style});
  assert.equal(plan.total_meals,210);
  const seen=new Set(),menus=new Set();
  for(const week of plan.weeks){
    const ids=new Set(week.days.flatMap(d=>d.meals.map(m=>m.recipe_id)));
    assert.ok([...ids].some(id=>!seen.has(id)),style+' week '+week.week_number+' needs a new recipe');
    ids.forEach(id=>seen.add(id));menus.add(JSON.stringify(week.days.map(d=>d.meals.map(m=>m.recipe_id))));
    const expected=new Map();
    for(const i of week.days.flatMap(d=>d.meals.flatMap(m=>m.ingredients)))expected.set(i.name,(expected.get(i.name)||0)+i.grams);
    const items=shopping.buildWeekItems(week);assert.equal(items.length,expected.size);
    for(const item of items){const [,value,unit]=item.amount.match(/^([\d.]+)\s*(kg|g)$/);assert.ok(Math.abs(Number(value)*(unit==='kg'?1000:1)-expected.get(item.name))<.11);}
  }
  assert.equal(menus.size,6);
  assert.deepEqual(engine.selectTemplate({diet_type:style},7).menus,engine.selectTemplate({diet_type:style},1).menus);
});
test('continuation appends remaining weeks atomically and retains original meals on failure',async()=>{
  const source=fs.readFileSync(require.resolve('../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
  const start=source.indexOf('async function generateNextWeek() {');
  const fn=source.slice(start,source.indexOf('// Initialize meal plan view when meals tab is opened',start));
  for(const fail of [false,true]){
    const original=engine.buildPlan({}, {diet_type:'vegan'},{weekCount:1});original.id='old-plan';original.weeks[0].days[0].meals[0].id='old-meal';
    let payload,reloaded=false;
    const context={console,window:{currentUser:{id:'user'},getUserNutritionTargets:async()=>({}),buildPreparedMealPlan:engine.buildPlan,supabaseClient:{rpc:async(name,args)=>{assert.equal(name,'append_prepared_meal_weeks');payload=args;return {error:fail?new Error('save failed'):null};}}},
      _aiMealPlanCache:original,_aiMealPlanGenerationInProgress:false,showAiPlanGenerating(){},updateAiPlanGeneratingStatus(){},
      waitForMealPlanDependencies:async()=>{},loadWeeklyEvolutionPreferences:async()=>({diet_type:'vegan'}),loadExistingAiMealPlan:async()=>{reloaded=true;}};
    vm.runInNewContext(fn,context);await context.generateNextWeek();
    assert.equal(payload.p_weeks.length,5);assert.equal(payload.p_plan_id,'old-plan');
    assert.equal(original.weeks.length,1);assert.equal(original.weeks[0].days[0].meals[0].id,'old-meal');
    assert.equal(context._aiMealPlanGenerationInProgress,false);assert.equal(reloaded,!fail);
    if(fail)assert.equal(context._aiMealPlanCache,original);
  }
});
