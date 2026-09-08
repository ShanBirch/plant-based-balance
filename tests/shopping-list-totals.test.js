const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const shopping = require('../lib/meal-plan-shopping-list');
const library = require('../data/prepared-meal-plan-library');
const list = ingredients => shopping.buildWeekItems({days:[{meals:[{ingredients}]}]});

test('screenshot duplicates become a single ingredient with the weekly total', () => {
  const ingredients = [];
  for (const [name, count] of [['strawberries',2],['strawberries, frozen',3],['strawberries, sliced',4],['zucchini, chopped',3],['zucchini, diced',2],['zucchini, sliced',4]]) {
    for(let i=0;i<count;i++) ingredients.push({name,amount:'65 g'});
  }
  assert.deepEqual(list(ingredients).map(({name,amount})=>({name,amount})),[{name:'strawberries',amount:'585 g'},{name:'zucchini',amount:'585 g'}]);
});

test('adds mixed fractions and metric units without inventing density conversions', () => {
  const items=list([
    {name:'Paprika',amount:'1/4 tsp'},{name:'Paprika',amount:'⅛ tsp'},{name:'Paprika',amount:'1½ tsp'},
    {name:'Milk',amount:'395 ml'},{name:'Milk',amount:'1 L'},
    {name:'Oats',amount:'500 g'},{name:'Oats',amount:'0.75 kg'},{name:'Oats',amount:'1 cup'}
  ]);
  assert.equal(items.find(i=>i.name==='Paprika').amount,'1 7/8 tsp');
  assert.equal(items.find(i=>i.name==='Milk').amount,'1.395 L');
  assert.match(items.find(i=>i.name==='Oats').amount,/1.25 kg/);
  assert.match(items.find(i=>i.name==='Oats').amount,/1 cup/);
});

test('keeps different products, dietary restrictions and cooked weights distinct', () => {
  const names=['dried strawberries','strawberries','almond milk','rice milk','gluten-free oats','oats','cooked rice','dry rice','canned tomatoes','tomatoes','roasted pumpkin seeds','pumpkin seeds'];
  assert.equal(list(names.map(name=>({name,amount:'100 g'}))).length,names.length);
  assert.equal(list([{name:'kiwifruit, peeled and sliced',amount:'1 medium'},{name:'kiwifruit',amount:'2 medium'}])[0].amount,'3 medium');
});

test('retains amounts it cannot safely convert, including missing measurements', () => {
  const item=list([{name:'Beans',amount:'1 can (400 g)'},{name:'Beans',amount:'1 can (400 g)'},'Beans'])[0];
  assert.match(item.amount,/2 × \(1 can \(400 g\)\)/);
  assert.match(item.amount,/as needed/);
  assert.deepEqual(shopping.buildWeekItems(null),[]);
});

test('all 96 dietary selections and three calorie targets produce matching weekly totals', () => {
  const context={window:{BALANCE_PREPARED_MEAL_LIBRARY:library},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/meal-plan-populator.js'),'utf8'),context);
  for(const style of library.STYLES) for(let mask=0;mask<32;mask++) for(const calories of [1500,2200,3000]) {
    const prefs={dietary_requirements:[style,...library.RESTRICTIONS.filter((_,bit)=>mask&(1<<bit))]};
    const week=context.window.buildPreparedMealPlan({calorie_goal:calories},prefs).weeks[0];
    const ingredients=week.days.flatMap(d=>d.meals.flatMap(m=>m.ingredients));
    const items=shopping.buildWeekItems(week);
    const berries=ingredients.filter(i=>/^strawberries/.test(i.name));
    assert.equal(items.filter(i=>i.key==='strawberries').length,1);
    assert.equal(items.find(i=>i.key==='strawberries').amount,berries.reduce((sum,i)=>sum+parseFloat(i.amount),0)+' g');
    assert.ok(items.every(i=>i.name&&i.amount&&!/NaN|undefined/.test(i.amount)));
    assert.equal(new Set(items.map(i=>i.key)).size,items.length);
    assert.ok(items.length<new Set(ingredients.map(i=>i.name)).size);
  }
});

test('older four-week plans stay scoped to the selected week and support unit fields', () => {
  const context={window:{},console};vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../data/vegan-challenge-meal-plan.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/meal-plan-populator.js'),'utf8'),context);
  const plan=context.window.buildScaledMealPlan({calorie_goal:2200});
  assert.equal(plan.weeks.length,4);
  for(const week of plan.weeks){const items=shopping.buildWeekItems(week);assert.ok(items.length>10);assert.ok(items.every(i=>i.name&&!/NaN/.test(i.amount)));}
  assert.equal(list([{name:'Carrots',quantity:200,unit:'g'},{name:'Carrots',qty:0.5,unit:'kg'}])[0].amount,'700 g');
  assert.equal(shopping.buildWeekItems({days:[{meals:[{ingredients:[{name:'Carrots',amount:'200 g'}]}]}]})[0].amount,'200 g');
});
