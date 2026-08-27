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

test('photo-less legacy meals never receive a photo of a different recipe', () => {
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

    assert.deepEqual(lentilSoup, { url: '', source: 'missing', recipeName: null });
    assert.deepEqual(edamame, { url: '', source: 'missing', recipeName: null });
});

test('a member logged-meal photo wins over a library match', () => {
    const url = 'https://hzapaorxqboevxnumxkv.supabase.co/storage/v1/object/public/meal-photos/example.jpg';
    assert.equal(resolver.resolve({ name: 'Tofu scramble', photo_url: url }, template).url, url);
});

test('a reviewed per-client meal photo is rendered without reviving generic legacy fallbacks', () => {
    const exactClientPhoto = 'images/meals/arunima/tofu-bhurji-roti.jpg';
    assert.deepEqual(
        resolver.resolve({ name: 'Tofu Bhurji + Roti', image_url: exactClientPhoto }, template),
        { url: exactClientPhoto, source: 'explicit', recipeName: null }
    );

    const genericLegacyPhoto = resolver.resolve({
        name: 'Palak Tofu + Wholemeal Roti',
        image_url: 'images/meals/mediterranean_lentil_salad.png'
    }, template);
    assert.deepEqual(genericLegacyPhoto, { url: '', source: 'missing', recipeName: null });
});

test('unsafe image values never produce a misleading fallback photo', () => {
    const result = resolver.resolve({ meal_slot: 'breakfast', name: 'Pancakes', image_url: 'javascript:alert(1)' }, template);
    assert.equal(result.url, '');
    assert.equal(result.source, 'missing');
});

test('all meal-plan generation paths persist resolved photos', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
    assert.doesNotMatch(source, /image_url:\s*null/);
    assert.match(source, /select\('[^']*photo_url[^']*'\)/);
    assert.match(source, /persistResolvedMealPlanPhotos\(resolvedPhotoRows\)/);
    assert.match(source, /ensureExactMealPlanPhotos\(fullPlan, user\.id\)/);
    assert.match(source, /Creating photos that match each meal/);
});

test('the photo generator is authenticated and prompts for the exact meal', () => {
    const source = fs.readFileSync(path.join(__dirname, '../netlify/edge-functions/generate-meal-image.ts'), 'utf8');
    assert.match(source, /auth\/v1\/user/);
    assert.match(source, /userOwnsMeal/);
    assert.match(source, /gemini-3\.1-flash-image/);
    assert.match(source, /responseModalities: \["IMAGE"\]/);
    assert.doesNotMatch(source, /responseFormat/);
    assert.match(source, /exact prepared meal/);
    assert.match(source, /failureStage = "image_generation"/);
    assert.match(source, /failureStage = "photo_storage"/);
    assert.doesNotMatch(source, /data:\$\{mimeType\};base64/);
});
