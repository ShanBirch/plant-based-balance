const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = {};
require('../data/vegan-challenge-meal-plan.js');
const resolver = require('../lib/meal-plan-photo-resolver.js');
require('../lib/meal-plan-populator.js');

const template = window.VEGAN_CHALLENGE_MEAL_PLAN;
const recipes = Object.values(template.RECIPES);

test('the curated onboarding library has a real photo for every recipe', () => {
    assert.equal(recipes.length, 31);
    recipes.forEach(recipe => {
        assert.ok(recipe.image, `${recipe.name} needs an image path`);
        assert.ok(fs.existsSync(path.join(__dirname, '..', recipe.image)), `${recipe.image} needs to exist`);
        assert.equal(resolver.resolve(recipe, template).url, recipe.image);
    });
});

test('the complete four-week onboarding plan has a photo on all 140 meals', () => {
    const plan = window.buildScaledMealPlan({ calorie_goal: 2000 });
    const meals = plan.weeks.flatMap(week => week.days.flatMap(day => day.meals));
    assert.equal(meals.length, 140);
    assert.ok(meals.every(meal => resolver.safeImageUrl(meal.image_url)));
});

test('photo-less legacy meals receive a relevant safe library image', () => {
    const lentilSoup = resolver.resolve({
        meal_slot: 'dinner',
        name: 'Lentil Soup with Whole Wheat Bread',
        ingredients: [{ name: 'Green Lentils' }, { name: 'Vegetable Broth' }]
    }, template);
    const edamame = resolver.resolve({
        meal_slot: 'am_snack',
        name: 'Edamame with Sea Salt',
        ingredients: [{ name: 'Edamame' }]
    }, template);

    assert.match(lentilSoup.url, /^images\/meals\/.+\.png$/);
    assert.match(edamame.url, /edamame/);
});

test('a member logged-meal photo wins over a library match', () => {
    const url = 'https://hzapaorxqboevxnumxkv.supabase.co/storage/v1/object/public/meal-photos/example.jpg';
    assert.equal(resolver.resolve({ name: 'Tofu scramble', photo_url: url }, template).url, url);
});

test('unsafe image values are replaced by a curated photo', () => {
    const result = resolver.resolve({ meal_slot: 'breakfast', name: 'Pancakes', image_url: 'javascript:alert(1)' }, template);
    assert.match(result.url, /^images\/meals\//);
});

test('all meal-plan generation paths persist resolved photos', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
    assert.doesNotMatch(source, /image_url:\s*null/);
    assert.match(source, /select\('[^']*photo_url[^']*'\)/);
    assert.match(source, /persistResolvedMealPlanPhotos\(resolvedPhotoRows\)/);
});
