const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');

function loadFormatter(personalBest) {
    const start = source.indexOf('function formatPreviousWorkoutSummary(exerciseName) {');
    const end = source.indexOf('// Generate volume display HTML', start);
    assert.ok(start >= 0 && end > start, 'personal-best formatter should be extractable');
    const functionSource = source.slice(start, end).trim();
    return new Function('getExerciseMaxWeight', `${functionSource}; return formatPreviousWorkoutSummary;`)(() => personalBest);
}

test('personal best renders as one compact, uncluttered header pill', () => {
    const formatter = loadFormatter({ weight: 30, reps: 4, bestReps: 12, bestRepsWeight: 20, date: '2026-07-01' });
    const html = formatter('Dumbbell Bench Press');

    assert.match(html, /class="exercise-history-panel exercise-pb-pill"/);
    assert.match(html, /PB: 30kg &times; 4 reps/);
    assert.match(html, /margin-left:auto/);
    assert.match(html, /border-radius:999px/);
    assert.doesNotMatch(html, /Personal Best|Most reps|<svg|Jul/);
});

test('exercise cards place the PB pill in their title rows', () => {
    assert.equal((source.match(/\$\{previousSummaryHtml\}/g) || []).length, 5);
    assert.doesNotMatch(source, /Full-width Personal Best banner/);

    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    assert.equal((html.match(/dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=154/g) || []).length, 2);
});

test('exercise without a PB does not render an empty pill', () => {
    const formatter = loadFormatter(null);
    assert.equal(formatter('New Exercise'), '');
});
