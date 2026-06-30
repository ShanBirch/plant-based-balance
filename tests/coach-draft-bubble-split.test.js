const assert = require('assert');

const {
    applyPhoneAutocorrectCapitalization,
    formatTimedConversationLine,
    normalizeCoachDraftText,
    sanitizeVisibleOutboundDmText,
    splitCoachDraftIntoDmBubbles,
    stripLeadingGreeting,
} = require('../netlify/functions/_lib/client-context');

assert.deepStrictEqual(
    splitCoachDraftIntoDmBubbles('line one\n\nline two'),
    ['line one', 'line two']
);

assert.deepStrictEqual(
    splitCoachDraftIntoDmBubbles('line one\\nline two'),
    ['line one\nline two']
);

assert.strictEqual(
    normalizeCoachDraftText('line one\\nline two'),
    'line one\nline two'
);

assert.strictEqual(
    normalizeCoachDraftText('line one\\\\nline two'),
    'line one\nline two'
);

assert.strictEqual(
    normalizeCoachDraftText('Haha nah mate,\\nJust me being a weirdo'),
    'Haha nah mate,\nJust me being a weirdo'
);

assert.strictEqual(
    normalizeCoachDraftText('line one\\r\\nline two'),
    'line one\nline two'
);

const sanitizedLeadCopy = sanitizeVisibleOutboundDmText('Haha nah mate,\\n[ephemeral] fuckin hell');
assert.ok(!sanitizedLeadCopy.includes('\\n'));
assert.ok(!sanitizedLeadCopy.includes('[ephemeral]'));
assert.ok(!/fuck/i.test(sanitizedLeadCopy));
assert.strictEqual(
    sanitizeVisibleOutboundDmText('yeah sounds good mate'),
    'yeah sounds good mate'
);

assert.strictEqual(
    normalizeCoachDraftText('line one\\u000Aline two'),
    'line one\nline two'
);

assert.strictEqual(
    normalizeCoachDraftText('sweet — no dramas, will sort it'),
    'sweet, no dramas, will sort it'
);

assert.strictEqual(
    normalizeCoachDraftText('line one&#92;nline two'),
    'line one\nline two'
);

const joyEmoji = String.fromCodePoint(0x1f602);

assert.strictEqual(
    normalizeCoachDraftText('oh no that is diabolical u{1F602} / 4:30 landing into 7am work is boss level'),
    `oh no that is diabolical ${joyEmoji} / 4:30 landing into 7am work is boss level`
);

assert.strictEqual(
    normalizeCoachDraftText('that emoji had one job \\u{1F602}'),
    `that emoji had one job ${joyEmoji}`
);

assert.strictEqual(
    normalizeCoachDraftText('that emoji had one job \\uD83D\\uDE02'),
    `that emoji had one job ${joyEmoji}`
);

assert.strictEqual(
    normalizeCoachDraftText('that emoji had one job U+1F602'),
    `that emoji had one job ${joyEmoji}`
);

assert.strictEqual(
    normalizeCoachDraftText('that emoji had one job &#x1F602;'),
    `that emoji had one job ${joyEmoji}`
);

assert.ok(
    !formatTimedConversationLine({
        speaker: 'Shannon',
        text: 'Haha nah mate,\\nJust me being a weirdo',
        createdAt: '2026-06-01T07:31:00.000Z',
        now: new Date('2026-06-01T07:40:00.000Z'),
    }).includes('\\n')
);

assert.deepStrictEqual(
    splitCoachDraftIntoDmBubbles(['ahh yum', 'that is a good sweet treat']),
    ['ahh yum', 'that is a good sweet treat']
);

assert.strictEqual(
    applyPhoneAutocorrectCapitalization("yeah that makes sense. i'm keen to see how that goes"),
    "Yeah that makes sense. I'm keen to see how that goes"
);

assert.strictEqual(
    stripLeadingGreeting('Hey Sarah, yeah that makes sense. i can sort that'),
    'Yeah that makes sense. I can sort that'
);

const manyTinyBubbles = [
    'awww sounds like a big day for teddy',
    'but sit and follow are huge wins, especially when he was feeling scared',
    'the collar thing sounds like a bit of a hurdle for next week',
    'but even just being there and getting those two tasks, that is really something to be proud of him for',
    'that is super interesting about the ayurvedic wellness business',
    'especially with it being local, it has gotta be a relief not to drive all that way',
    'i remember you mentioned looking into it before. keen to hear what she finds',
    'and yeah, totally agree about the goals and progress bars',
    'it is such a simple but powerful thing to see yourself chipping away at something',
    'have you already booked in with her, or are you just thinking about it?',
];

const coalescedBubbles = splitCoachDraftIntoDmBubbles(manyTinyBubbles);
assert.ok(coalescedBubbles.length > 1);
assert.ok(coalescedBubbles.length <= 4);
assert.ok(coalescedBubbles.some(chunk => chunk.includes('\n\n')));
assert.ok(coalescedBubbles.every(chunk => chunk.length <= 900));

console.log('coach draft bubble split tests passed');
