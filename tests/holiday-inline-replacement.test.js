const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js', 'utf8');
const start = source.indexOf('window.openCalendarWorkout = async function');
const end = source.indexOf('// Active custom program takes precedence', start);
const launch = source.slice(start, end) + "throw new Error('regular program fallback'); };";
test('dated holiday session launches its bodyweight exercises instead of the usual program', async () => {
    const workout = { type: 'inline', name: 'Holiday A', exercises: [{ name: 'Plank', sets: 3, reps: '30 sec', prescribedWeightKg: 0 }] };
    let launched;
    const context = vm.createContext({ window: {}, getWorkoutSourceDayIndex: x => x,
        getReplacementForDay: (day, date) => date >= '2026-10-19' && date <= '2026-11-01' ? { replacement_workout: workout } : null,
        startInlineWorkout: async value => { launched = value; }, showToast: () => {} });
    vm.runInContext(launch, context);
    await context.window.openCalendarWorkout(0, '2026-10-19');
    assert.equal(launched, workout);
    await assert.rejects(context.window.openCalendarWorkout(0, '2026-10-12'), /regular program fallback/);
    await assert.rejects(context.window.openCalendarWorkout(0, '2026-11-02'), /regular program fallback/);
});
test('empty temporary session never silently launches the usual workout', async () => {
    let message;
    const context = vm.createContext({ window: {}, getWorkoutSourceDayIndex: x => x,
        getReplacementForDay: () => ({ replacement_workout: { type: 'inline', exercises: [] } }),
        showToast: value => { message = value; }, startInlineWorkout: () => { throw new Error('must not launch'); } });
    vm.runInContext(launch, context);
    await context.window.openCalendarWorkout(0, '2026-10-19');
    assert.match(message, /no exercises/);
});
