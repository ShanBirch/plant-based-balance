const assert = require('assert');

const {
    buildCoachDayContextBlock,
    isDirectShannonPersonalAsk,
    shouldIncludeCoachDayContext,
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

assert.strictEqual(
    isDirectShannonPersonalAsk('Thank you hope you’re enjoying your day too'),
    false,
    'polite day well-wishes are not direct Shannon day asks'
);
assert.strictEqual(
    shouldIncludeCoachDayContext({ currentMessage: 'Thank you hope you’re enjoying your day too' }),
    false,
    'does not load Shannon day notes for polite well-wishes'
);
assert.strictEqual(
    shouldIncludeCoachDayContext({ currentMessage: 'how was your day?' }),
    true,
    'loads Shannon day notes for direct day questions'
);
assert.strictEqual(
    shouldIncludeCoachDayContext({ currentMessage: "how's your day going?" }),
    true,
    'loads Shannon day notes for contracted direct day questions'
);
assert.strictEqual(
    shouldIncludeCoachDayContext({
        currentMessage: 'pretty chilled',
        recentInboundMessages: [{ text: 'what about you?' }],
    }),
    true,
    'loads Shannon day notes when any current inbound directly asks'
);

console.log('coach day context tests passed');
