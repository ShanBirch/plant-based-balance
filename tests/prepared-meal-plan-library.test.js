const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const library = require('../data/prepared-meal-plan-library.js');
const onboardingSource = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const pickerSource = fs.readFileSync(path.join(__dirname, '../js/dashboard/pbb-deferred-pickers.js'), 'utf8');

const forbidden = /\b(?:wheat|barley|rye|cow'?s milk|dairy butter|cheese|almond|cashew|walnut|peanut|tofu|tempeh|edamame|soy|onion|garlic cloves?|apple|pear|honey|sugar alcohol)\b/i;

function rawSelections() {
  const out = [];
  for (const style of library.STYLES) {
    for (let mask = 0; mask < 32; mask++) {
      out.push([style, ...library.RESTRICTIONS.filter((_, bit) => mask & (1 << bit))]);
    }
  }
  return out;
}

test('all 96 UI selections normalize to exactly 80 prepared templates', () => {
  const raw = rawSelections();
  assert.equal(raw.length, 96);
  const selected = raw.map(values => library.selectTemplate({ dietary_requirements: values }));
  assert.equal(new Set(selected.map(template => template.id)).size, 80);
  assert.equal(library.TEMPLATES.length, 80);
  assert.equal(library.selectTemplate({ dietary_requirements: ['vegan'] }).id,
    library.selectTemplate({ dietary_requirements: ['vegan', 'dairy_free'] }).id);
});

test('templates contain 240 daily menus and 1,200 meal placements with requested repetition', () => {
  assert.equal(library.TEMPLATES.length * 3, 240);
  assert.equal(library.TEMPLATES.length * 3 * 5, 1200);
  for (const template of library.TEMPLATES) {
    const days = library.expandTemplate(template);
    assert.equal(days.length, 7);
    assert.equal(days.flatMap(day => day.meals).length, 35);
    assert.deepEqual(days[0].meals, days[1].meals);
    assert.deepEqual(days[1].meals, days[2].meals);
    assert.deepEqual(days[3].meals, days[4].meals);
    assert.deepEqual(days[5].meals, days[6].meals);
  }
});

test('every bank recipe respects supported restrictions and has an exact local photo', () => {
  assert.equal(Object.keys(library.RECIPES).length, 21);
  for (const recipe of Object.values(library.RECIPES)) {
    for (const tag of ['gluten_free', 'dairy_free', 'nut_free', 'soy_free', 'low_fodmap']) {
      assert.ok(recipe.compatibility.includes(tag), `${recipe.id} missing ${tag}`);
    }
    if (recipe.id.startsWith('o')) {
      assert.ok(recipe.compatibility.includes('omnivore'), `${recipe.id} is not omnivore compatible`);
      assert.ok(!recipe.compatibility.includes('vegan'), `${recipe.id} must not be offered to vegans`);
    } else {
      assert.ok(recipe.compatibility.includes('vegan'), `${recipe.id} is not vegan compatible`);
    }
    const ingredientText = recipe.ingredients.map(item => item.name).join(' ');
    assert.doesNotMatch(ingredientText, forbidden, `${recipe.id} contains a forbidden ingredient`);
    assert.ok(fs.existsSync(path.join(__dirname, '..', recipe.image)), `${recipe.id} photo is missing`);
  }
});

test('highly restrictive selections resolve synchronously without a generated asset', () => {
  for (const style of library.STYLES) {
    const requirements = [style, ...library.RESTRICTIONS];
    const template = library.selectTemplate({ dietary_requirements: requirements });
    const placements = library.expandTemplate(template).flatMap(day => day.meals);
    assert.equal(placements.length, 35);
    assert.ok(placements.every(item => library.RECIPES[item.recipe_id].image.startsWith('images/meals/prepared-v')));
  }
});

test('omnivore weeks contain meat at every lunch and dinner while plant-based plans do not', () => {
  const meat = /\b(?:chicken|salmon|turkey|beef|pork)\b/i;
  for (const requirements of [
    ['omnivore'],
    ['omnivore', ...library.RESTRICTIONS]
  ]) {
    const meals = library.expandTemplate(library.selectTemplate({ dietary_requirements: requirements }))
      .flatMap(day => day.meals)
      .filter(meal => meal.meal_slot === 'lunch' || meal.meal_slot === 'dinner')
      .map(meal => library.RECIPES[meal.recipe_id]);
    assert.equal(meals.length, 14);
    assert.ok(meals.every(recipe => meat.test(`${recipe.name} ${recipe.ingredients.map(i => i.name).join(' ')}`)));
  }
  for (const style of ['vegan', 'vegetarian']) {
    const meals = library.expandTemplate(library.selectTemplate({ dietary_requirements: [style] }))
      .flatMap(day => day.meals)
      .map(meal => library.RECIPES[meal.recipe_id]);
    assert.ok(meals.every(recipe => !recipe.id.startsWith('o')));
  }
  assert.equal(library.selectTemplate({ dietary_requirements: ['pescatarian'] }).style, 'vegetarian');
});

test('the customer onboarding path selects and persists the prepared plan without AI meals or images', () => {
  assert.match(onboardingSource, /buildFreshMetaPreviewMealPlan[\s\S]{0,180}return buildPreparedMetaPreviewMealPlan/);
  const preparedStart = onboardingSource.indexOf('async function buildPreparedMetaPreviewMealPlan');
  const preparedEnd = onboardingSource.indexOf('\nfunction startFreshMetaPreviewMealPlan', preparedStart);
  const preparedPath = onboardingSource.slice(preparedStart, preparedEnd);
  assert.match(preparedPath, /populatePreparedMealPlan/);
  assert.match(preparedPath, /localStorage\.setItem\('ai_meal_plan'/);
  assert.doesNotMatch(preparedPath, /fetchMealPlanDay|generateExactMealPhoto|ensureExactMealPlanPhotos/);
});

test('saving dietary preferences regenerates from the exact newly saved selection', () => {
  assert.match(onboardingSource, /async function generateAiMealPlan\(foodPreferencesOverride\)/);
  assert.match(onboardingSource, /foodPreferencesOverride\s*\?\s*Promise\.resolve\(foodPreferencesOverride\)/);
  assert.match(pickerSource, /await Promise\.all\(\[quizWrite, prefsWrite\]\)/);
  assert.match(pickerSource, /await window\.generateAiMealPlan\(foodPrefs\)/);
  assert.match(pickerSource, /_dietEatingStyles\.forEach\(option => _dietPickerSelected\.delete\(option\.value\)\)/);
});
