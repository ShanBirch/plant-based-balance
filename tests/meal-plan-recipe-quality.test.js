const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const generator = fs.readFileSync(path.join(root, 'netlify/edge-functions/generate-meal-plan.ts'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

test('future generated recipes require complete ingredients and numbered methods', () => {
    assert.match(generator, /prepared-diet-engine/);
    const engine = require('../lib/prepared-diet-engine.js');
    for (const recipe of Object.values(engine.RECIPES)) {
        assert.ok(recipe.ingredients.every(i => engine.FOODS[i.food_id] && i.grams > 0), recipe.name);
        assert.match(recipe.preparation, /1\..+2\./);
    }
});

test('the meal card renders numbered preparation steps', () => {
    assert.match(renderer, /function formatAiPlanPreparation\(value\)/);
    assert.match(renderer, /<ol>\$\{steps\.map/);
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=240-all-diet-plans/);
});
