const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildDeterministicPaidMetaConversationReply,
    buildPaidMetaConversationApproval,
} = require('../netlify/functions/ig-instant-draft')._test;

const previewUrl = 'https://future-balance.netlify.app/p/synthetic-preview-token-12345';
const history = [{ direction: 'out', text: "What's the main change you'd like to make over the next six weeks?" }];
const qualifier = { commercial_stage: 'engaged', facts: {} };
const requests = [
    'Could I have a look at it first?',
    'Please send the free preview',
    'I want to get fit again. Honestly not sure what stops me. Yes, getting back into a routine. Can I see the free preview?',
    'Can I see the free preview?',
    'Could I try my personalised app preview?',
    'May I look at a free personalized preview?',
    'I want to see the free app preview before I pay.',
    'Can I just see the preview first?\nI don’t want to answer a bunch of questions.',
];

for (const currentMessage of requests) {
    test(`explicit preview request gets an approved handoff: ${currentMessage}`, () => {
        const draft = buildDeterministicPaidMetaConversationReply({
            currentMessage, history, qualifier, flowVariant: 'broad_pain', appPreviewUrl: previewUrl,
        });
        assert.equal(draft?.replyMode, 'campaign_app_preview_handoff');
        assert.equal(draft.appPreviewHandoff, true);
        assert.ok(draft.joined.includes(previewUrl));
        assert.doesNotMatch(draft.joined, /\?|course video|main change|gets in the way/i);
        assert.ok(!draft.videoAttachmentUrl && !draft.imageAttachmentUrl);
        const approval = buildPaidMetaConversationApproval({
            metaAdConversationFastLane: true, draft, currentMessage, qualifier, linkedUserId: null,
        });
        assert.equal(approval?.required, false);
        assert.equal(approval?.code, 'approved_meta_ad_sales_progression');
        assert.equal(buildPaidMetaConversationApproval({
            metaAdConversationFastLane: true, draft, currentMessage, qualifier, linkedUserId: 'existing-client',
        }), null);
    });
}

test('preview handoff explicitly answers an automatic-charge question in the same turn', () => {
    const currentMessage = 'Can I see the free preview, and will it charge me automatically?';
    const draft = buildDeterministicPaidMetaConversationReply({ currentMessage, history, qualifier, flowVariant: 'broad_pain', appPreviewUrl: previewUrl });
    assert.equal(draft?.appPreviewHandoff, true);
    assert.match(draft.joined, /preview is free/i);
    assert.match(draft.joined, /won.t charge you automatically/i);
    assert.ok(draft.joined.includes(previewUrl));
    assert.equal(buildPaidMetaConversationApproval({ metaAdConversationFastLane: true, draft, currentMessage, qualifier })?.required, false);
});

for (const currentMessage of [
    'Can I see the free preview? Actually no thanks, not now.',
    'Please don’t send me the free preview.',
    'I do not want to see the free preview.',
    'What is included in the free preview?',
]) {
    test(`non-request or decline does not hand off: ${currentMessage}`, () => {
        const draft = buildDeterministicPaidMetaConversationReply({
            currentMessage, history, qualifier, flowVariant: 'broad_pain', appPreviewUrl: previewUrl,
        });
        assert.notEqual(draft?.appPreviewHandoff, true);
        assert.ok(!draft?.joined?.includes(previewUrl));
    });
}
