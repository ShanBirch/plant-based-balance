const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js','utf8');
test('added sessions enforce their Brisbane date window without altering ordinary workouts',()=>{
 const c={Intl,Date};vm.runInNewContext(source.slice(source.indexOf('function isCoachSessionAvailable('),source.indexOf('function renderWeeklyCalendar(')),c);
 const workout={availableFrom:'2026-10-21',availableUntil:'2026-11-17'};
 assert.equal(c.isCoachSessionAvailable(workout,new Date('2026-10-20T13:59:59Z')),false);
 assert.equal(c.isCoachSessionAvailable(workout,new Date('2026-10-20T14:00:00Z')),true);
 assert.equal(c.isCoachSessionAvailable(workout,new Date('2026-11-17T14:00:00Z')),false);
 assert.equal(c.isCoachSessionAvailable({},new Date('2026-10-01T00:00:00Z')),true);
 const start=source.slice(source.indexOf('async function startInlineWorkout('),source.indexOf('async function startInlineWorkout(')+500);
 assert.match(start,/if \(!isCoachSessionAvailable\(workout\)\)/);
});
test('family dinner guide renders actual recipes without zero nutrition claims or a calorie logging action',()=>{
 const nodes={'ai-plan-meals-list':{innerHTML:''},'ai-plan-day-nutrition':{style:{}}};
 const c={window:{},document:{getElementById:id=>nodes[id]||null},_aiMealPlanCache:{diet_type:'family_lower_carb',weeks:[{week_number:1,days:[{day_of_week:0,meals:[{meal_slot:'dinner',name:'Shared mince tacos',description:'Lettuce cups or shells',ingredients:[{name:'Mince'}],preparation:'Cook one filling'}]}]}]},_aiMealPlanCurrentWeek:1,_aiMealPlanMealSelection:null,_aiMealPlanLoggedTypes:[],loadAiMealPlanLoggedTypes(){},getAiMealPlanTodayIndex:()=>0,resolveMealPlanPhotoUrl:()=>'',escapeAiPlanText:s=>String(s),formatAiPlanPreparation:s=>s};
 vm.runInNewContext(source.slice(source.indexOf('function renderAiPlanFocusedDay('),source.indexOf('function renderAiPlanDay(')),c);
 c.renderAiPlanFocusedDay(0);
 assert.equal(nodes['ai-plan-day-nutrition'].style.display,'none');
 assert.match(nodes['ai-plan-meals-list'].innerHTML,/Shared mince tacos/);assert.match(nodes['ai-plan-meals-list'].innerHTML,/Lettuce cups or shells/);
 assert.doesNotMatch(nodes['ai-plan-meals-list'].innerHTML,/0 cal|0g protein|openAiPlanMealLogger|Log meal/);
 c._aiMealPlanCache.diet_type='omnivore';c.renderAiPlanFocusedDay(0);
 assert.equal(nodes['ai-plan-day-nutrition'].style.display,'');assert.match(nodes['ai-plan-meals-list'].innerHTML,/openAiPlanMealLogger/);
});
