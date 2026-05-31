const assert = require('assert');

const {
    getBrisbaneWallClockDate,
    getWrappedWeekStart,
    getISOWeek,
} = require('../netlify/functions/weekly-wrapped-push');

const sundayPush = getBrisbaneWallClockDate(new Date('2026-05-30T23:00:00Z'));
assert.strictEqual(sundayPush.getUTCDay(), 0);
assert.strictEqual(sundayPush.getUTCHours(), 9);

const sundayWeekStart = getWrappedWeekStart(sundayPush);
assert.strictEqual(sundayWeekStart.toISOString(), '2026-05-25T00:00:00.000Z');
assert.strictEqual(getISOWeek(sundayWeekStart), '2026-W22');

const mondayNoon = getBrisbaneWallClockDate(new Date('2026-06-01T02:00:00Z'));
assert.strictEqual(mondayNoon.getUTCDay(), 1);
assert.strictEqual(mondayNoon.getUTCHours(), 12);

const mondayWeekStart = getWrappedWeekStart(mondayNoon);
assert.strictEqual(mondayWeekStart.toISOString(), '2026-05-25T00:00:00.000Z');
assert.strictEqual(getISOWeek(mondayWeekStart), '2026-W22');

console.log('weekly wrapped window tests passed');
