const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const dashboard = fs.readFileSync('dashboard.html', 'utf8');
const mealPlanScript = fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js', 'utf8');
const themeCss = fs.readFileSync('css/dashboard/pbb-premium-overlays.css', 'utf8');

test('includes the weekly meal Home card and both discovery entries', () => {
    assert.match(dashboard, /id="weekly-meal-evolution-home-card"/);
    assert.match(dashboard, /id: 'weekly-meal-home-card-v1'/);
    assert.match(dashboard, /tab:'dashboard', sel:'#weekly-meal-evolution-home-card'/);
    assert.match(dashboard, /fallbackSel: '\.bottom-nav \.nav-item\[onclick\*="meals"\]'/);
});

test('refreshes the card from Home and excludes hydration logs', () => {
    assert.match(mealPlanScript, /scheduleDashboardTaskForActiveUser\(refreshWeeklyMealEvolutionHomeCard, 2250\)/);
    assert.match(mealPlanScript, /\.neq\('meal_type', 'water'\)/);
    assert.match(mealPlanScript, /pbb_weekly_meal_evolution_attempt_v2_/);
});

test('makes the whole completed card open the tailored meals', () => {
    assert.match(mealPlanScript, /state === 'tailored'\s*\? openWeeklyMealEvolutionPlan/);
    assert.match(mealPlanScript, /card\.onclick = activate/);
    assert.match(mealPlanScript, /card\.setAttribute\('tabindex', '0'\)/);
    assert.match(mealPlanScript, /switchWeek\('meal-plan-store', pill\)/);
});

test('defines explicit dark and light card treatments', () => {
    assert.match(themeCss, /\.weekly-meal-evolution-home-card__inner/);
    assert.match(themeCss, /html\[data-pbb-theme="light"\] \.weekly-meal-evolution-home-card__inner/);
    assert.match(themeCss, /-webkit-text-fill-color/);
    assert.match(themeCss, /:focus-visible/);
});
