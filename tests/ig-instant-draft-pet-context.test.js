const assert = require('assert');

const {
    buildNativeStoryOutreachContextBlock,
    suppressPetSpeciesGuessingInDraftChunks,
} = require('../netlify/functions/ig-instant-draft')._test;

const nativeContext = buildNativeStoryOutreachContextBlock({
    ig_username: 'pole_bexi',
    custom_data: {
        last_story_outreach: {
            story_id: '3902384915382456904',
            story_description: 'The story shows a black and white cat lying on a cat tree. A toy hangs nearby.',
            story_visible_text: '',
            story_content_type: 'own_story',
            sent_comment: 'whats their name?',
            captured_at: '2026-05-23T01:00:00.000Z',
        },
    },
}, 'pole_bexi');

assert.ok(nativeContext.block.includes('black and white cat'));
assert.strictEqual(nativeContext.summary.story_description.includes('cat'), true);

const chunks = suppressPetSpeciesGuessingInDraftChunks([
    'morning! nero looks cute',
    'what kinda doggo is that?',
], {
    currentMessageText: 'Nero',
    qualifier: {
        facts: {
            relationship_checklist: {
                pets: 'Nero',
            },
        },
    },
    nativeStoryContextSummary: nativeContext.summary,
});

assert.deepStrictEqual(chunks, ['morning! nero looks cute']);

const neutralChunks = suppressPetSpeciesGuessingInDraftChunks([
    'nero looks cute',
    'what kinda doggo is that?',
], {
    currentMessageText: 'Nero',
    qualifier: {
        facts: {
            relationship_checklist: {
                pets: 'Nero',
            },
        },
    },
});

assert.deepStrictEqual(neutralChunks, ['nero looks cute']);

console.log('ig instant draft pet context tests passed');
