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
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { kg: '12', reps: '', time: '20' });
});
test('coach rep range starts at its lower bound instead of an old target', () => {
    const result = ctx.mergeSetPrefill({ reps: '6', kg: '30' }, ctx.getPrescribedSetPrefill({ reps: '8-12', prescriptionOverridesHistory: true }, false));
    assert.equal(result.reps, '8');
    assert.equal(result.kg, '30');
});
test('ordinary workouts retain their previous session defaults', () => {
    const result = ctx.mergeSetPrefill({ reps: '12', kg: '30' }, ctx.getPrescribedSetPrefill({ reps: '8-12' }, false));
    assert.equal(result.reps, '12');
    assert.equal(result.kg, '30');
    assert.equal(ctx.mergeSetPrefill(null, null), null);
});
