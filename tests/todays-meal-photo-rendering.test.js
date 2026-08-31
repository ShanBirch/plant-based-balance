const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const trackerPath = path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js');
const source = fs.readFileSync(trackerPath, 'utf8');

function extractPhotoResolvers() {
    const start = source.indexOf('function normalizeMealSharePhotoUrl(');
    const end = source.indexOf('\nfunction rememberMealCapturedPhotoFallback(', start);
    assert.notEqual(start, -1, 'photo URL normalizer should exist');
    assert.notEqual(end, -1, 'photo resolver block should have a stable end');
    return source.slice(start, end);
}

function loadPhotoResolvers() {
    const context = {};
    vm.runInNewContext(
        `${extractPhotoResolvers()}\nthis.getMealSharePhotoUrl = getMealSharePhotoUrl;`,
        context
    );
    return context;
}

test("Today's Meals resolves a photo saved outside the legacy photo_url field", () => {
    const { getMealSharePhotoUrl } = loadPhotoResolvers();
    const expected = 'https://images.example/member-meal.jpg';

    assert.equal(getMealSharePhotoUrl({ photo_url: 'text-input', storage_path: expected }), expected);
    assert.match(source, /const photoUrl = getMealSharePhotoUrl\(meal\);[\s\S]*?<img src="\$\{photoUrl\}" alt="Meal photo"/);
});

test('legacy B2 object keys still resolve to the original meal photo', () => {
    const { getMealSharePhotoUrl } = loadPhotoResolvers();
    const key = 'meals/1c054ebd-cb5d-4449-a6c2-ed4c5c286076/1788076277509.jpg';

    assert.equal(
        getMealSharePhotoUrl({ photo_url: 'text-input', storage_path: key }),
        `https://f005.backblazeb2.com/file/plantbasedbalancestories/${key}`
    );
});

test('meal detail view uses the same resolved photo as the card', () => {
    assert.match(source, /function openMealDetailPopup\([\s\S]*?const photoUrl = getMealSharePhotoUrl\(meal\);/);
    assert.doesNotMatch(
        source.slice(source.indexOf('function openMealDetailPopup('), source.indexOf('\nfunction closeMealDetailPopup(')),
        /<img src="\$\{meal\.photo_url\}"/
    );
});
