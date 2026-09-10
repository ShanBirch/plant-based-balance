const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildDeterministicPaidMetaConversationReply,
    buildPaidMetaConversationApproval,
} = require('../netlify/functions/ig-instant-draft')._test;

const history = [{ direction: 'out', text: "What's the main change you'd like to make over the next six weeks?" }];
for (const currentMessage of [
    "I can't afford it this week",
    'I cannot afford the course right now.',
    'We can’t afford Balance Learn at the moment.',
    "I can't afford this program. Can I see the preview? Actually not now.",
]) {
    test(`financial constraint pauses sales: ${currentMessage}`, () => {
        const draft = buildDeterministicPaidMetaConversationReply({
            currentMessage, history, qualifier: { facts: {} }, flowVariant: 'broad_pain',
            appPreviewUrl: 'https://future-balance.netlify.app/p/synthetic-preview-token-12345',
        });
        assert.equal(draft?.model, 'deterministic_paid_meta_autonomy_v1');
        assert.doesNotMatch(draft.joined, /\?|https?:|\$|one-off|if you want/i);
        assert.match(draft.joined, /won.t send the link/i);
        assert.ok(!draft.appPreviewHandoff && !draft.videoAttachmentUrl && !draft.imageAttachmentUrl);
        assert.equal(buildPaidMetaConversationApproval({
            metaAdConversationFastLane: true, draft, currentMessage, linkedUserId: null,
        })?.required, false);
    });
}
for (const currentMessage of [
    'I can afford it. Can I see the free preview?',
    "I can't afford a gym membership, but I can afford this. Can I see the free preview?",
    "I can't afford fancy food. Send me the free preview please.",
]) {
    test(`other costs or positive affordability do not decline the course: ${currentMessage}`, () => {
        const draft = buildDeterministicPaidMetaConversationReply({
            currentMessage, history, qualifier: { facts: {} }, flowVariant: 'broad_pain',
            appPreviewUrl: 'https://future-balance.netlify.app/p/synthetic-preview-token-12345',
        });
        assert.equal(draft?.appPreviewHandoff, true);
    });
}
