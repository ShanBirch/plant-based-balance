const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const safety = require('../lib/vegan-meal-safety');
const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const storiesSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stories.js'), 'utf8');
const trackerSource = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js'),
    'utf8'
);
const migrationSource = [
    '20260717235245_enforce_vegan_feed_meals.sql',
    '20260718000024_filter_unsafe_meals_from_network_feed.sql'
].map(file => fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', file), 'utf8')).join('\n');

test('animal-product meals are rejected from the vegan Feed', () => {
    assert.equal(safety.getVeganMealSafetyIssue({ food_items: [{ name: 'Fried eggs' }] }).key, 'egg');
    assert.equal(safety.getVeganMealSafetyIssue({ foods: 'Greek yogurt, PB and honey' }).key, 'yogurt');
    assert.equal(safety.getVeganMealSafetyIssue({ foods: 'WPI protein powder' }).key, 'whey');
    assert.equal(safety.getVeganMealSafetyIssue({ foods: 'Baked salmon and spinach' }).key, 'seafood');
});

test('clearly plant-based alternatives remain shareable', () => {
    [
        'Coconut yoghurt, oats and berries',
        'Soy yogurt with almond butter',
        'Oat milk cappuccino',
        'Vegan cheese toastie',
        'JUST Egg and eggplant on toast',
        'Dairy-free ice cream with banana'
    ].forEach(foods => assert.equal(safety.getVeganMealSafetyIssue({ foods }), null, foods));
});

test('legacy unsafe meal cards are hidden but other Feed cards remain visible', () => {
    const eggs = { media_type: 'meal_card', caption: JSON.stringify({ card_type: 'meal', foods: 'Eggs on toast' }) };
    const coconutYoghurt = { media_type: 'meal_card', caption: JSON.stringify({ card_type: 'meal', foods: 'Coconut yoghurt and oats' }) };
    const workout = { media_type: 'workout_card', caption: 'Upper body PB' };
    assert.equal(safety.isVeganMealFeedStory(eggs), false);
    assert.equal(safety.isVeganMealFeedStory(coconutYoghurt), true);
    assert.equal(safety.isVeganMealFeedStory(workout), true);
});

test('the safety module loads before Feed and blocks meal sharing in the client', () => {
    const safetyIndex = dashboardSource.indexOf('lib/vegan-meal-safety.js?v=1');
    const storiesIndex = dashboardSource.indexOf('lib/stories.js?v=69');
    assert.ok(safetyIndex >= 0 && storiesIndex > safetyIndex);
    assert.match(storiesSource, /window\.isVeganMealFeedStory\(story\)/);
    assert.match(trackerSource, /window\.getVeganMealSafetyIssue\(meal\)/);
    assert.match(trackerSource, /Balance is a vegan community/);
    assert.match(migrationSource, /enforce_vegan_feed_meal_trigger/);
    assert.match(migrationSource, /balance_vegan_feed_meal_is_safe\(s\.caption\)/);
});
