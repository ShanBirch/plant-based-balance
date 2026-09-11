/* Offline preparation and review. No database writes, network or generation. */
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../lib/prepared-diet-engine.js');
const shopping = require('../lib/meal-plan-shopping-list.js');
const folder = path.resolve(process.argv[2] || 'work/six-week-library');
fs.mkdirSync(folder, {recursive:true});
const summaries = [];
for (const style of engine.STYLES) {
  const plan = engine.buildPlan({calorie_goal:2000}, {diet_type:style});
  for (const week of plan.weeks) week.shopping_list = shopping.buildWeekItems(week);
  fs.writeFileSync(path.join(folder, style+'.json'), JSON.stringify(plan));
  summaries.push({style,weeks:plan.weeks.length,meals:plan.total_meals,
    unique_menus:new Set(plan.weeks.map(w=>JSON.stringify(w.days.map(d=>d.meals.map(m=>m.recipe_id))))).size,
    recipes:new Set(plan.weeks.flatMap(w=>w.days.flatMap(d=>d.meals.map(m=>m.recipe_id)))).size});
}
fs.writeFileSync(path.join(folder,'manifest.json'), JSON.stringify({version:engine.VERSION,recipes:Object.keys(engine.RECIPES).length,plans:summaries},null,2));
console.log(JSON.stringify(summaries));
