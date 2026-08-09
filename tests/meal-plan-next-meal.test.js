const test = require('node:test');
const assert = require('node:assert/strict');
const nextMeal = require('../lib/meal-plan-next-meal');

const meals = [
    { meal_slot: 'dinner', name: 'Dinner' },
    { meal_slot: 'breakfast', name: 'Breakfast' },
    { meal_slot: 'pm_snack', name: 'Snack' },
    { meal_slot: 'lunch', name: 'Lunch' }
];

test('selects the first unlogged meal in meal order', () => {
    assert.equal(nextMeal.nextMealIndex(meals, []), 1);
    assert.equal(nextMeal.nextMealIndex(meals, ['breakfast']), 3);
    assert.equal(nextMeal.nextMealIndex(meals, ['breakfast', 'lunch']), 2);
});

test('one generic snack log completes only one planned snack', () => {
    const twoSnacks = [
        { meal_slot: 'breakfast' },
        { meal_slot: 'am_snack' },
        { meal_slot: 'lunch' },
        { meal_slot: 'pm_snack' }
    ];
    assert.equal(nextMeal.nextMealIndex(twoSnacks, ['breakfast', 'snack']), 2);
    assert.equal(nextMeal.nextMealIndex(twoSnacks, ['breakfast', 'snack', 'lunch']), 3);
});

test('keeps the last meal selected when the day is complete', () => {
    assert.equal(nextMeal.nextMealIndex(meals, ['breakfast', 'lunch', 'snack', 'dinner']), 0);
});
