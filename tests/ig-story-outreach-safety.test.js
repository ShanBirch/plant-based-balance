const assert = require('assert');

const {
    normalizeDraftComment,
    applyRelationshipAwareStoryCommentGuard,
    relationshipContextHasKnownPetNames,
    repairDraftCommentWithContext,
    parseStoryUrl,
    assessStoryCommentSafety,
    assessAudioVisualCommentConsistency,
    relationshipStoryBlockReason,
    hasRecentUnansweredInbound,
    storyRecentOutreachCooldown,
    isDryRunQualityJudge,
    validateEvidenceVideo,
    shouldRecommendLikeFallback,
    storyAnalysisTranscriptNote,
    normalizeStorySurfaceContext,
    assessStillsOnlyVideoSalvageContext,
    animalWelfareSupportCommentForContext,
    buildStoryEvidenceAnalysisFallback,
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
    normalizeDraftComment('Looking strong mate', {
        storyOwner: 'levi_cox',
        sharedContent: false,
    }),
    '',
    'body/physique-coded compliments should not be sent as story openers'
);

const shirtlessStrongSafety = assessStoryCommentSafety({
    storyOwner: 'levi_cox',
    description: 'A shirtless mirror selfie after training.',
    visibleText: '',
    comment: 'Looking strong mate',
});
assert.strictEqual(shirtlessStrongSafety.safeToComment, false);
assert.strictEqual(shirtlessStrongSafety.reason, 'body_or_weight_metric');

assert.strictEqual(
    normalizeDraftComment('Love this!', {
        storyOwner: 'someone',
        sharedContent: false,
    }),
    '',
    'generic love-this openers should be rewritten or blocked'
);

assert.strictEqual(
    normalizeDraftComment("Let's go!", {
        storyOwner: 'someone',
        sharedContent: false,
    }),
    'lets go!',
    'gym hype should survive normalization'
);

const mirrorSelfieSafety = assessStoryCommentSafety({
    storyOwner: 'mirror.selfie',
    description: 'A mirror selfie in a gym.',
    visibleText: '',
    comment: 'looking good',
});
assert.strictEqual(mirrorSelfieSafety.safeToComment, false);
assert.strictEqual(mirrorSelfieSafety.reason, 'specific_visual_hook_required');

const scenicViewSafety = assessStoryCommentSafety({
    storyOwner: 'view.spot',
    description: 'A beach sunset with cliffs, waves, and a clear lookout view.',
    visibleText: '',
    comment: 'what a view',
});
assert.strictEqual(scenicViewSafety.safeToComment, true);
assert.strictEqual(scenicViewSafety.reason, '');

const gymActionSafety = assessStoryCommentSafety({
    storyOwner: 'gym.action',
    description: 'A person is performing squats at a squat rack in a gym.',
    visibleText: 'Good good morning',
    comment: 'lets go!',
});
assert.strictEqual(gymActionSafety.safeToComment, true);
assert.strictEqual(gymActionSafety.reason, 'activity_handle');

const gymEtiquetteSafety = assessStoryCommentSafety({
    storyOwner: 'gym.etiquette',
    description: 'The story shows a gym floor with a black box, a gym bag, and a red water bottle, accompanied by text about gym etiquette.',
    visibleText: "Don't be this fucking clown in the gym.",
    comment: 'nice lift!',
});
assert.strictEqual(gymEtiquetteSafety.safeToComment, false);
assert.strictEqual(gymEtiquetteSafety.reason, 'gym_context_mismatch');

