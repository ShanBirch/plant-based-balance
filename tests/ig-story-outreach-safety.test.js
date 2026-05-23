const assert = require('assert');

const {
    normalizeDraftComment,
    assessStoryCommentSafety,
    relationshipStoryBlockReason,
    storyRecentOutreachCooldown,
    isDryRunQualityJudge,
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
    normalizeDraftComment("What's the story here?", {
        storyOwner: 'nickwhite49',
        sharedContent: false,
    }),
    '',
    'vague curiosity should be skipped rather than sent'
);

assert.strictEqual(
    normalizeDraftComment("What's 'vegeve' mean?", {
        storyOwner: 'jie.rry',
        sharedContent: false,
    }),
    '',
    'unclear OCR meaning questions should be skipped rather than sent'
);

assert.strictEqual(
    normalizeDraftComment("What's a satsesh?", {
        storyOwner: 'kirillar87',
        sharedContent: false,
    }),
    '',
    'single-word slang curiosity should be skipped rather than sent'
);

assert.strictEqual(
    normalizeDraftComment('is this peaceful spot?', {
        storyOwner: 'whatjanesays',
        sharedContent: false,
    }),
    'that looks peaceful',
    'missing-article scenic questions should be polished before sending'
);

assert.strictEqual(
    normalizeDraftComment("Go Pies! What's SP433?", {
        storyOwner: 'runjorun_79',
        sharedContent: false,
    }),
    'Go Pies',
    'unclear all-caps/code questions should be stripped from otherwise useful comments'
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

const recentStoryThread = {
    id: 'thread-recent-story',
    custom_data: {
        story_outreach_history: [{
            sent: true,
            sent_at: '2026-05-23T13:55:00.000Z',
            sent_comment: 'looks like a fun night',
        }],
    },
};
const recentStoryNow = new Date('2026-05-23T14:05:00.000Z');
const recentStoryCooldown = storyRecentOutreachCooldown(recentStoryThread, [], recentStoryNow);
assert.strictEqual(recentStoryCooldown.reason, 'recent_story_outreach');
assert.strictEqual(
    relationshipStoryBlockReason(recentStoryThread, [], [], recentStoryNow),
    'recent_story_outreach',
    'recent story openers should block another opener even across midnight-local runs'
);

assert.strictEqual(
    isDryRunQualityJudge({ ignore_relationship_blocks: true }, true),
    true,
    'quality judging may ignore relationship blocks only while dry-running'
);
assert.strictEqual(
    isDryRunQualityJudge({ ignore_relationship_blocks: true }, false),
    false,
    'relationship blocks must not be bypassed for real sends'
);

console.log('ig story outreach safety tests passed');
