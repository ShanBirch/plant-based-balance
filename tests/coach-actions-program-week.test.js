const assert = require('assert');

const { detectProposedCoachActions } = require('../netlify/functions/_lib/coach-actions');

const [action] = detectProposedCoachActions({
    messageText: "Hey mate. Sorry about the week I haven't trained once. Is there a chance to get my week two training starting on Monday? I'm keen to push the front squats.",
});

assert.ok(action, 'week reset request should create an action');
assert.strictEqual(action.type, 'set_program_week');
assert.strictEqual(action.payload.target_week, 2);
assert.strictEqual(action.payload.target_day, 'Mon');
assert.match(action.label, /week 2/i);
assert.match(action.label, /Mon/);

assert.deepStrictEqual(
    detectProposedCoachActions({ messageText: "Next week I'm aiming for the perfect week." }),
    [],
    'general week chat should not create a program reset action'
);

assert.deepStrictEqual(
    detectProposedCoachActions({ messageText: 'Week 2 review looked strong.' }),
    [],
    'reviewing a week number should not create a program reset action'
);

console.log('coach actions program week tests passed');
