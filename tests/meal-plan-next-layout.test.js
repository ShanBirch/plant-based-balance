const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const mealPlanScript = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);

test('ships the focused meal layout and cache-busted client assets', () => {
    assert.match(dashboard, /class="ai-plan-focus-layout"/);
    assert.match(dashboard, /lib\/meal-plan-next-meal\.js\?v=1/);
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=216-shopping-tour-direct/);
    assert.match(dashboard, /meal-plan-next-meal-focus-v1/);
});

test('uses today meal logs to advance the hero and exposes real actions', () => {
    assert.match(mealPlanScript, /\.from\('meal_logs'\)[\s\S]+\.eq\('meal_date', dateKey\)/);
    assert.match(mealPlanScript, /class="ai-plan-hero" data-next-meal=/);
    assert.match(mealPlanScript, />View recipe<\/button>/);
    assert.match(mealPlanScript, />Log meal<\/button>/);
    assert.match(mealPlanScript, /function selectAiPlanMeal\(index\)/);
    assert.match(mealPlanScript, /function selectAiPlanMealRelative\(direction\)/);
    assert.match(mealPlanScript, /aria-label="Previous meal"/);
    assert.match(mealPlanScript, /aria-label="Next meal"/);
    assert.match(mealPlanScript, /ai-plan-hero__carousel-count/);
    assert.match(mealPlanScript, /function openAiMealPlanView\(btn\)[\s\S]+_aiMealPlanLoggedDayKey = ''/);
});

test('the paid preview can open the first day and explain the meal carousel', () => {
    assert.match(mealPlanScript, /function selectAiPlanFirstDay\(\)/);
    assert.match(mealPlanScript, /window\.selectAiPlanFirstDay = selectAiPlanFirstDay/);
    assert.match(dashboard, /title:'See every meal on Day 1'/);
    assert.match(dashboard, /Tap the highlighted arrow to look through breakfast, lunch, dinner and snacks/);
    assert.match(dashboard, /window\.selectAiPlanFirstDay/);
});
