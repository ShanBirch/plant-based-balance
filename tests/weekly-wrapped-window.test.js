'use strict';

const assert = require('assert');
const { getBrisbaneWallClockDate, getWrappedMonthStart, getMonthKey } = require('../netlify/functions/weekly-wrapped-push');

const augustFirst = getBrisbaneWallClockDate(new Date('2026-07-31T23:00:00.000Z'));
assert.strictEqual(augustFirst.toISOString(), '2026-08-01T09:00:00.000Z');
const julyStart = getWrappedMonthStart(augustFirst);
assert.strictEqual(julyStart.toISOString(), '2026-07-01T00:00:00.000Z');
assert.strictEqual(getMonthKey(julyStart), '2026-07');

const januaryFirst = getBrisbaneWallClockDate(new Date('2025-12-31T23:00:00.000Z'));
const decemberStart = getWrappedMonthStart(januaryFirst);
assert.strictEqual(decemberStart.toISOString(), '2025-12-01T00:00:00.000Z');
assert.strictEqual(getMonthKey(decemberStart), '2025-12');

console.log('monthly wrapped window tests passed');
