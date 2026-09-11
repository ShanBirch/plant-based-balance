const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply, buildPaidMetaConversationApproval, selectFastDeterministicPaidMetaProgression } = require('../netlify/functions/ig-instant-draft')._test;
const history = [{ direction: 'out', text: "What's the main change you want in the next six weeks?" }];
for (const currentMessage of [
    'can i see the preview\nactually hold off please',
    'can i see the preview actually hold off please',
    'Can I see the free preview?\nActually hold off, I need to check with my partner.',
    'Can I see the free preview? Please hold off for now.',
    'Hold off, please.',
    'Need to think about it',
    'I need to think about this.',
]) test(`preview withdrawal produces a sendable pause: ${currentMessage}`, () => {
    const draft = buildDeterministicPaidMetaConversationReply({ currentMessage, history, flowVariant: 'broad_pain', appPreviewUrl: 'https://future-balance.netlify.app/p/synthetic-preview-token-12345' });
    assert.equal(draft?.model, 'deterministic_paid_meta_autonomy_v1');
    assert.equal(selectFastDeterministicPaidMetaProgression({ draft, currentMessage }), draft);
    assert.doesNotMatch(draft.joined, /https?:|\?|want me to/i);
    assert.match(draft.joined, /won.t send/i);
    assert.equal(buildPaidMetaConversationApproval({ metaAdConversationFastLane: true, currentMessage, draft })?.required, false);
});
test('negated hold-off wording does not block an explicit request', () => {
    const draft = buildDeterministicPaidMetaConversationReply({ currentMessage: "Don't hold off. Can I see the free preview?", history, flowVariant: 'broad_pain', appPreviewUrl: 'https://future-balance.netlify.app/p/synthetic-preview-token-12345' });
    assert.equal(draft?.appPreviewHandoff, true);
});

for (const currentMessage of [
    'actually hold off\nchanged my mind please send the preview',
    'No thanks. I changed my mind, can I see the preview?',
]) test(`explicit renewed consent supersedes an earlier pause: ${currentMessage}`, () => {
    const draft = buildDeterministicPaidMetaConversationReply({currentMessage, history, flowVariant:'broad_pain', appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-preview-token-12345'});
    assert.equal(draft?.appPreviewHandoff, true);
});

test('a withdrawal after renewed consent still wins', () => {
    const currentMessage = 'Hold off. Changed my mind, send the preview. Actually hold off please';
    const draft = buildDeterministicPaidMetaConversationReply({currentMessage, history, flowVariant:'broad_pain', appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-preview-token-12345'});
    assert.equal(draft?.model, 'deterministic_paid_meta_autonomy_v1');
    assert.doesNotMatch(draft.joined, /https?:/);
});
