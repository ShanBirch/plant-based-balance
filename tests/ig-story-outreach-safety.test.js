const assert = require('assert');

const {
    normalizeDraftComment,
    parseStoryUrl,
    assessStoryCommentSafety,
    relationshipStoryBlockReason,
    storyRecentOutreachCooldown,
    isDryRunQualityJudge,
    validateEvidenceVideo,
    shouldRecommendLikeFallback,
} = require('../netlify/functions/ig-story-outreach-candidate')._test;

assert.strictEqual(
    parseStoryUrl('https://www.instagram.com/stories/highlights/18100654963567629/').username,
    '',
    'Instagram highlights URLs must not be treated as real outreach usernames'
);

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
    normalizeDraftComment('is this?', {
        storyOwner: 'havasemily',
        sharedContent: false,
    }),
    '',
    'empty scenic questions should be blocked'
);

assert.strictEqual(
    normalizeDraftComment('love the caption!', {
        storyOwner: 'bnhntr',
        sharedContent: false,
    }),
    '',
    'generic caption praise should be blocked'
);

assert.strictEqual(
    normalizeDraftComment("what's that place?", {
        storyOwner: 'stephmarks_',
        sharedContent: false,
    }),
    '',
    'vague place questions should be blocked'
);

assert.strictEqual(
    normalizeDraftComment("Where's this cool spot?", {
        storyOwner: 'koah_co',
        sharedContent: false,
    }),
    '',
    'vague location questions should be blocked'
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

assert.strictEqual(
    normalizeDraftComment("What's in the little bag?", {
        storyOwner: 'madisondangen',
        sharedContent: false,
    }),
    '',
    'ambiguous bag questions should be blocked before live sending'
);

assert.strictEqual(
    normalizeDraftComment('are the boys playing?', {
        storyOwner: 'jessica_maree85',
        sharedContent: false,
    }),
    "how's the game going?",
    'sports-team wording should become a normal game question'
);

assert.strictEqual(
    normalizeDraftComment('are you barracking for?', {
        storyOwner: 'jackmwheeler',
        sharedContent: false,
    }),
    'who are you barracking for?',
    'incomplete barracking question should be repaired before sending'
);

const ambiguousSubstanceSafety = assessStoryCommentSafety({
    storyOwner: 'madisondangen',
    description: 'A close-up photo of two cocktails on a dark table, one with a pineapple garnish and the other with a small bag of white powder clipped to its side.',
    visibleText: '',
    comment: "What's in the little bag?",
});
assert.strictEqual(ambiguousSubstanceSafety.safeToComment, false);
assert.strictEqual(ambiguousSubstanceSafety.reason, 'ambiguous_substance_context');

const babiesSafety = assessStoryCommentSafety({
    storyOwner: 'chelsea_heald18',
    description: 'Two babies are sitting in a blue net swing at a playground.',
    visibleText: 'I cant with these two what a privilege getting to watch these two grow together',
    comment: 'Look at these little legends!',
});
assert.strictEqual(babiesSafety.safeToComment, false);
assert.strictEqual(babiesSafety.reason, 'minor_or_toilet_context');

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

assert.strictEqual(
    shouldRecommendLikeFallback({ safetyReason: 'analysis_failed' }, ''),
    true,
    'analysis failures should recommend a like-only fallback'
);
assert.strictEqual(
    shouldRecommendLikeFallback({ safetyReason: 'minor_or_toilet_context' }, ''),
    false,
    'sensitive story blocks should not recommend a like fallback'
);

const tinyVideo = validateEvidenceVideo({
    video_base64: Buffer.from('tiny mp4 placeholder').toString('base64'),
    video_mime_type: 'video/mp4',
    video_evidence_bytes: 20,
    video_path: 'story.mp4',
});
assert.strictEqual(tinyVideo.mimeType, 'video/mp4');
assert.strictEqual(tinyVideo.evidenceStatus, 'included');

console.log('ig story outreach safety tests passed');
