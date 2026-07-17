const test = require('node:test');
const assert = require('node:assert/strict');
const evolution = require('../lib/weekly-meal-evolution.js');

function meal(day, type, name, extras = {}) {
    return { meal_date: `2026-07-${String(10 + day).padStart(2, '0')}`, meal_type: type, meal_description: name, calories: 400, protein_g: 20, fiber_g: 6, micronutrients: {}, ...extras };
}
const history = [
    meal(0, 'breakfast', 'Tofu scramble'), meal(0, 'lunch', 'Burrito bowl'), meal(0, 'dinner', 'Lentil pasta'),
    meal(1, 'breakfast', 'Overnight oats'), meal(1, 'lunch', 'Tofu wrap'), meal(1, 'dinner', 'Chickpea curry'),
    meal(2, 'breakfast', 'Smoothie bowl'), meal(2, 'lunch', 'Sushi bowl'), meal(2, 'dinner', 'Bean chilli'),
    meal(3, 'snack', 'Apple and peanut butter'), meal(3, 'lunch', 'Burrito bowl'), meal(3, 'dinner', 'Lentil pasta')
];

test('requires useful coverage before adapting a week', () => {
    assert.equal(evolution.assessHistory(history).eligible, true);
    assert.equal(evolution.assessHistory(history.slice(0, 5)).eligible, false);
});
test('builds 35 familiar slots with exactly two variations', () => {
    const blueprint = evolution.buildBlueprint(history);
    assert.equal(blueprint.length, 35);
    assert.equal(blueprint.filter(item => item.variation).length, 2);
    assert.ok(blueprint.every(item => item.base_meal.name));
});
test('only flags micronutrients measured on at least three days', () => {
    const measured = history.map((row, index) => ({ ...row, micronutrients: index < 9 ? { calcium_mg: 100 } : {} }));
    const focus = evolution.buildNutritionFocus(measured, { protein_goal_g: 120 }, 'vegan');
    assert.ok(focus.some(item => item.key === 'protein'));
    assert.ok(focus.some(item => item.key === 'calcium'));
    assert.ok(!focus.some(item => item.key === 'b12'));
});
