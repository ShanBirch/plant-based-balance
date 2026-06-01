const assert = require('assert');

const {
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
    finalizeDraftChunksFromRawText,
    buildChallengeNextStepBlock,
} = require('../netlify/functions/ig-instant-draft')._test;
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

assert.strictEqual(
    isSignupLinkHandoffText("sweet, here's the link: https://future-balance.netlify.app/coaching.html"),
    true
);
assert.strictEqual(isSignupLinkHandoffText('want me to send you the details?'), false);

const accepted = buildLeadOnboardingHandoffData({
    draftText: "i'll send the link through for you now",
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
assert.match(repairedChunks.join('\n'), /https:\/\/future-balance\.netlify\.app\/bio\.html/);

const supportChunks = finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ["sounds good mate", "here's the link, check it out and download the app"] }),
    {
        qualifier: { stage: 'won' },
        currentMessageText: 'Can I be reconnected with the balance app helper?',
    }
);
assert.doesNotMatch(supportChunks.join('\n'), /future-balance\.netlify\.app\/bio\.html/);

const supportBlock = buildChallengeNextStepBlock(
    { stage: 'won', challenge_route: 'generic' },
    'Can I be reconnected with balance app helper?'
);
assert.match(supportBlock, /APP SUPPORT NEXT STEP/);
assert.doesNotMatch(supportBlock, /future-balance\.netlify\.app\/bio\.html/);

const scheduledRepair = scheduledWorker.repairMissingScheduledLinkHandoff({
    data: { signup_link_handoff_url: 'https://future-balance.netlify.app/bio.html' },
}, "sounds good mate, here's the link");
assert.strictEqual(scheduledRepair.repaired, true);
assert.match(scheduledRepair.text, /https:\/\/future-balance\.netlify\.app\/bio\.html/);

console.log('ig link handoff tests passed');
