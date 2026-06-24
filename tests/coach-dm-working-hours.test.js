const assert = require('assert');

const {
    getBrisbaneMinuteOfDay,
    isCoachDmManagerWorkingTime,
    isMinuteInWindow,
} = require('../netlify/functions/_lib/coach-dm-working-hours');

assert.strictEqual(isMinuteInWindow(4 * 60 + 59, 5 * 60, 2 * 60), false);
assert.strictEqual(isMinuteInWindow(5 * 60, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(23 * 60 + 59, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(1 * 60 + 59, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(2 * 60, 5 * 60, 2 * 60), false);

assert.strictEqual(
    getBrisbaneMinuteOfDay(new Date('2026-06-23T18:59:00.000Z')),
    4 * 60 + 59,
    '18:59 UTC should be 04:59 Brisbane'
);
assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-23T18:59:00.000Z')),
    false,
    '04:59 Brisbane should be paused'
);
assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-23T19:00:00.000Z')),
    true,
    '05:00 Brisbane should resume'
);
assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-24T15:59:00.000Z')),
    true,
    '01:59 Brisbane should still be working'
);
assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-24T16:00:00.000Z')),
    false,
    '02:00 Brisbane should pause'
);

console.log('coach DM working-hours tests passed');
