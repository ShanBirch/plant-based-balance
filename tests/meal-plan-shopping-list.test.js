const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shopping = require('../lib/meal-plan-shopping-list.js');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const mealPlanScript = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const premiumCss = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');

const week = {
    week_number: 2,
    days: [
        {
            meals: [
                {
                    ingredients: [
                        { name: 'Rolled oats', amount: '1 cup' },
                        { name: 'Almond milk', amount: '1 cup' },
                        'Sea salt'
                    ]
                },
                {
                    ingredients: [
                        { name: 'rolled oats', amount: '1 cup' },
                        { name: 'Almond milk', amount: '1/2 cup' },
                        { ingredient: 'Sea salt' }
                    ]
                }
            ]
        }
    ]
};

test('combines, deduplicates and sorts a week of meal-plan ingredients', () => {
    const items = shopping.buildWeekItems(week);

    assert.deepEqual(items.map(item => item.name), ['Almond milk', 'Rolled oats', 'Sea salt']);
    assert.equal(items[0].amount, '1 cup + 1/2 cup');
    assert.equal(items[1].amount, '1 cup x 2');
    assert.equal(items[2].amount, 'needed in 2 meals');
});

test('downloads a readable checklist with checked state', () => {
    const items = shopping.buildWeekItems(week);
    const text = shopping.toText({
        planName: 'Plant Powered Week',
        weekNumber: 2,
        items,
        checked: new Set(['rolled oats'])
    });

    assert.match(text, /^BALANCE SHOPPING LIST\nPlant Powered Week \| Week 2/m);
    assert.match(text, /\[x\] Rolled oats - 1 cup x 2/);
    assert.match(text, /\[ \] Almond milk - 1 cup \+ 1\/2 cup/);
});

test('wires the personalized list into meal-plan navigation and release guidance', () => {
    assert.match(dashboard, /lib\/meal-plan-shopping-list\.js\?v=1/);
    assert.match(dashboard, /id="ai-plan-shopping-toggle"/);
    assert.match(dashboard, /id="ai-plan-shopping-download"/);
    assert.match(dashboard, /onclick="openAiMealPlanShoppingList\(this\)"/);
    assert.match(dashboard, /meal-plan-shopping-list-v1/);
    assert.match(dashboard, /Your weekly shopping list/);
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=225-calendar-home-coins/);
    assert.match(dashboard, /pbb-premium-overlays\.css\?v=102-community-games-theme/);

    assert.match(mealPlanScript, /function renderAiPlanShoppingList\(\)/);
    assert.match(mealPlanScript, /function updateAiPlanShoppingItem\(input\)/);
    assert.match(mealPlanScript, /function downloadAiPlanShoppingList\(\)/);
    assert.match(mealPlanScript, /renderAiPlanDay\(_aiMealPlanCurrentDay\);\s+renderAiPlanShoppingList\(\);/);
});

test('defines explicit readable light and dark shopping-list themes', () => {
    assert.match(premiumCss, /html\[data-pbb-theme="light"\] \.ai-plan-shopping/);
    assert.match(premiumCss, /html\[data-pbb-theme="dark"\] \.ai-plan-shopping/);
    assert.match(premiumCss, /-webkit-text-fill-color: #fffaf2 !important/);
    assert.match(premiumCss, /-webkit-text-fill-color: #151515 !important/);
});
