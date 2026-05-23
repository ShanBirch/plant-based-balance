const assert = require('assert');

const {
    normalizeDraftComment,
    assessStoryCommentSafety,
} = require('../netlify/functions/ig-story-outreach-candidate')._test;

assert.strictEqual(
    normalizeDraftComment('a Nike lower back, yes please!', {
        storyOwner: 'elbainmusic',
        sharedFromUsername: 'good.o.man',
        sharedContent: true,
    }),
    '',
    'body-part/yes-please jokes should not be sent as story openers'
);

const creditedSafety = assessStoryCommentSafety({
    storyOwner: 'elbainmusic',
    sharedFromUsername: 'good.o.man',
    description: 'A hand holds two Nike-branded boxes containing models of left and right human knees.',
    visibleText: 'Surely theres a lower back option? LEFT KNEE RIGHT KNEE @good.o.man',
    comment: 'a Nike lower back, yes please!',
});
assert.strictEqual(creditedSafety.safeToComment, false);
assert.strictEqual(creditedSafety.reason, 'story_credits_another_creator');

const bodyPartSafety = assessStoryCommentSafety({
    storyOwner: 'someone',
    description: 'A meme about lower back pain and knee models.',
    visibleText: 'lower back option',
    comment: 'lower back option is wild',
});
assert.strictEqual(bodyPartSafety.safeToComment, false);
assert.strictEqual(
    normalizeDraftComment('Love this!', {
        storyOwner: 'someone',
        sharedContent: false,
    }),
    '',
    'generic love-this openers should be rewritten or blocked'
);

assert.strictEqual(
    normalizeDraftComment("How's Bodyattack numero 2 going?", {
        storyOwner: 'harp_piano_cello_n_sax',
        sharedContent: false,
    }),
    'how was the session?',
    'over-literal class wording should become a normal session question'
);

assert.strictEqual(
    normalizeDraftComment("How's Bodyattack numero 2 going?", {
        storyOwner: 'harp_piano_cello_n_sax',
        sharedContent: true,
    }),
    '',
    'shared class/reel wording should not imply the story owner did the session'
);

console.log('ig story outreach safety tests passed');
