const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const journey = fs.readFileSync(path.join(__dirname, '..', 'journey.html'), 'utf8');

test('About journey makes the plant-based-from-birth story visible', () => {
    assert.match(journey, /I was plant-based from birth, raised in a vegetarian household on Tamborine Mountain/);
    assert.match(journey, /raised vegetarian from birth on Tamborine Mountain/);
    assert.match(journey, /five years as a vegan/);
    assert.match(journey, /<span class="tag">plant-based from birth<\/span>/);
});

test('About journey describes Balance as an established product', () => {
    assert.match(journey, /Back on the Gold Coast, running Balance/);
    assert.match(journey, /After moving back to Queensland I built Balance/);
    assert.doesNotMatch(journey, /building Balance/);
});
