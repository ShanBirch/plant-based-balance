const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const start = source.indexOf('function getPrescribedSetPrefill(');
const end = source.indexOf('function getDateBasedCustomProgramWeekNumber(', start);
const ctx = vm.createContext({});
vm.runInContext(source.slice(start, end), ctx);
const countExpression = source.match(/const numSets = [^;]*ex\.prescriptionOverridesHistory[^;]*;/)[0];
test('coach revision replaces old set counts and hold duration, preserving load history', () => {
    const ex = { sets: 2, reps: '20-40 seconds', prescriptionOverridesHistory: true };
    const rows = vm.runInNewContext(countExpression + 'numSets', { ex, prescribedSets: 2, hasWeekSpecificPlan: false, previousSummary: { setCount: 3 } });
    assert.equal(rows, 2);
    const result = ctx.mergeSetPrefill({ time: '60', reps: '10', kg: '12' }, ctx.getPrescribedSetPrefill(ex, true));
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { kg: '12', explicitLoad: false, reps: '', time: '20' });
});
test('coach rep range starts at its lower bound instead of an old target', () => {
    const result = ctx.mergeSetPrefill({ reps: '6', kg: '30' }, ctx.getPrescribedSetPrefill({ reps: '8-12', prescriptionOverridesHistory: true }, false));
    assert.equal(result.reps, '8');
    assert.equal(result.kg, '30');
});
test('coach can clear irrelevant load history for bands and bodyweight movements', () => {
    const exercise = {
        reps: '12-15 each way',
        prescriptionOverridesHistory: true,
        prescriptionClearsHistoricalLoad: true
    };
    const prescribed = ctx.getPrescribedSetPrefill(exercise, false);
    const result = ctx.mergeSetPrefill({ reps: '12', kg: '7' }, prescribed);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { kg: '', explicitLoad: false, reps: '12', time: '' });
});
test('ordinary workouts retain their previous session defaults', () => {
    const result = ctx.mergeSetPrefill({ reps: '12', kg: '30' }, ctx.getPrescribedSetPrefill({ reps: '8-12' }, false));
    assert.equal(result.reps, '12');
    assert.equal(result.kg, '30');
    assert.equal(ctx.mergeSetPrefill(null, null), null);
});

test('current weekly targets replace old warm-up reps and weights and change with the week', () => {
    const scoped = vm.createContext({ week: { reps: 6, weightKg: 80 } });
    scoped.getCurrentWeeklyPlanItem = () => scoped.week;
    vm.runInContext(source.slice(start, end), scoped);
    const exercise = { reps: '6', weight_kg: 80 };
    const previous = { reps: '8', kg: '60' };
    let result = scoped.mergeSetPrefill(previous, scoped.getPrescribedSetPrefill(exercise, false));
    assert.equal(result.reps, '6');
    assert.equal(result.kg, '80');
    scoped.week = { reps: 7, weightKg: 82.5 };
    result = scoped.mergeSetPrefill(previous, scoped.getPrescribedSetPrefill(exercise, false));
    assert.equal(result.reps, '7');
    assert.equal(result.kg, '82.5');
    assert.equal(previous.kg, '60');
});

test('weekly zero load overrides history; rep-only weekly targets preserve useful load', () => {
    const scoped = vm.createContext({ week: { reps: 12, weightKg: 0 } });
    scoped.getCurrentWeeklyPlanItem = () => scoped.week;
    vm.runInContext(source.slice(start, end), scoped);
    let result = scoped.mergeSetPrefill({ reps: '8', kg: '30' }, scoped.getPrescribedSetPrefill({ reps: '10' }, false));
    assert.equal(result.kg, '0');
    assert.equal(result.reps, '12');
    scoped.week = { reps: 11 };
    result = scoped.mergeSetPrefill({ reps: '8', kg: '30' }, scoped.getPrescribedSetPrefill({ reps: '10' }, false));
    assert.equal(result.kg, '30');
    assert.equal(result.reps, '11');
});
