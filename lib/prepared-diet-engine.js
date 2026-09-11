/* Ingredient-calculated plans. Recipe totals are never clamped independently of portions. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('../data/meal-ingredient-nutrients.js'):root.BALANCE_FOOD_NUTRIENTS,node?require('../data/balance-diet-recipes.js'):root.BALANCE_DIET_RECIPES);
  if(node)module.exports=api;if(root)root.BALANCE_PREPARED_MEAL_LIBRARY=api;
})(typeof window!=='undefined'?window:globalThis,function(FOODS,RECIPES){
  'use strict';
  const STYLES=['vegan','vegetarian','omnivore','pescatarian','flexitarian','mediterranean','keto','paleo','whole30'];
  const RESTRICTIONS=['gluten_free','dairy_free','nut_free','soy_free','egg_free','shellfish_free','low_fodmap','low_sodium','low_sugar','halal','kosher'];
  const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const TIMES={breakfast:'7:30 AM',am_snack:'10:30 AM',lunch:'1:00 PM',pm_snack:'4:00 PM',dinner:'7:00 PM'};
  const NUTRIENTS=['energy_kj','protein_g','carbs_g','fat_g','fiber_g','sodium_mg','sugar_g','added_sugar_g'];
  const ALIASES={plant_based:'vegan',gluten:'gluten_free',dairy:'dairy_free',milk:'dairy_free',nuts:'nut_free',nut:'nut_free',peanut:'nut_free',peanuts:'nut_free',soy:'soy_free',egg:'egg_free',eggs:'egg_free',shellfish:'shellfish_free',fodmap:'low_fodmap'};
  const normalize=v=>String(v||'').trim().toLowerCase().replace(/[ -]+/g,'_');
  const round=(n,d=1)=>Math.round(n*10**d)/10**d;
  const label=v=>({low_fodmap:'Low FODMAP',whole30:'Whole30',low_sugar:'Lower added sugar'}[v]||v.charAt(0).toUpperCase()+v.slice(1).replace(/_/g,' '));
  function normalizeSelection(input={}){
    const raw=Array.isArray(input)?input:input.dietary_requirements||[];
    if(!Array.isArray(raw))throw new Error('Choose an eating style and food requirements again.');
    const tags=[...new Set(raw.map(v=>ALIASES[normalize(v)]||normalize(v)).filter(Boolean))];
    const unknown=tags.filter(v=>!STYLES.includes(v)&&!RESTRICTIONS.includes(v));
    if(unknown.length)throw new Error('These requirements need review: '+unknown.join(', '));
    const chosen=STYLES.filter(v=>tags.includes(v));
    if(chosen.length>1)throw new Error('Choose one eating style, then add your food restrictions.');
    const legacy=ALIASES[normalize(input.diet_type||input.dietary_preference)]||normalize(input.diet_type||input.dietary_preference);
    const style=chosen[0]||legacy||'omnivore';
    if(!STYLES.includes(style))throw new Error('This eating style needs review: '+style);
    const requirements=new Set(tags.filter(v=>RESTRICTIONS.includes(v))),avoid=[];
    for(const rawAllergy of input.allergies||[]){
      const value=normalize(rawAllergy);if(!value)continue;
      if(ALIASES[value]&&RESTRICTIONS.includes(ALIASES[value]))requirements.add(ALIASES[value]);
      else if(RESTRICTIONS.includes(value))requirements.add(value);
      else if(['fish','seafood','meat','sesame','seed','seeds','oats'].includes(value))avoid.push(value);
      else throw new Error('Your allergy to '+String(rawAllergy)+' needs ingredient review before a plan can be made.');
    }
    const dislikes=(input.dislikes||[]).map(v=>String(v).trim().toLowerCase()).filter(Boolean);
    const restrictions=RESTRICTIONS.filter(v=>requirements.has(v));
    return {style,restrictions,avoid,dislikes,key:[style,...restrictions,...avoid,...dislikes].join('+')};
  }
  function nutrition(ingredients){
    const total=Object.fromEntries(NUTRIENTS.map(n=>[n,0]));
    for(const i of ingredients){
      const food=FOODS[i.food_id];
      if(!food||!Number.isFinite(i.grams)||i.grams<=0)throw new Error('Missing nutrient source or invalid portion.');
      for(const n of NUTRIENTS){const v=food.per100g[n];if(!Number.isFinite(v)||v<0)throw new Error('Missing '+n+' for '+food.name);total[n]+=v*i.grams/100;}
    }
    return {...total,calories:total.energy_kj/4.184};
  }
  function foodAllowed(food,s){
    const t=new Set(food.tags),r=new Set(s.restrictions),style=s.style;
    if(style==='vegan'&&['meat','fish','dairy','egg'].some(v=>t.has(v)))return false;
    if(style==='vegetarian'&&['meat','fish'].some(v=>t.has(v)))return false;
    if(style==='pescatarian'&&t.has('meat'))return false;
    // Use fish and plant dishes for kosher screening, avoiding meat/dairy timing conflicts.
    if(r.has('kosher')&&t.has('meat'))return false;
    if(['paleo','whole30'].includes(style)&&['grain','legume','soy','dairy'].some(v=>t.has(v)))return false;
    if(style==='keto'&&['grain','starch','legume'].some(v=>t.has(v)))return false;
    if(r.has('gluten_free')&&(t.has('gluten')||t.has('oats')))return false;
    for(const [rule,tag] of [['dairy_free','dairy'],['soy_free','soy'],['egg_free','egg'],['shellfish_free','shellfish']])if(r.has(rule)&&t.has(tag))return false;
    if(r.has('nut_free')&&(t.has('nut')||t.has('peanut')))return false;
    if(r.has('low_fodmap')&&food.low_fodmap_max_g===0)return false;
    if(s.avoid.some(v=>(['fish','seafood'].includes(v)&&t.has('fish'))||(v==='meat'&&t.has('meat'))||(['seed','seeds'].includes(v)&&t.has('seed'))||(v==='oats'&&t.has('oats'))))return false;
    return !s.dislikes.some(v=>food.name.toLowerCase().includes(v)||food.id.replace(/_/g,' ').includes(v));
  }
  function compatible(recipe,s){
    if(s.dislikes.some(v=>recipe.name.toLowerCase().includes(v)))return false;
    if(!recipe.ingredients.every(i=>foodAllowed(FOODS[i.food_id],s)))return false;
    const tags=recipe.ingredients.flatMap(i=>FOODS[i.food_id].tags);
    return !(s.restrictions.includes('kosher')&&tags.includes('meat')&&tags.includes('dairy'));
  }
  function pool(s,slot,day,week=1){
    let candidates=Object.values(RECIPES).filter(r=>r.slots.includes(slot)&&compatible(r,s));
    if(s.style==='keto'&&week>1)candidates=candidates.filter(r=>nutrition(r.ingredients).carbs_g<=8);
    const has=(r,tag)=>r.ingredients.some(i=>FOODS[i.food_id].tags.includes(tag)),main=slot==='lunch'||slot==='dinner';
    if(s.style==='flexitarian'){
      const fishSlot=slot==='dinner'&&(day===3||day===6);
      candidates=candidates.filter(r=>fishSlot?has(r,'fish'):!has(r,'meat')&&!has(r,'fish'));
    }
    if(s.style==='mediterranean'){
      const fishSlot=slot==='dinner'&&(day===1||day===5);
      candidates=candidates.filter(r=>!has(r,'red_meat'));
      candidates=candidates.filter(r=>fishSlot?has(r,'fish'):!has(r,'meat')&&!has(r,'fish'));
    }
    if(s.style==='pescatarian'&&main){const fish=candidates.filter(r=>has(r,'fish')&&r.id!=='salmon-cucumber-plate');if(fish.length)candidates=fish;}
    if(s.style==='omnivore'&&main){const animal=candidates.filter(r=>has(r,'meat')||has(r,'fish'));if(animal.length)candidates=animal;}
    if(s.style==='vegetarian'&&slot==='breakfast'){const eggs=candidates.filter(r=>has(r,'egg')||has(r,'dairy'));if(eggs.length)candidates=eggs;}
    if(slot.includes('snack')){const snack=candidates.filter(r=>r.slot.includes('snack'));if(snack.length)candidates=snack;}
    if(!candidates.length)throw new Error('No matching '+slot.replace('_',' ')+' is available for '+label(s.style)+' with these restrictions. Your current plan has been kept.');
    return candidates;
  }
  const WEEK_COUNT=6;
  const WEEK_THEMES=['Your food, your preferences','Fresh ideas, familiar rhythm','Simple meals, more variety','A new week of favourites','Keep the variety going','Your six-week collection'];
  function rotationWeek(value=1){
    const week=Number(value);
    if(!Number.isInteger(week)||week<1)throw new Error('Choose a valid meal-plan week.');
    return ((week-1)%WEEK_COUNT)+1;
  }
  function selectTemplate(input,weekNumber=1){
    const s=normalizeSelection(input);
    const week=rotationWeek(weekNumber);
    const slots=Object.keys(TIMES);
    const firstMenus=DAYS.map((_,day)=>Object.fromEntries(slots.map((slot,index)=>{
      let options=pool(s,slot,day,1);
      const original=options.filter(r=>!r.image.includes('/six-week/'));if(original.length)options=original;
      return [slot,options[(Math.floor(day/2)+index)%options.length].id];
    })));
    const firstRecipes=new Set(firstMenus.flatMap(d=>Object.values(d)));
    const available=[...new Set(DAYS.flatMap((_,day)=>slots.flatMap(slot=>pool(s,slot,day,2).map(r=>r.id))))];
    const additions=available.filter(id=>!firstRecipes.has(id));
    const releaseEnd=Math.floor(additions.length*(week-1)/5);
    const releaseStart=Math.floor(additions.length*Math.max(0,week-2)/5);
    const released=new Set([...firstRecipes,...additions.slice(0,releaseEnd)]);
    const menus=DAYS.map((_,day)=>Object.fromEntries(Object.keys(TIMES).map((slot,index)=>{
      let options=pool(s,slot,day,week);
      // Keep the original first-week choices. New dishes enter subsequent weeks.
      if(week===1){const original=options.filter(r=>!r.image.includes('/six-week/'));if(original.length)options=original;}
      else {const ready=options.filter(r=>released.has(r.id));if(ready.length)options=ready;}
      const preferred=input?.preferred_meals?.[day+':'+slot];
      const familiar=options.find(recipe=>recipe.name===preferred||recipe.id===preferred);
      return [slot,(familiar||options[(Math.floor(day/2)+index+(week-1)*2)%options.length]).id];
    })));
    // Spread first appearances across the block, instead of exhausting the bank
    // in week two. Repeat the new dish on an adjacent day when the diet permits.
    if(week>1){
      const occupied=new Set();
      for(const id of additions.slice(releaseStart,releaseEnd)){
        let placed=false;
        for(const day of [2,4,6,0,3,5,1]){
          for(const slot of ['lunch','dinner','breakfast','am_snack','pm_snack']){
            const key=day+':'+slot;
            if(occupied.has(key)||!pool(s,slot,day,week).some(r=>r.id===id))continue;
            menus[day][slot]=id;occupied.add(key);
            if(day%2===0&&day<6&&!occupied.has((day+1)+':'+slot)&&pool(s,slot,day+1,week).some(r=>r.id===id)){
              menus[day+1][slot]=id;occupied.add((day+1)+':'+slot);
            }
            placed=true;break;
          }
          if(placed)break;
        }
      }
    }
    return {id:'prepared-v4-'+s.key+'-week-'+week,...s,week_number:week,menus};
  }
  function expandTemplate(t){return DAYS.map((name,i)=>({day_of_week:i,day_name:name,meals:Object.keys(TIMES).map(slot=>({meal_slot:slot,meal_time:TIMES[slot],recipe_id:t.menus[i][slot]}))}));}
  function limits(i,s){
    const f=FOODS[i.food_id],t=f.tags;let min=i.grams*0.3,max=i.grams*2.5;
    if(t.some(v=>['vegetable','fruit','herb','spice','juice','water'].includes(v))){min=i.grams;max=i.grams;}
    if(t.includes('oil')){min=i.grams*0.4;max=Math.min(60,i.grams*3);}
    if(s.restrictions.includes('low_fodmap')){max=Math.min(max,f.low_fodmap_max_g);min=Math.min(min,max);}
    return {min,max};
  }
  function scaleDay(placements,s,targets){
    const calories=targets.calorie_goal==null?2000:Number(targets.calorie_goal);
    if(!Number.isFinite(calories)||calories<1200||calories>4000)throw new Error('This calorie target needs a tailored plan (prepared plans cover 1,200 to 4,000 kcal).');
    const keto=s.style==='keto';
    for(const key of ['protein_goal_g','fat_goal_g','carbs_goal_g'])if(targets[key]!=null&&(!Number.isFinite(Number(targets[key]))||Number(targets[key])<0))throw new Error('Your nutrition targets need review before a plan can be made.');
    const desired={protein_g:keto?calories*0.25/4:(Number(targets.protein_goal_g)||calories*0.2/4),fat_g:keto?calories*0.7/9:(Number(targets.fat_goal_g)||calories*0.3/9)};
    const meals=placements.map(p=>({p,recipe:RECIPES[p.recipe_id],ingredients:RECIPES[p.recipe_id].ingredients.map(i=>({...i,...limits(i,s)}))}));
    const all=meals.flatMap(m=>m.ingredients);for(const i of all)i.grams=Math.min(i.max,Math.max(i.min,i.grams));
    const score=()=>{
      const n=nutrition(all);let cost=2000*((n.calories-calories)/calories)**2+3*((n.protein_g-desired.protein_g)/desired.protein_g)**2+((n.fat_g-desired.fat_g)/desired.fat_g)**2;
      if(keto)cost+=80*(Math.max(0,n.carbs_g-29)/30)**2+5000*Math.max(0,0.62-n.fat_g*9/n.calories)**2;
      if(s.restrictions.includes('low_sodium'))cost+=100*(Math.max(0,n.sodium_mg-1450)/1500)**2;
      return cost;
    };
    for(const step of [20,10,5,2,1,0.2])for(let pass=0;pass<12;pass++){
      let changed=false;
      for(const i of all){
        if(i.max===i.min)continue;const original=i.grams;let best=original,bestScore=score();
        for(const direction of [-1,1]){i.grams=Math.max(i.min,Math.min(i.max,original+direction*step));const candidate=score();if(candidate<bestScore-1e-10){bestScore=candidate;best=i.grams;}}
        i.grams=best;changed=changed||best!==original;
      }
      if(!changed)break;
    }
    for(const i of all)i.grams=round(i.grams,1);
    const total=nutrition(all);
    if(Math.abs(total.calories-calories)>calories*0.05)throw new Error('These restrictions and calorie targets need a tailored portion review. Your current plan has been kept.');
    if(keto&&(total.carbs_g>30||total.fat_g*9/total.calories<0.6||total.fat_g*9/total.calories>0.8))throw new Error('This day did not meet the ketogenic nutrient limits. Your current plan has been kept.');
    if(s.restrictions.includes('low_sodium')&&total.sodium_mg>1500)throw new Error('This day exceeded the low-sodium limit.');
    if(s.restrictions.includes('low_sugar')&&total.added_sugar_g>25)throw new Error('This day exceeded the added-sugar limit.');
    const notices=[];
    if(total.protein_g<desired.protein_g*0.85)notices.push('These restrictions provide about '+Math.round(total.protein_g)+' g protein today, below your '+Math.round(desired.protein_g)+' g target. Ask your coach to review if that target is essential.');
    return {totals:total,notices,meals:meals.map(m=>{
      const n=nutrition(m.ingredients);
      const ingredients=m.ingredients.map(i=>{
        const f=FOODS[i.food_id];let name=f.name;
        if(f.tags.includes('meat')){if(s.restrictions.includes('halal'))name='Halal-certified '+name;if(s.restrictions.includes('kosher'))name='Kosher-certified '+name;}
        return {food_id:i.food_id,name,amount:i.grams+' g',grams:i.grams,nutrition_source:f.source.food_id,nutrition_release:f.source.release};
      });
      return {...m.p,name:m.recipe.name,description:m.recipe.description,ingredients,preparation:m.recipe.preparation,
        ...Object.fromEntries(Object.entries(n).map(([k,v])=>[k,round(v,k==='calories'?0:1)])),prep_time_mins:m.recipe.prep_time_mins,cook_time_mins:m.recipe.cook_time_mins,cuisine:m.recipe.cuisine,image_url:m.recipe.image,tags:['prepared-library','ingredient-calculated-v3',s.style,...s.restrictions]};
    })};
  }
  function nutritionGuidance(t,notices=[]){
    let note='Nutrition estimates use weighed ingredients and AFCD Release 3. Weigh foods in the stated raw or cooked state; brands and cooking yields vary. Photos show the recipe, not your exact personalised portion.';
    if(t.restrictions.includes('low_fodmap'))note+=' Low FODMAP uses conservative portions; check current Monash serving guidance and individual tolerance with your dietitian.';
    if(t.restrictions.some(v=>v==='halal'||v==='kosher'))note+=' Choose appropriately certified ingredients and follow your household preparation requirements; this plan is ingredient-screened, not religious certification.';
    if(t.restrictions.some(v=>v.endsWith('_free')))note+=' Check package allergen labels and cross-contact information when shopping.';
    if(t.restrictions.includes('low_sugar'))note+=' Lower added sugar means no added sweeteners in these recipes; fruit and dairy still contain natural sugars.';
    return note+' '+[...new Set(notices)].join(' ');
  }
  function buildWeek(targets={},input={},weekNumber=1){
    const t=selectTemplate(input,weekNumber),notices=new Set();
    const days=expandTemplate(t).map(day=>{const scaled=scaleDay(day.meals,t,targets);scaled.notices.forEach(n=>notices.add(n));return {...day,meals:scaled.meals,nutrition_totals:scaled.totals};});
    return {week_number:t.week_number,theme:WEEK_THEMES[t.week_number-1],theme_description:'Five meals a day with repeats for easy preparation and a different selection each week.',days,nutrition_notices:[...notices]};
  }
  function buildPlan(targets={},input={},options={}){
    const t=selectTemplate(input),notices=new Set();
    const count=options.weekCount??WEEK_COUNT;
    if(!Number.isInteger(count)||count<1||count>WEEK_COUNT)throw new Error('Choose between one and six weeks.');
    const weeks=Array.from({length:count},(_,index)=>buildWeek(targets,input,index+1));
    weeks.forEach(w=>w.nutrition_notices.forEach(n=>notices.add(n)));
    return {plan_name:'Your '+label(t.style)+' Balance Six Weeks',plan_description:'Six prepared weeks, with familiar meal-prep repeats and fresh choices each week. '+nutritionGuidance(t,[...notices]),diet_type:t.style,dietary_requirements:[t.style,...t.restrictions],template_id:t.id,library_version:4,total_meals:35*count,current_week:1,
      calorie_goal:Number(targets.calorie_goal)||2000,protein_goal_g:targets.protein_goal_g||null,carbs_goal_g:targets.carbs_goal_g||null,fat_goal_g:targets.fat_goal_g||null,
      generated_at:new Date().toISOString(),weeks};
  }
  return {VERSION:4,WEEK_COUNT,WEEK_THEMES,rotationWeek,STYLES,RESTRICTIONS,RECIPES,FOODS,normalizeSelection,selectTemplate,expandTemplate,nutrition,compatible,scaleDay,buildWeek,buildPlan,nutritionGuidance,label};
});



