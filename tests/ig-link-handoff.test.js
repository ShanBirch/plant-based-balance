const assert = require('assert');

const {
    isSignupLinkHandoffText,
    isBalanceCallBookingLinkText,
    isExplicitCallBookingRequest,
    buildLeadOnboardingHandoffData,
    finalizeDraftChunksFromRawText,
    buildChallengeNextStepBlock,
    repairMissingChallengeBioLinkChunks,
    suppressExistingClientSignupLinkHandoffInDraftChunks,
    isExistingClientThread,
    isBareStoryMentionNotificationText,
    suppressBareStoryMentionClarifierInDraftChunks,
    buildEmptyMediaDraftFallbackChunks,
} = require('../netlify/functions/ig-instant-draft')._test;
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

assert.strictEqual(
    isSignupLinkHandoffText("sweet, here's the link: https://plantbased-balance.org/coaching.html"),
    true
);
assert.strictEqual(isSignupLinkHandoffText('want me to send you the details?'), false);
assert.strictEqual(isBalanceCallBookingLinkText('sweet, grab a time here: https://plantbased-balance.org/book'), true);
assert.strictEqual(isExplicitCallBookingRequest('could we do a WhatsApp call about Balance?'), true);
assert.strictEqual(isExplicitCallBookingRequest('could we do a WhatsApp call?'), false);
assert.strictEqual(isExplicitCallBookingRequest('yeah I want coaching details'), false);

const approvedCallBooking = buildLeadOnboardingHandoffData({
    draftText: "yeah for sure, grab a time that works for you here https://plantbased-balance.org/book",
    currentMessage: 'could we do a video call about Balance?',
    qualifier: { stage: 'qualifying' },
    leadStage: 'qualifying',
    linkedUserId: null,
    threadId: 'thread-call-123',
});
assert.strictEqual(approvedCallBooking.approved_link_auto_sendable, true);
assert.strictEqual(approvedCallBooking.call_booking_handoff, true);
assert.strictEqual(approvedCallBooking.signup_link_handoff_url, 'https://plantbased-balance.org/book');
assert.strictEqual(approvedCallBooking.codex_review.decision, 'approved_call_booking_link_handoff');

const accepted = buildLeadOnboardingHandoffData({
    draftText: "i'll send the link through for you now",
    currentMessage: 'yeah sounds good',
    qualifier: { stage: 'won' },
    leadStage: 'qualifying',
    linkedUserId: null,
    threadId: 'thread-123',
    manychatMessageId: 'message-456',
});

assert.strictEqual(accepted.lead_onboarding_handoff, false);
assert.strictEqual(accepted.needs_you_required, false);
assert.strictEqual(accepted.operator_queue, null);
assert.strictEqual(accepted.client_manager_review_required, true);
assert.strictEqual(accepted.signup_link_manual_only, true);
assert.strictEqual(accepted.codex_review.decision, 'client_manager_review_required');
assert.strictEqual(accepted.codex_review.needs_shannon_approval, false);
assert.deepStrictEqual(accepted.codex_review.evidence_ids, [
    'ig_threads:thread-123',
    'manychat_message_id:message-456',
]);

assert.strictEqual(
    buildLeadOnboardingHandoffData({
        draftText: "i'll send the link through for you now",
        qualifier: { stage: 'won' },
        leadStage: 'qualifying',
        linkedUserId: 'client-123',
        threadId: 'thread-123',
    }),
    null
);

const repairedChunks = finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ["sounds good mate, stoked you're keen", "here's the link, check it out and download the app"] }),
    {
        qualifier: { stage: 'won' },
        currentMessageText: 'yeah sounds good',
    }
);
assert.match(repairedChunks.join('\n'), /https:\/\/plantbased-balance\.org\/plant-based-fitness\.html/);

const supportChunks = finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ["sounds good mate", "here's the link, check it out and download the app"] }),
    {
        qualifier: { stage: 'won' },
        currentMessageText: 'Can I be reconnected with the balance app helper?',
    }
);
assert.doesNotMatch(supportChunks.join('\n'), /future-balance\.netlify\.app\/coaching\.html/);

const supportBlock = buildChallengeNextStepBlock(
    { stage: 'won', challenge_route: 'generic' },
    'Can I be reconnected with balance app helper?'
);
assert.match(supportBlock, /APP SUPPORT NEXT STEP/);
assert.doesNotMatch(supportBlock, /future-balance\.netlify\.app\/coaching\.html/);

assert.strictEqual(
    isExistingClientThread({ leadStage: 'qualifying', linkedUserId: 'client-miranda' }),
    true,
    'linked_user_id is the source of truth for existing-client IG threads'
);

