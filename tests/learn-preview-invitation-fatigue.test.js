const test = require('node:test');
const assert = require('node:assert/strict');
const { removeRepeatedPaidMetaPreviewInvitation } = require('../netlify/functions/ig-instant-draft')._test;
const invitation = 'If you want, I can send the free personalised app preview next so you can see how it would be set up for you before deciding.';
const answer = 'No, the core lessons are the same for everyone. Your workout setup can be personalised.';
const history = [{ direction: 'out', text: invitation }];
const draft = { chunks: [answer, invitation], joined: `${answer}\n${invitation}`, model: 'writer' };
test('factual follow-up retains answer and drops already offered standalone preview invitation', () => {
    const result = removeRepeatedPaidMetaPreviewInvitation({ draft, history, currentMessage: 'Are the lessons different for everyone?' });
    assert.equal(result.joined, answer);
    assert.deepEqual(result.chunks, [answer]);
    for (const ending of [invitation.replace('If you want', 'If you’d like'), invitation.replace('If you want', 'If you would like')]) {
        const variant = { ...draft, chunks: [answer, ending], joined: `${answer}\n${ending}` };
        assert.equal(removeRepeatedPaidMetaPreviewInvitation({ draft: variant, history, currentMessage: 'How many lessons?' }).joined, answer);
    }
});
test('first invitation, explicit handoff and media sequence remain intact', () => {
    assert.equal(removeRepeatedPaidMetaPreviewInvitation({ draft, history: [], currentMessage: 'How many lessons?' }), draft);
    for (const extra of [{ appPreviewHandoff: true }, { videoAttachmentUrl: 'https://example.com/video.mp4' }, { imageAttachmentUrl: 'https://example.com/proof.jpg' }]) {
        const protectedDraft = { ...draft, ...extra };
        assert.equal(removeRepeatedPaidMetaPreviewInvitation({ draft: protectedDraft, history, currentMessage: 'How many lessons?' }), protectedDraft);
    }
    assert.equal(removeRepeatedPaidMetaPreviewInvitation({ draft, history, currentMessage: 'Can I see the preview?' }), draft);
});
