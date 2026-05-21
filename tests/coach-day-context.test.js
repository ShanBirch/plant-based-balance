const assert = require('assert');

const {
    buildCoachDayContextBlock,
} = require('../netlify/functions/_lib/client-context');

assert.strictEqual(buildCoachDayContextBlock([]), '');

const block = buildCoachDayContextBlock([
    {
        note_date: '2026-05-21',
        note: 'legs and a short walk, curry meal prep, fixing DM drafts',
    },
]);

assert.ok(block.includes('SHANNON DAY CONTEXT'), 'labels the block');
assert.ok(block.includes('legs and a short walk'), 'includes note detail');
assert.ok(block.includes('Use only when they directly ask'), 'keeps context gated');
assert.ok(block.includes('Use at most one small detail'), 'prevents diary dumps');

console.log('coach day context tests passed');
