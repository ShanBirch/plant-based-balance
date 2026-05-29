const assert = require('assert');

const {
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
} = require('../netlify/functions/ig-instant-draft')._test;

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

assert.strictEqual(accepted.lead_onboarding_handoff, true);
assert.strictEqual(accepted.needs_you_required, true);
assert.strictEqual(accepted.operator_queue, 'needs_you');
assert.strictEqual(accepted.signup_link_manual_only, true);
assert.strictEqual(accepted.codex_review.decision, 'needs_shannon_onboarding_handoff');
assert.strictEqual(accepted.codex_review.needs_shannon_approval, true);
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

console.log('ig link handoff tests passed');
