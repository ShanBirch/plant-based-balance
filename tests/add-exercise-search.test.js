const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const match = source.match(/function addExerciseSearchTermMatches\([\s\S]*?\n}\n\n\/\/ Search exercises for add modal/);

assert.ok(match, 'add-exercise semantic search helper should be present');

const context = {};
vm.runInNewContext(match[0].replace(/\n\/\/ Search exercises for add modal$/, ''), context);

const matches = (name, query) => {
    const terms = query.toLowerCase().split(' ').filter(Boolean);
    const nameLower = name.toLowerCase();
    return terms.every(term => context.addExerciseSearchTermMatches(nameLower, term, terms));
};

assert.strictEqual(matches('Machine Seated Abduction', 'seated hip abduction'), true);
assert.strictEqual(matches('Machine Seated Hip Adduction', 'seated hip adduction'), true);
assert.strictEqual(matches('Machine Seated Abduction', 'seated hip adduction'), false);
assert.strictEqual(matches('Machine Seated Abduction', 'seated hip rotation'), false);

console.log('add-exercise-search tests passed');