const gymEquipmentSafety = assessStoryCommentSafety({
    storyOwner: 'gym.equipment',
    description: 'A gym floor with a rack, a barbell, and a water bottle. No one is clearly lifting. ',
    visibleText: '',
    comment: 'looking good',
});
assert.strictEqual(gymEquipmentSafety.safeToComment, false);
assert.strictEqual(gymEquipmentSafety.reason, 'gym_context_mismatch');

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
    normalizeDraftComment('is this amazing club?', {
        storyOwner: 'aquabluemermaid',
        sharedContent: false,
    }),
    '',
    'malformed missing-article club questions should be skipped instead of sent'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'is this amazing club?',
        description: "A scenic coastal view with rocks, blue water, a beach towel, bag, and book, with text 'this is my clubbing!'",
        visibleText: 'this is my clubbing!',
        storyOwner: 'aquabluemermaid',
    }),
    'beach over clubbing, always',
    'beach clubbing contrast should not be treated as a literal venue'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'Happy birthday! Looks like a fun night.',
        description: 'A man is DJing at a party with green balloons and one balloon says Happy Birthday.',
        visibleText: 'Happy Birthday',
        storyOwner: 'kirillar87',
    }),
    'looks like a fun night',
    'birthday props should not trigger a direct birthday wish to the story owner'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'what a view',
        description: 'A man in an orange outfit is smiling on a beach at sunset with a spiky halo-like headpiece.',
        visibleText: 'What',
        storyOwner: 'sarahprobert.xox',
    }),
    'looks like a fun day',
    'view comments should not be used when a person/costume is the main subject'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'looking good, what a cute pony',
        description: 'A close-up story video of a white pony or horse eating hay while someone cuddles beside it outdoors.',
        visibleText: 'isnt she lovely',
        storyOwner: 'alana_wilkes12',
    }),
    'what a cute pony',
    'animal-led stories should not mix appearance praise with the animal comment'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'thats a good line',
        description: 'An Instagram story showing a gym-themed 2026 calendar graphic with monthly gym and coffee notes.',
        visibleText: '2026 JAN: GYM FEB: GYM MAR: GYM APR: GYM MAY: GYM JUN: GYM',
        storyOwner: 'grateful_vegan_sunflower',
    }),
    'gym all year haha',
    'calendar/list graphics should get theme-aware comments, not generic quote praise'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'looking good',
        description: 'A mirror selfie story shows a woman in black activewear with a quote about hurt people hurting people and accountability.',
        visibleText: 'hurt people hurt people',
        storyOwner: 'pnba_pro_mandacampbell',
    }),
    '',
    'heavy quote selfies should not get appearance compliments'
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
    normalizeDraftComment('are you guys?', {
        storyOwner: 'vampandvixennails',
        sharedContent: false,
    }),
    '',
    'bare sentence-fragment questions should be blocked'
);

assert.strictEqual(
    normalizeDraftComment('Enjoying the r sights?', {
        storyOwner: 'shivvquinn',
        sharedContent: false,
    }),
    '',
    'single-letter OCR/location artifacts should be blocked'
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
    'French rose, yum! what kind?',
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
    'oh so cute, whats their name?',
    'pet name questions should not repeat toilet/fart captions'
);

assert.strictEqual(
    normalizeDraftComment('oh so cute, whats their name?', {
        storyOwner: 'qwerth314',
        sharedContent: false,
    }),
    'oh so cute, whats their name?',
    'pet name comments should be polished before sending'
);

assert.strictEqual(
    normalizeDraftComment("Oh so cute, what's their name?", {
        storyOwner: 'veganrebelalliance',
        sharedContent: true,
    }),
    'so cute, do you know their name?',
    'shared animal stories should not ask pet-name questions as if the animal belongs to the sharer'
);

assert.strictEqual(
    normalizeDraftComment('So cute, do you know their name?', {
        storyOwner: 'catarinaaaaaaaaa',
        sharedContent: true,
    }),
    'so cute, do you know their name?',
    'shared pet name comments should survive the shared-content you/your guard'
);

assert.strictEqual(
    normalizeDraftComment('Oh, so cute! What are their names?', {
        storyOwner: 'sarinagitodotcom',
        sharedContent: true,
    }),
    'so cute, do you know their names?',
    'shared multi-animal name questions should be framed to the sharer'
);

assert.strictEqual(
    normalizeDraftComment('This is so good! What breed?', {
        storyOwner: 'darnz',
        sharedContent: true,
    }),
    'do you know what breed?',
    'shared pet breed questions should be framed to the sharer'
);

