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

const fraLessons = buildFallbackEditLearningBullets({
    editReason: 'too many questions for Fra',
    draftText: 'hey Fra, how are you? what are you up to? do you want the details?',
    sentMessage: 'hey Fra, how are you going?',
    metrics: {
        draft_chars: 65,
        final_chars: 28,
        final_shannon_authored_pct: 50,
        character_change_pct: 57,
    },
});

assert.ok(
    fraLessons.some(lesson => lesson.includes('one question max')),
    'Fra edit learning should collapse question-heavy replies'
);

const fraSocialRewriteLessons = buildFallbackEditLearningBullets({
    editReason: '',
    draftText: 'Oh yesss, vegan panettone is such a good future plan. I reckon it will be a proper project, but worth it if you are into that Italian pastry vibe.\nAre you thinking more fluffy bread-style panettone, or the sweeter dessert-y version?',
    sentMessage: 'Yeah I love that Fra! What would need to change in it? Eggies?',
    metrics: {
        draft_chars: 223,
        final_chars: 61,
        draft_kept_pct: 12,
        final_shannon_authored_pct: 80,
        character_change_pct: 88,
    },
    alert: {
        client_name: 'Francesca',
        alert_type: 'ig_incoming_dm',
        data: {
            channel: 'instagram',
            profile_name: 'cavazzanafrancesca',
        },
    },
});

assert.ok(
    fraSocialRewriteLessons.some(lesson => lesson.includes('very short social replies')),
    'Fra social rewrites should learn short social reply shape without an edit reason'
);
assert.ok(
    fraSocialRewriteLessons.some(lesson => lesson.includes('food, study, pastry')),
    'Fra social rewrites should stop turning casual IG topics into coaching/discovery'
);

console.log('emoji reaction learning tests passed');
