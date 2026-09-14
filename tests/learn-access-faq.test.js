const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply, selectFastDeterministicPaidMetaProgression, buildPaidMetaConversationApproval, getAutoDmHoldReason } = require('../netlify/functions/ig-instant-draft')._test;
test('launch and end-of-access FAQ answers without an organic readiness hold', () => {
    const currentMessage = 'When does it start and what happens after six weeks?';
    const draft = buildDeterministicPaidMetaConversationReply({ currentMessage, flowVariant: 'broad_pain' });
    assert.equal(draft.paidMetaVerifiedAccessFaq, true);
    assert.match(draft.joined, /21 September 2026/);
    assert.match(draft.joined, /access and support end after six weeks with no automatic renewal/);
    assert.doesNotMatch(draft.joined, /https?:|\?|as soon as you join/);
    assert.equal(selectFastDeterministicPaidMetaProgression({ draft, currentMessage }), draft);
    assert.equal(buildPaidMetaConversationApproval({ metaAdConversationFastLane: true, currentMessage, draft })?.required, false);
    assert.equal(getAutoDmHoldReason({ draft, currentMessage, draftReview: { verdict: 'pass', issues: [] }, leadStage: 'new', linkedUserId: null, meaningfulLeadReplyCount: 0, alertData: { meta_ad_conversation_fast_lane: true, offer_flow_variant: 'broad_pain' } }), null);
    assert.equal(selectFastDeterministicPaidMetaProgression({ draft, currentMessage, requiresMediaAnalysis: true }), null);
});
