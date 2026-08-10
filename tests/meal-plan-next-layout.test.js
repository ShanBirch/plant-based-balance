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
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=178/);
    assert.match(dashboard, /meal-plan-next-meal-focus-v1/);
});

test('uses today meal logs to advance the hero and exposes real actions', () => {
    assert.match(mealPlanScript, /\.from\('meal_logs'\)[\s\S]+\.eq\('meal_date', dateKey\)/);
    assert.match(mealPlanScript, /class="ai-plan-hero" data-next-meal=/);
    assert.match(mealPlanScript, />View recipe<\/button>/);
    assert.match(mealPlanScript, />Log meal<\/button>/);
    assert.match(mealPlanScript, /function selectAiPlanMeal\(index\)/);
    assert.match(mealPlanScript, /function openAiMealPlanView\(btn\)[\s\S]+_aiMealPlanLoggedDayKey = ''/);
});