assert.strictEqual(
    normalizeDraftComment('Love the colourful wigs! Looks like a great hens.', {
        storyOwner: 'wheres_kimmy_t',
        sharedContent: false,
    }),
    'love the colourful wigs! looks like a great hens night',
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

assert.strictEqual(
    normalizeDraftComment('what song was that?', {
        storyOwner: 'cookie17133.priv',
        sharedContent: false,
    }),
    'good song choice',
    'story opener should not ask the lead to identify obvious or attached music'
);

assert.strictEqual(
    repairDraftCommentWithContext({
        comment: 'what song was this?',
        description: 'A mirror selfie video with attached popular music playing.',
        visibleText: '',
        storyOwner: 'cookie17133.priv',
        sharedContent: false,
    }),
    'good song choice',
    'story repair should turn song-ID questions into non-question reactions'
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

assert.strictEqual(
    animalWelfareSupportCommentForContext('Welfarists keep normalizing animal exploitation with nice-sounding theories.'),
    'so true, it just normalises it hey',
    'vegan theory or advocacy text should not get the distress check-in wording'
);

assert.strictEqual(
    animalWelfareSupportCommentForContext('Ventilation shutdown and mass animal culling on factory farms.'),
    "i can't believe this happens, so sad. you okay?",
    'actual animal cruelty/distress posts should keep the supportive check-in'
);

assert.strictEqual(
    normalizeDraftComment('so true, it just normalises it hey', {
        storyOwner: 'lilith_is_a_punk',
    }),
    'so true, it just normalises it hey',
    'animal advocacy agreement comments should survive normalization'
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

const animalAdvocacyDiscussionSafety = assessStoryCommentSafety({
    storyOwner: 'lilith_is_a_punk',
    description: 'A vegan argument about welfarists, theories, and animal exploitation.',
    visibleText: 'Would it change the reality that it perpetuates and normalizes animal exploitation?',
    comment: 'so true, it just normalises it hey',
});
assert.strictEqual(animalAdvocacyDiscussionSafety.safeToComment, true);
assert.strictEqual(animalAdvocacyDiscussionSafety.reason, 'animal_welfare_support');

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

const knownPetRelationshipContext = 'Existing IG thread found. Known relationship anchors: pets=dogs Specter and Ocean. Recent DM timeline: Shannon: oh so cute, whats their name? | Them: They are the dogs I house sat. Specter and Ocean';
assert.strictEqual(relationshipContextHasKnownPetNames(knownPetRelationshipContext), true);
assert.strictEqual(
    applyRelationshipAwareStoryCommentGuard("Oh so cute, what's their name?", {
        relationshipContext: knownPetRelationshipContext,
    }),
    'theyre cute haha',
    'story comments should not ask pet names again when the thread already knows them'
);
const repeatedPetQuestionSafety = assessStoryCommentSafety({
    storyOwner: 'pam',
    description: 'Two dogs are sitting on a couch.',
    visibleText: 'Puppy love',
    comment: 'oh so cute, whats their name?',
    relationshipContext: knownPetRelationshipContext,
});
assert.strictEqual(repeatedPetQuestionSafety.safeToComment, false);
assert.strictEqual(repeatedPetQuestionSafety.reason, 'known_pet_name_thread');

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

const youngDanceGroupSafety = assessStoryCommentSafety({
    storyOwner: 'amyleemee',
    description: 'A group of young girls in dance attire posing in a room with trophies.',
    visibleText: 'amyleemee 18h Reply to amyleemee...',
    comment: 'So cute! What kind of dance?',
});
assert.strictEqual(youngDanceGroupSafety.safeToComment, false);
assert.strictEqual(youngDanceGroupSafety.reason, 'minor_or_toilet_context');

const prisonCaptionSafety = assessStoryCommentSafety({
    storyOwner: 'kirsty.mccall64',
    description: 'A smiling man holding a beagle dog with text about facing prison time.',
    visibleText: 'facing prison time',
    comment: 'That caption is gold!',
});
assert.strictEqual(prisonCaptionSafety.safeToComment, false);
assert.strictEqual(prisonCaptionSafety.reason, 'politics_or_legal');
assert.strictEqual(babiesSafety.reason, 'minor_or_toilet_context');

const comedyPosterSafety = assessStoryCommentSafety({
    storyOwner: 'bnhntr',
    description: 'A poster advertising a stand up comedy show at a venue.',
    visibleText: 'Tix include a drink. Book tickets now.',
    comment: 'Sounds like a ripper night!',
});
assert.strictEqual(comedyPosterSafety.safeToComment, false);
assert.strictEqual(comedyPosterSafety.reason, 'promotional_or_ad');

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
    relationshipStoryBlockReason(
        { id: 'thread-admin-card' },
        [{ status: 'pending', alert_type: 'general_idea', data: { subtype: 'ig_story_outreach_candidate' } }],
        [],
        recentStoryNow
    ),
    '',
    'stale/non-DM admin cards should not block story comments as pending DM replies'
);

assert.strictEqual(
    relationshipStoryBlockReason(
        { id: 'thread-real-dm' },
        [{ status: 'pending', alert_type: 'ig_incoming_dm', data: { ig_thread_id: 'thread-real-dm' } }],
        [],
        recentStoryNow
    ),
    'pending_dm_reply',
    'real pending IG DM alerts should still block story comments'
);

assert.strictEqual(
    hasRecentUnansweredInbound(
        {
            id: 'thread-latest-out',
            last_inbound_at: '2026-05-23T13:00:00.000Z',
            last_outbound_at: null,
        },
        [
            { direction: 'out', text: 'all good', created_at: '2026-05-23T13:10:00.000Z', source: 'manual_ig' },
            { direction: 'in', text: 'thanks', created_at: '2026-05-23T13:00:00.000Z', source: 'instagram' },
        ],
        recentStoryNow
    ),
    false,
    'latest actual outbound message should clear stale thread timestamp open-DM holds'
);

assert.strictEqual(
    hasRecentUnansweredInbound(
        {
            id: 'thread-reaction',
            last_inbound_at: '2026-05-23T13:00:00.000Z',
            last_outbound_at: null,
        },
        [{ direction: 'in', text: 'liked your message', created_at: '2026-05-23T13:00:00.000Z', source: 'instagram_reaction' }],
        recentStoryNow
    ),
    false,
    'likes/reactions should not count as a DM needing Shannon reply'
);

assert.strictEqual(
    relationshipStoryBlockReason(
        { id: 'thread-real-open' },
        [],
        [{ direction: 'in', text: 'hey can you help?', created_at: '2026-05-23T13:00:00.000Z', source: 'instagram' }],
        recentStoryNow
    ),
    'open_dm_needs_reply',
    'latest real inbound DM should still block story comments'
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
assert.strictEqual(
    shouldRecommendLikeFallback({ safetyReason: 'specific_visual_hook_required' }, ''),
    true,
    'broad story puns should fall back to like-only'
);

const noEvidenceFallback = buildStoryEvidenceAnalysisFallback({
    normalizedSupplied: 'looks like a fun night',
    surfaceContext: { storyContentType: 'own_story' },
    safetyReason: 'no_story_evidence_supplied',
    error: 'no_story_evidence_supplied',
});
assert.strictEqual(noEvidenceFallback.safeToComment, false);
assert.strictEqual(noEvidenceFallback.draftComment, '');
assert.strictEqual(noEvidenceFallback.safetyReason, 'no_story_evidence_supplied');

const sentButFailedFallback = buildStoryEvidenceAnalysisFallback({
    normalizedSupplied: 'looks like a fun night',
    safetyReason: 'analysis_failed',
    error: 'model unavailable',
    preserveSuppliedDraft: true,
});
assert.strictEqual(sentButFailedFallback.safeToComment, false);
assert.strictEqual(sentButFailedFallback.draftComment, 'looks like a fun night');
assert.strictEqual(sentButFailedFallback.safetyReason, 'analysis_failed');

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
