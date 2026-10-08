const test = require('node:test');
const assert = require('node:assert/strict');
const family = require('../lib/meal-plan-family-servings.js');
const shopping = require('../lib/meal-plan-shopping-list.js');
const meal = { ingredients: [
    { name: 'Chicken breast (raw)', personal_quantity: 150, other_quantity: 150, unit: 'g' },
    { name: 'Rice (dry)', personal_quantity: 30, other_quantity: 60, unit: 'g' },
    { name: 'Wraps', personal_quantity: 0, other_quantity: 1, unit: '' }
] };
test('batch includes the personal portion once and preserves different family sides', () => {
    assert.equal(family.amount(meal.ingredients[0], 'family', 5), '750 g');
    assert.equal(family.amount(meal.ingredients[1], 'family', 5), '270 g');
    assert.equal(family.amount(meal.ingredients[1], 'personal', 10), '30 g');
    assert.equal(family.amount(meal.ingredients[2], 'family', 5), '4');
    assert.equal(family.ingredients(meal, 'personal', 5).length, 2);
});
test('legacy recipes are unchanged and invalid batch sizes are bounded', () => {
    const legacy = { ingredients: [{name:'Oil',amount:'1 tbsp'}] };
    assert.equal(family.ingredients(legacy,'family',5),legacy.ingredients);
    for(const value of [0,1,11,NaN,3.5,'<script>']) assert.equal(family.portions(value),5);
    assert.equal(family.portions('3'),3);
});
test('shopping list sums batch quantities without also adding the personal portion', () => {
    const week = {days:[{meals:[{ingredients:family.ingredients(meal,'family',5)}]}]};
    const items = shopping.buildWeekItems(week);
    assert.equal(items.find(item => item.name.startsWith('Chicken')).amount,'750 g');
    assert.equal(items.find(item => item.name.startsWith('Rice')).amount,'270 g');
});
test('serving table escapes client text and includes clear column headings', () => {
    const html = family.render({...meal,portion_note:'<img onerror=alert(1)>'},5);
    assert.match(html,/Your serving/); assert.match(html,/Batch \(5\)/);
    assert.match(html,/&lt;img/); assert.doesNotMatch(html,/<img/);
});
test('visual guides distinguish cooked foods and preserve counted ingredients', () => {
    const helper = require('../lib/meal-plan-family-servings.js');
    assert.match(helper.practicalAmount({ name: 'Rice (dry)', personal_quantity: 60, other_quantity: 75, unit: 'g' }, 'personal', 5), /1 cupped hand cooked/);
    assert.match(helper.practicalAmount({ name: 'Chicken breast (raw)', personal_quantity: 150, other_quantity: 150, unit: 'g' }, 'personal', 5), /1 palm-sized portion cooked/);
    assert.equal(helper.practicalAmount({ name: 'Whole eggs', personal_quantity: 2, other_quantity: 2, unit: '' }, 'family', 3), '6');
    assert.match(helper.practicalAmount({ name: 'Stock', personal_quantity: 250, other_quantity: 250, unit: 'ml' }, 'personal', 5), /1 cup/);
});
