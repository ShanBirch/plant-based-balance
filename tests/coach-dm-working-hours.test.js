const assert = require('assert');

const {
    getBrisbaneMinuteOfDay,
    isCoachDmManagerWorkingTime,
    isMinuteInWindow,
    resolveCoachDmManagerScheduledFor,
} = require('../netlify/functions/_lib/coach-dm-working-hours');

assert.strictEqual(isMinuteInWindow(4 * 60 + 59, 5 * 60, 2 * 60), false);
assert.strictEqual(isMinuteInWindow(5 * 60, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(23 * 60 + 59, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(1 * 60 + 59, 5 * 60, 2 * 60), true);
assert.strictEqual(isMinuteInWindow(2 * 60, 5 * 60, 2 * 60), false);

assert.strictEqual(getBrisbaneMinuteOfDay(new Date('2026-06-23T18:59:00.000Z')), 4 * 60 + 59);

const deferredAcrossPause = resolveCoachDmManagerScheduledFor(
    new Date('2026-06-24T15:30:00.000Z'),
    60 * 60 * 1000
);
assert.strictEqual(deferredAcrossPause.requestedFor.toISOString(), '2026-06-24T16:30:00.000Z');
assert.strictEqual(deferredAcrossPause.scheduledFor.toISOString(), '2026-06-24T16:30:00.000Z');
assert.strictEqual(deferredAcrossPause.deferredForWorkingHours, false);

const nextSlotStartsCleanly = resolveCoachDmManagerScheduledFor(
    new Date('2026-06-23T18:29:45.500Z'),
    30 * 1000
);
assert.strictEqual(nextSlotStartsCleanly.scheduledFor.toISOString(), '2026-06-23T18:30:15.500Z');

const allowedOvernight = resolveCoachDmManagerScheduledFor(
    new Date('2026-06-24T13:30:00.000Z'),
    60 * 60 * 1000
);
assert.strictEqual(allowedOvernight.requestedFor.toISOString(), '2026-06-24T14:30:00.000Z');
assert.strictEqual(allowedOvernight.scheduledFor.toISOString(), '2026-06-24T14:30:00.000Z');
assert.strictEqual(allowedOvernight.deferredForWorkingHours, false);
assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-23T18:59:00.000Z')),
    true,
    '04:59 Brisbane should be available'
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
    true,
    '02:00 Brisbane should remain available'
);

assert.strictEqual(
    isCoachDmManagerWorkingTime(new Date('2026-06-24T06:30:00.000Z')),
    true,
    '16:30 Brisbane should remain available'
);

console.log('coach DM working-hours tests passed');
