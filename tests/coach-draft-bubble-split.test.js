const assert = require('assert');

const {
    applyPhoneAutocorrectCapitalization,
    splitCoachDraftIntoDmBubbles,
    stripLeadingGreeting,
} = require('../netlify/functions/_lib/client-context');

assert.deepStrictEqual(
    splitCoachDraftIntoDmBubbles('line one\n\nline two'),
    ['line one', 'line two']
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
