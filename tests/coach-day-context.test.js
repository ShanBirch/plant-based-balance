const assert = require('assert');

const {
    buildCoachDayContextBlock,
} = require('../netlify/functions/_lib/client-context');

assert.strictEqual(buildCoachDayContextBlock([]), '');

const block = buildCoachDayContextBlock([
    {
        note_date: '2026-05-21',
        training: 'legs and a short walk',
        food: 'curry meal prep',
        work: 'fixing DM drafts',
        vibe: 'rainy computer day',
        other: '',
    },
]);

assert.ok(block.includes('SHANNON DAY CONTEXT'), 'labels the block');
assert.ok(block.includes('training: legs and a short walk'), 'includes training detail');
assert.ok(block.includes('food: curry meal prep'), 'includes food detail');
assert.ok(block.includes('work: fixing DM drafts'), 'includes work detail');
assert.ok(block.includes('Use only when they directly ask'), 'keeps context gated');
assert.ok(block.includes('Use at most one small detail'), 'prevents diary dumps');

console.log('coach day context tests passed');
