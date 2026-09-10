const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../lib/prepared-diet-engine.js');
const endpoint=import('../netlify/edge-functions/generate-meal-plan.ts').then(m=>m.default);
async function post(body){return (await endpoint)(new Request('https://balance.test/.netlify/functions/generate-meal-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));}
test('continuation endpoint shares every style, measured nutrition and photo identity',async()=>{
 for(const style of engine.STYLES){
  const response=await post({weekNumber:2,dayNumber:0,userData:{quizResults:{calorie_goal:2000},foodPreferences:{diet_type:style}}});
  assert.equal(response.status,200,style);
  const data=await response.json();assert.equal(data.library_version,3);assert.equal(data.day.meals.length,5);
  assert.match(data.plan_description,/AFCD Release 3/);
  const expected=engine.buildPlan({calorie_goal:2000},{diet_type:style}).weeks[0].days[0].meals;
  assert.deepEqual(data.day.meals,expected);
 }
});
test('invalid dates, styles and targets cannot silently yield an omnivore plan',async()=>{
 for(const body of [{dayNumber:7},{weekNumber:0},{dayNumber:.5}])assert.equal((await post(body)).status,400);
 for(const foodPreferences of [{diet_type:'unknown'},{dietary_requirements:['vegan','keto']},{allergies:['unverified food']}])assert.equal((await post({userData:{foodPreferences}})).status,422);
 assert.equal((await post({userData:{quizResults:{calorie_goal:NaN}}})).status,200); // JSON null explicitly means unset.
 assert.equal((await post({userData:{quizResults:{calorie_goal:'bad'}}})).status,422);
 assert.equal((await (await endpoint)(new Request('https://balance.test'))).status,405);
});
test('logged recipe names cannot disguise an incompatible library meal',async()=>{
 const response=await post({userData:{foodPreferences:{diet_type:'vegan'}},adaptiveWeek:{meals:[{meal_slot:'breakfast',variation:false,base_meal:{name:'Bacon and eggs'}}]}});
 const data=await response.json();assert.notEqual(data.day.meals[0].name,'Bacon and eggs');
 assert.ok(data.day.meals[0].ingredients.every(i=>!engine.FOODS[i.food_id].tags.some(t=>['meat','fish','egg','dairy'].includes(t))));
});
