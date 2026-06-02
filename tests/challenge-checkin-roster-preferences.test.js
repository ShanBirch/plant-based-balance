const assert = require('assert');

const { _private } = require('../netlify/functions/challenge-checkin-scan');

const { manualCheckinPreference, coachCheckinsExplicitlyDisabled } = _private;

assert.strictEqual(manualCheckinPreference(null, 'monday'), null);

assert.strictEqual(
    manualCheckinPreference({
        preferences: {
            coach_checkins: { enabled: false },
            weekly_checkins: { enabled: true },
            manual_checkins_enabled: true,
        },
    }, 'monday'),
    null,
    'explicit coach_checkins OFF should remove a client from Shannon roster even if old keys were ON'
);

assert.strictEqual(
    coachCheckinsExplicitlyDisabled({
        preferences: {
            coach_checkins: { enabled: false },
        },
    }, 'wednesday'),
    true,
    'explicit coach_checkins OFF should also exclude active challenge participants from coach check-in drafts'
);

assert.ok(
    manualCheckinPreference({
        preferences: {
            coach_checkins: { enabled: true, cadences: ['monday', 'wednesday'] },
        },
    }, 'monday'),
    'coach_checkins ON should include Monday'
);

assert.strictEqual(
    manualCheckinPreference({
        preferences: {
            coach_checkins: { enabled: true, cadences: ['monday', 'wednesday'] },
        },
    }, 'saturday'),
    null,
    'cadences should keep the coach roster separate by scheduled check-in day'
);

assert.ok(
    manualCheckinPreference({
        preferences: {
            weekly_checkins: { enabled: true },
        },
    }, 'wednesday'),
    'legacy weekly_checkins ON should still work for existing roster clients'
);

console.log('challenge check-in roster preferences ok');
