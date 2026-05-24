const assert = require('assert');

const {
    normalizeDraftComment,
    parseStoryUrl,
    assessStoryCommentSafety,
    assessAudioVisualCommentConsistency,
    relationshipStoryBlockReason,
    storyRecentOutreachCooldown,
    isDryRunQualityJudge,
    validateEvidenceVideo,
    shouldRecommendLikeFallback,
    storyAnalysisTranscriptNote,
    normalizeStorySurfaceContext,
    assessStillsOnlyVideoSalvageContext,
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

assert.strictEqual(
    normalizeDraftComment('French ros, yum! What kind?', {
        storyOwner: 'glutenfree_girlmelbourne',
        sharedContent: false,
    }),
    'French rose, yum! What kind?',
    'accent-stripped rose should not be sent as ros'
);

assert.strictEqual(
    normalizeDraftComment('are they serving there?', {
        storyOwner: '_mollyvancea_',
        sharedContent: false,
    }),
    'what are they serving?',
    'clipped serving questions should be repaired before sending'
);

assert.strictEqual(
    normalizeDraftComment('are those yellow ones?', {
        storyOwner: 'puras_verduras_',
        sharedContent: false,
    }),
    'what are those yellow ones?',
    'clipped colour/object questions should be repaired before sending'
);

assert.strictEqual(
    normalizeDraftComment('are you growing?', {
        storyOwner: 'athenadore95',
        sharedContent: false,
    }),
    'what are you growing?',
    'clipped garden questions should be repaired before sending'
);

assert.strictEqual(
    normalizeDraftComment("That's a boss look!", {
        storyOwner: 'epr.ice',
        sharedContent: false,
    }),
    'looking good today',
    'overwritten selfie compliments should be softened'
);

assert.strictEqual(
    normalizeDraftComment("best stinky farts! What's their name?", {
        storyOwner: 'haroldwuldnvrbeatuphislandlord',
        sharedContent: false,
    }),
    "Oh so cute, what's their name?",
    'pet name questions should not repeat toilet/fart captions'
);

assert.strictEqual(
    normalizeDraftComment('oh so cute, whats their name?', {
        storyOwner: 'qwerth314',
        sharedContent: false,
    }),
    "Oh so cute, what's their name?",
    'pet name comments should be polished before sending'
);

assert.strictEqual(
    normalizeDraftComment('Love the colourful wigs! Looks like a great hens.', {
        storyOwner: 'wheres_kimmy_t',
        sharedContent: false,
    }),
    'Love the colourful wigs! looks like a great hens night',
    'multi-clause clipped hens wording should be repaired'
);

assert.strictEqual(
    normalizeDraftComment('Looks like a great hens.', {
        storyOwner: 'wheres_kimmy_t',
        sharedContent: false,
    }),
    'looks like a great hens night',
    'clipped hens night wording should be repaired'
);

assert.strictEqual(
    normalizeDraftComment('are tough, good work!', {
        storyOwner: 'ovo.joe',
        sharedContent: false,
    }),
    'good song choice',
    'clipped lyric/effort comments should be repaired'
);

const transcriptNote = storyAnalysisTranscriptNote({
    audioTranscript: 'You need to watch this show immediately on Netflix.',
});
assert.ok(
    transcriptNote.includes('Netflix') && transcriptNote.includes('supplemental evidence') && transcriptNote.includes('audio_visual_mismatch'),
    'story analysis prompt should treat captured audio as supplemental evidence'
);

const musicSurfaceContext = normalizeStorySurfaceContext({
    story_surface_context: {
        story_music_label: 'Garth Brooks • The Thunder Rolls (live)',
        story_music_artist: 'Garth Brooks',
        story_music_title: 'The Thunder Rolls (live)',
    },
});
assert.strictEqual(musicSurfaceContext.storyMusicDetected, true);
assert.strictEqual(musicSurfaceContext.storyMusicLabel, 'Garth Brooks • The Thunder Rolls (live)');

const transcriptWithSongNote = storyAnalysisTranscriptNote({
    audioTranscript: 'thunder rolls and lightning strikes',
    storyMusicLabel: 'Garth Brooks • The Thunder Rolls (live)',
});
assert.ok(
    transcriptWithSongNote.includes('attached music') && transcriptWithSongNote.includes('music metadata'),
    'transcripts should be guarded when an attached song is detected'
);

assert.strictEqual(
    normalizeDraftComment('i cant believe this happens, so sad. are you okay?', {
        storyOwner: '8_degrees_of_donna',
        sharedContent: true,
    }),
    "i can't believe this happens, so sad. you okay?",
    'animal welfare support comments should be allowed despite sad wording'
);

const animalWelfareSafety = assessStoryCommentSafety({
    storyOwner: '8_degrees_of_donna',
    sharedFromUsername: 'animaljustice',
    description: 'A vegan animal welfare post about ventilation shutdown and mass animal culling on factory farms.',
    visibleText: 'ventilation shutdown animal cruelty factory farming',
    comment: "i can't believe this happens, so sad. you okay?",
});
assert.strictEqual(animalWelfareSafety.safeToComment, true);
assert.strictEqual(animalWelfareSafety.reason, 'animal_welfare_support');

const animalAgricultureSafety = assessStoryCommentSafety({
    storyOwner: 'vegan_friend',
    sharedFromUsername: 'farmtransparency',
    description: 'A vegan advocacy post about animal agriculture and ending animal suffering.',
    visibleText: 'animal agriculture vegan advocacy',
    comment: "i can't believe this happens, so sad. you okay?",
});
assert.strictEqual(animalAgricultureSafety.safeToComment, true);
assert.strictEqual(animalAgricultureSafety.reason, 'animal_welfare_support');

const transcriptAnimalAdvocacySafety = assessStoryCommentSafety({
    storyOwner: 'partyorgrhp',
    sharedFromUsername: 'vegan_creator',
    description: 'A shared advocacy reel.',
    visibleText: 'from @vegan_creator',
    raw: {
        audio_transcript: "I'll pay five bucks to anyone willing to kill this pig. No. I'll do it humanely.",
    },
    comment: "i can't believe this happens, so sad. you okay?",
});
assert.strictEqual(transcriptAnimalAdvocacySafety.safeToComment, true);
assert.strictEqual(transcriptAnimalAdvocacySafety.reason, 'animal_welfare_support');

const audioVisualMismatchSafety = assessStoryCommentSafety({
    storyOwner: 'andres_93',
    description: 'A concert scene is shown while audio discusses a cat with a funny collar.',
    visibleText: '',
    surfaceContext: {
        audioTranscript: 'cat funny collar meow',
    },
    comment: "Funny collar! What's their name?",
});
assert.strictEqual(audioVisualMismatchSafety.safeToComment, false);
assert.strictEqual(audioVisualMismatchSafety.reason, 'audio_visual_mismatch');

const directAudioVisualMismatchSafety = assessAudioVisualCommentConsistency({
    description: 'A stage with lights is visible while audio talks about a kitten.',
    comment: "Oh so cute, what's their name?",
    surfaceContext: { audioTranscript: 'kitten collar' },
});
assert.strictEqual(directAudioVisualMismatchSafety.safeToComment, false);
assert.strictEqual(directAudioVisualMismatchSafety.reason, 'audio_visual_mismatch');

const visiblePetQuestionSafety = assessStoryCommentSafety({
    storyOwner: 'qwerth314',
    description: 'A cat is playing on a cat tree.',
    visibleText: '',
    comment: "Oh so cute, what's their name?",
});
assert.strictEqual(visiblePetQuestionSafety.safeToComment, true);

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

const groupOfBoysSafety = assessStoryCommentSafety({
    storyOwner: 'linzsiefken',
    description: "A group of boys are sitting in front of a 'Welcome to Worlds of Fun Oceans of Fun' sign.",
    visibleText: 'Welcome to Worlds of Fun Oceans of Fun',
    comment: 'Worlds of Fun, how was it?',
});
assert.strictEqual(groupOfBoysSafety.safeToComment, false);
assert.strictEqual(groupOfBoysSafety.reason, 'minor_or_toilet_context');
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

const unclearVideoSalvage = assessStillsOnlyVideoSalvageContext({
    description: 'A blurry sampled frame from a short video, possibly someone moving outdoors.',
    visibleText: '',
    comment: 'looks fun',
    surfaceContext: {
        videoDetected: true,
        videoEvidenceStatus: 'omitted_after_video_bridge_failure',
        videoRetryReason: 'story_analysis_unavailable',
    },
});
assert.strictEqual(unclearVideoSalvage.safeToComment, false);
assert.strictEqual(unclearVideoSalvage.reason, 'analysis_failed');

const singlePhotoNotSalvage = assessStillsOnlyVideoSalvageContext({
    description: 'A clear photo of a dog on a couch.',
    visibleText: '',
    comment: "Oh so cute, what's their name?",
    surfaceContext: { videoDetected: false },
});
assert.strictEqual(singlePhotoNotSalvage.safeToComment, true);

const songOnlyVideoSalvage = assessStillsOnlyVideoSalvageContext({
    description: 'A mirror selfie with an attached song label.',
    visibleText: '',
    comment: 'great song choice',
    surfaceContext: {
        videoDetected: true,
        videoEvidenceStatus: 'omitted_after_video_bridge_failure',
        videoRetryReason: 'transient_bridge_failure',
        storyMusicLabel: 'Olivia Dean - Ladies Room',
    },
});
assert.strictEqual(songOnlyVideoSalvage.safeToComment, true);
assert.strictEqual(songOnlyVideoSalvage.reason, 'song_metadata_handle');

console.log('ig story outreach safety tests passed');
