const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const generator = fs.readFileSync(path.join(root, 'netlify/edge-functions/generate-meal-plan.ts'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

test('future generated recipes require complete ingredients and numbered methods', () => {
    assert.match(generator, /Every breakfast, lunch and dinner must list at least 8 separate ingredients/);
    assert.match(generator, /Every snack must list at least 5/);
    assert.match(generator, /Recipe quality check failed/);
    assert.match(generator, /const minIngredients = isSnack \? 5 : 8/);
    assert.match(generator, /const minSteps = isSnack \? 2 : 3/);
});

test('the meal card renders numbered preparation steps', () => {
    assert.match(renderer, /function formatAiPlanPreparation\(value\)/);
    assert.match(renderer, /<ol>\$\{steps\.map/);
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=201-phone-onboarding/);
});
