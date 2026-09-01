const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('dashboard.html');
const nutrition = read('js/dashboard/dashboard-script-11-calorie_tracker_functions.js');
const navigation = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const css = read('css/dashboard/dashboard-style-1.css');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `${name} should exist`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`could not extract ${name}`);
}

test('Nutrition opens a minimal all-time meal history', () => {
    const start = dashboard.indexOf('<div class="weekly-trends-page" id="weekly-trends-page">');
    const end = dashboard.indexOf('<!-- Adaptive Calorie Adjustment Confirmation Modal -->', start);
    const page = dashboard.slice(start, end);

    assert.match(page, />Meal history</);
    assert.match(page, /id="meal-history-summary"/);
    assert.match(page, /id="meal-history-list"/);
    assert.match(page, /id="meal-history-lightbox"/);
    assert.doesNotMatch(page, /weekly-total-calories/);
    assert.doesNotMatch(page, /weekly-daily-breakdown/);
    assert.doesNotMatch(page, /multi-week-section/);
    assert.doesNotMatch(page, /meal-pattern-section/);
    assert.doesNotMatch(page, />Weekly Summary</);
    assert.doesNotMatch(page, />Weekly Trends</);
    assert.doesNotMatch(page, />Meal Patterns</);
});

test('meal history loads every page and keeps photos, dates and times', () => {
    assert.match(nutrition, /async function loadMealHistory\(\)/);
    assert.match(nutrition, /while \(true\)/);
    assert.match(nutrition, /const pageSize = 500/);
    assert.match(nutrition, /\.range\(offset, offset \+ pageSize - 1\)/);
    assert.match(nutrition, /\.order\('meal_date', \{ ascending: false, nullsFirst: false \}\)/);
    assert.match(nutrition, /\.order\('meal_time', \{ ascending: false, nullsFirst: false \}\)/);
    assert.match(nutrition, /getMealSharePhotoUrl\(meal\)/);
    assert.match(nutrition, /formatMealHistoryDate\(dateKey\)/);
    assert.match(nutrition, /formatMealHistoryTime\(meal\)/);
    assert.match(nutrition, /loadMealHistory\(\);/);
    assert.doesNotMatch(
        nutrition.slice(nutrition.indexOf('function openWeeklyTrendsPage'), nutrition.indexOf('function closeWeeklyTrendsPage')),
        /loadWeeklyMetrics|loadMultiWeekData|loadMealPatterns|loadMealJournal/
    );
});

test('meal history labels and time formatting use the saved meal record', () => {
    const helperNames = ['formatMealHistoryTime', 'getMealHistoryLabel'];
    const helperSource = helperNames.map(name => extractFunction(nutrition, name)).join('\n');
    const helpers = new Function(`${helperSource}; return { ${helperNames.join(', ')} };`)();
    const meal = {
        meal_time: '19:05:00',
        meal_type: 'dinner',
        food_items: [{ name: 'Tofu curry' }, { name: 'Brown rice' }]
    };

    assert.match(helpers.formatMealHistoryTime(meal), /7:05/i);
    assert.equal(helpers.getMealHistoryLabel(meal), 'Tofu curry, Brown rice');
    assert.equal(helpers.getMealHistoryLabel({ meal_type: 'lunch' }), 'Lunch');
});

test('the meal screen returns to Activity Insights when opened from there', () => {
    assert.match(dashboard, /openWeeklyTrendsPage\('insights'\)/);
    assert.match(nutrition, /window\._weeklyTrendsReturnView = source === 'insights' \? 'insights' : 'meals'/);
    assert.match(nutrition, /window\._weeklyTrendsReturnView !== 'insights'/);
    assert.match(navigation, /window\._weeklyTrendsReturnView !== 'insights'/);
});

test('meal history is announced to new and returning members', () => {
    assert.equal((dashboard.match(/activity-insights-complete-meal-history-v1/g) || []).length, 1);
    assert.ok((dashboard.match(/sel:\s*'#meal-history-list,#meal-history-empty,#meal-history-loading'/g) || []).length >= 2);
    assert.ok((dashboard.match(/title:\s*'Your complete meal history'/g) || []).length >= 2);
});

test('meal history uses paired Balance light and dark theme tokens', () => {
    assert.match(css, /#weekly-trends-page \{/);
    assert.match(css, /html\[data-pbb-theme="light"\] #weekly-trends-page/);
    assert.match(css, /--meal-history-page: #050505/);
    assert.match(css, /--meal-history-page: #f8f5ee/);
    assert.match(css, /--meal-history-gold: #f5d98a/);
    assert.match(css, /--meal-history-gold: #7a5918/);
    assert.match(css, /-webkit-text-fill-color: var\(--meal-history-text\)/);
});
