const assert = require('assert');

const {
    buildNativeStoryOutreachContextBlock,
    isSalesAcquisitionThread,
    buildAcquisitionStyleBlock,
    buildAcquisitionMomentumBlock,
    suppressPetSpeciesGuessingInDraftChunks,
    suppressStoryLocationQuestionsInDraftChunks,
    hasKnownStoryLocationContext,
    finalizeDraftChunksFromRawText,
} = require('../netlify/functions/ig-instant-draft')._test;

assert.strictEqual(isSalesAcquisitionThread({ leadStage: 'qualifying', linkedUserId: null }), true);
assert.strictEqual(isSalesAcquisitionThread({ leadStage: 'in_app', linkedUserId: null }), false);
assert.strictEqual(isSalesAcquisitionThread({ leadStage: 'qualifying', linkedUserId: 'client-123' }), false);
assert.match(
    buildAcquisitionStyleBlock({ leadStage: 'qualifying', linkedUserId: null }),
    /Earn the next response/
);
assert.match(
    buildAcquisitionStyleBlock({ leadStage: 'qualifying', linkedUserId: null }),
    /Avoid validation loops/
);
assert.match(
    buildAcquisitionStyleBlock({ leadStage: 'qualifying', linkedUserId: null }),
    /Avoid weak generic discovery stems/
);
assert.strictEqual(
    buildAcquisitionStyleBlock({ leadStage: 'paying', linkedUserId: 'client-123' }),
    ''
);
assert.match(
    buildAcquisitionMomentumBlock({ botAccount: 'shan_n_sunny', leadStage: 'qualifying', linkedUserId: null }),
    /No-progression fix/
);
assert.match(
    buildAcquisitionMomentumBlock({ botAccount: 'shan_n_sunny', leadStage: 'qualifying', linkedUserId: null }),
    /Too-generic fix/
);
assert.match(
    buildAcquisitionMomentumBlock({ botAccount: 'shan_n_sunny', leadStage: 'qualifying', linkedUserId: null }),
    /soft re-entry handle/
);
assert.strictEqual(
    buildAcquisitionMomentumBlock({ botAccount: 'cocos_pt_studio', leadStage: 'in_app', linkedUserId: 'client-123' }),
    ''
);

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

const tugunContext = buildNativeStoryOutreachContextBlock({
    ig_username: 'lealthaisb',
    custom_data: {
        last_story_outreach: {
            story_id: 'story-tugun-beach',
            story_description: 'A sunrise ocean view from a balcony over the beach.',
            story_visible_text: 'I just love this site, or maybe just the view Tugun Beach',
            story_content_type: 'own_story',
            sent_comment: 'what a view',
            captured_at: '2026-06-03T09:00:00.000Z',
        },
    },
}, 'lealthaisb');

assert.strictEqual(
    hasKnownStoryLocationContext({ nativeStoryContextSummary: tugunContext.summary }),
    true
);

assert.deepStrictEqual(
    suppressStoryLocationQuestionsInDraftChunks([
        'that view is unreal',
        'where are you watching it from?',
    ], {
        nativeStoryContextSummary: tugunContext.summary,
    }),
    ['that view is unreal']
);

assert.deepStrictEqual(
    finalizeDraftChunksFromRawText('{"messages":["where are you watching it from?"]}', {
        nativeStoryContextSummary: tugunContext.summary,
    }),
    ['That view is unreal']
);

console.log('ig instant draft pet context tests passed');