const mirandaClientChunks = finalizeDraftChunksFromRawText(
    JSON.stringify({
        messages: [
            "Hahaha love it. You're basically using the app as a competition tracker now",
            "Stoked though. Check this for the coaching info + how Balance works, then come back and chat here: https://plantbased-balance.org/coaching.html",
        ],
    }),
    {
        qualifier: { stage: 'won' },
        currentMessageText: 'mentioned you in a story photo',
        leadStage: 'in_app',
        linkedUserId: 'client-miranda',
    }
);
assert.match(mirandaClientChunks.join('\n'), /competition tracker/);
assert.doesNotMatch(mirandaClientChunks.join('\n'), /future-balance\.netlify\.app\/coaching\.html|download it|quick challenge/i);

assert.strictEqual(
    isBareStoryMentionNotificationText('mentioned you in a story [PHOTO:https://lookaside.fbsbx.com/example.jpg]'),
    true
);
assert.strictEqual(isBareStoryMentionNotificationText('mentioned you in a story photo'), true);
assert.strictEqual(isBareStoryMentionNotificationText('tagged you in their story'), true);
assert.strictEqual(isBareStoryMentionNotificationText('mentioned you in a story about meal prep'), false);

assert.deepStrictEqual(
    suppressBareStoryMentionClarifierInDraftChunks([
        "Fuck yeah. I'm honoured you tagged me in a story. What did you get tagged in, and are you training more or just eating cleaner right now?",
    ], {
        currentMessageText: 'mentioned you in a story photo',
    }),
    ['oh hell yeah!']
);

assert.deepStrictEqual(
    finalizeDraftChunksFromRawText(
        JSON.stringify({
            messages: [
                "Fuck yeah. I'm honoured you tagged me in a story. What did you get tagged in, and are you training more or just eating cleaner right now?",
            ],
        }),
        {
            currentMessageText: 'mentioned you in a story photo',
        }
    ),
    ['Oh hell yeah!']
);

assert.deepStrictEqual(
    buildEmptyMediaDraftFallbackChunks({
        mediaDecode: { photo_url_count: 1 },
        currentMessageText: 'mentioned you in a story [PHOTO:https://lookaside.fbsbx.com/example.jpg]',
    }),
    ['Oh hell yeah!']
);

assert.deepStrictEqual(
    repairMissingChallengeBioLinkChunks(["love it", "here's the link, download the app"], {
        qualifier: { stage: 'won' },
        currentMessageText: 'yeah sounds good',
        leadStage: 'in_app',
        linkedUserId: 'client-miranda',
    }),
    ["love it", "here's the link, download the app"],
    'existing-client link repair must not append the coaching URL'
);

assert.deepStrictEqual(
    suppressExistingClientSignupLinkHandoffInDraftChunks([
        "love it. here's the link: https://plantbased-balance.org/coaching.html",
    ], {
        linkedUserId: 'client-miranda',
    }),
    ['love it.'],
    'existing-client cleanup should keep useful banter but strip signup link handoff'
);

const staleWonBlock = buildChallengeNextStepBlock(
    { stage: 'won', challenge_route: 'vegan' },
    'a win is a win'
);
assert.match(staleWonBlock, /ALREADY ACCEPTED CONTEXT/);
assert.doesNotMatch(staleWonBlock, /future-balance\.netlify\.app\/coaching\.html/);

assert.strictEqual(
    buildLeadOnboardingHandoffData({
        draftText: 'a win is a win haha',
        currentMessage: 'a win is a win',
        qualifier: { stage: 'won' },
        leadStage: 'qualifying',
        linkedUserId: null,
        threadId: 'thread-banter',
    }),
    null,
    'a stale won stage plus banter should not attach signup-link handoff metadata'
);

const staleRepairChunks = finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ["a win is a win haha", "here's the link"] }),
    {
        qualifier: { stage: 'won' },
        currentMessageText: 'a win is a win',
    }
);
assert.doesNotMatch(staleRepairChunks.join('\n'), /future-balance\.netlify\.app\/coaching\.html/);

const scheduledRepair = scheduledWorker.repairMissingScheduledLinkHandoff({
    data: { signup_link_handoff_url: 'https://plantbased-balance.org/coaching.html' },
}, "sounds good mate, here's the link");
assert.strictEqual(scheduledRepair.repaired, true);
assert.match(scheduledRepair.text, /https:\/\/plantbased-balance\.org\/coaching\.html/);

console.log('ig link handoff tests passed');
