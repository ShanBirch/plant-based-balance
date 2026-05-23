const assert = require('assert');

const {
    buildFallbackEditLearningBullets,
    buildShannonDmTuningBlock,
} = require('../netlify/functions/_lib/client-context');

const tuningBlock = buildShannonDmTuningBlock();

assert.ok(
    tuningBlock.includes('Treat emojis as tone, not as the topic'),
    'global DM tuning treats emojis as tone'
);
assert.ok(
    tuningBlock.includes('love the heart emoji'),
    'global DM tuning names the awkward emoji-commentary pattern'
);
assert.ok(
    tuningBlock.includes('Do not point out emoji usage'),
    'global DM tuning rejects narrating emoji usage'
);

const lessons = buildFallbackEditLearningBullets({
    editReason: "A human wouldn't say, love the heart emoji",
    draftText: 'morning! nero looks cute, love the heart emoji\nwhat kinda doggo is that?',
    sentMessage: 'morning! nero looks cute,\nwhat kinda doggo is that?',
    metrics: {
        draft_chars: 74,
        final_chars: 51,
        final_shannon_authored_pct: 20,
        character_change_pct: 25,
    },
});

assert.ok(
    lessons.some(lesson => lesson.includes('Treat emojis as tone')),
    'fallback edit learning converts emoji feedback into a reusable rule'
);
assert.ok(
    lessons.some(lesson => lesson.includes('Do not point out or praise the emoji itself')),
    'fallback edit learning rejects narrating the emoji'
);

console.log('emoji reaction learning tests passed');
