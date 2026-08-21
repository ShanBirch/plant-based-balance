const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const {
    isCocosAlertData,
    isChallengeOfferSend,
    isVerifiedPaidMetaProgressionAlertData,
    hasClientFacingAiSelfReference,
    isGratitudeCloserText,
    resolveLatestInboundTextForSend,
    isSafeGratitudeAcknowledgement,
    validateSendTimeOutboundSafety,
    resolveAutomatedConversationAnchorAt,
    joinSentChunkTexts,
    validateOutboundTextIntegrity,
    shouldForceTextDelivery,
    shouldResetGoldCoastAiTestConversationAfterPreview,
} = require('../netlify/functions/send-ig-reply')._test;

assert.strictEqual(shouldForceTextDelivery({ forceText: true }), true);
assert.strictEqual(shouldForceTextDelivery({ force_text: true }), true);
assert.strictEqual(shouldForceTextDelivery({ deliveryMode: 'text' }), true);
assert.strictEqual(shouldForceTextDelivery({ deliveryMode: 'voice' }), false);

assert.strictEqual(isCocosAlertData({ bot_account: 'cocos_pt_studio' }), true);
assert.strictEqual(isCocosAlertData({ algorithm_fork: 'cocos_acquisition_v1' }), true);
assert.strictEqual(isCocosAlertData({
    instagram_graph: { bot_account: '@cocos_pt_studio' },
}), true);
assert.strictEqual(isCocosAlertData({
    instagram_graph: { ig_account_id: '17841435394720504' },
}), true);
assert.strictEqual(isCocosAlertData({ bot_account: 'shan_n_sunny' }), false);

const signedPreviewUrl = 'https://plantbased-balance.org/p/AgAAAAAAAAAAAAAAAAAAAABqAAAAAA';
const goldCoastTestThread = {
    id: '4baea56e-eab4-4887-a732-39b14e983d44',
    ig_username: 'goldcoast_ai_solutions',
    linked_user_id: null,
    custom_data: {
        bot_account: 'shan_n_sunny',
        internal_test_auto_reply_enabled: true,
        internal_test_meta_ad_flow: 'plant_based_control',
    },
};
const previewAlertData = {
    paid_meta_app_preview_handoff: true,
    paid_meta_app_preview_url: signedPreviewUrl,
};
assert.strictEqual(shouldResetGoldCoastAiTestConversationAfterPreview({
    thread: goldCoastTestThread,
    alertData: previewAlertData,
    sentText: `Here you go: ${signedPreviewUrl}`,
    canonicalOutboundIds: ['outbound-1'],
}), true);
assert.strictEqual(shouldResetGoldCoastAiTestConversationAfterPreview({
    thread: { ...goldCoastTestThread, ig_username: 'ordinary_lead' },
    alertData: previewAlertData,
    sentText: `Here you go: ${signedPreviewUrl}`,
    canonicalOutboundIds: ['outbound-1'],
}), false, 'ordinary paid-Meta leads must never auto-reset');
assert.strictEqual(shouldResetGoldCoastAiTestConversationAfterPreview({
    thread: goldCoastTestThread,
    alertData: previewAlertData,
    sentText: `Here you go: ${signedPreviewUrl}`,
    canonicalOutboundIds: [],
}), false, 'delivery must be canonically logged before the test reset');

assert.strictEqual(isChallengeOfferSend({
    alertData: { challenge_offer_warning: { required: true } },
    replyText: 'normal chat',
}), true);
assert.strictEqual(isChallengeOfferSend({
    alertData: {},
    replyText: 'I can send you the starter coaching details if you want',
}), true);
assert.strictEqual(isChallengeOfferSend({
    alertData: {},
    replyText: 'haha that looked like a good session',
}), false);

assert.strictEqual(isVerifiedPaidMetaProgressionAlertData({
    meta_ad_conversation_fast_lane: true,
    draft_model: 'deterministic_paid_meta_guided_sales_v1',
    draft_reply_mode: 'campaign_sales_progression',
    challenge_offer_warning: {
        required: false,
        code: 'approved_meta_ad_sales_progression',
    },
}), true);
assert.strictEqual(isVerifiedPaidMetaProgressionAlertData({
    meta_ad_conversation_fast_lane: true,
    draft_model: 'deterministic_paid_meta_handoff_v1',
    draft_reply_mode: 'campaign_app_preview_handoff',
    challenge_offer_warning: {
        required: false,
        code: 'approved_meta_ad_sales_progression',
    },
}), true, 'the signed app-preview handoff uses the same verified sender path');
assert.strictEqual(isVerifiedPaidMetaProgressionAlertData({
    meta_ad_conversation_fast_lane: true,
    draft_model: 'openai-gpt-5.4-mini-paid-meta',
    draft_reply_mode: 'campaign_sales_progression',
    challenge_offer_warning: {
        required: false,
        code: 'approved_meta_ad_sales_progression',
    },
}), false, 'unverified model output must remain subject to the sender review block');

assert.strictEqual(hasClientFacingAiSelfReference('Sorry that was shanbot'), true);
assert.strictEqual(hasClientFacingAiSelfReference("haha fair call, I'm not AI"), true);
assert.strictEqual(hasClientFacingAiSelfReference('that weighted pull-up setup is cooked'), false);

assert.strictEqual(isGratitudeCloserText('Thanks!!!'), true);
assert.strictEqual(isGratitudeCloserText('thanks, can you send the link?'), false);
assert.strictEqual(isGratitudeCloserText('Awesome I think I just need help with my diet and some accountability'), false);
assert.strictEqual(isGratitudeCloserText('Awesome, send me the details'), false);
assert.strictEqual(isGratitudeCloserText('Awesome how many clients you got working with ya'), false);
assert.strictEqual(isGratitudeCloserText('Perfect I trained legs today'), false);
assert.strictEqual(isGratitudeCloserText('Awesome mate thanks heaps'), true);
assert.strictEqual(resolveLatestInboundTextForSend({
    alertData: { draft_evidence: { current_message: 'Thanks!!!' } },
}), 'Thanks!!!');

assert.deepStrictEqual(
    validateSendTimeOutboundSafety({
        messagesToSend: ['Sorry that was shanbot'],
        latestInboundText: 'lol',
    }).code,
    'client_facing_ai_self_reference'
);
assert.deepStrictEqual(
    validateSendTimeOutboundSafety({
        messagesToSend: ["Who's gonna win?"],
        latestInboundText: 'Thanks!!!',
    }).code,
    'gratitude_closer_fresh_question'
);
assert.strictEqual(validateSendTimeOutboundSafety({
    messagesToSend: ['Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?'],
    latestInboundText: 'Okay!',
    allowQuestionAfterCloser: true,
}).ok, true);
assert.strictEqual(validateSendTimeOutboundSafety({
    messagesToSend: ['No worries at all'],
    latestInboundText: 'Thanks!!!',
}).ok, true);
assert.strictEqual(isSafeGratitudeAcknowledgement('No worries! 😊'), true);
assert.deepStrictEqual(
    validateSendTimeOutboundSafety({
        messagesToSend: ['No worries! Those push-up bar setups are so cute haha.'],
        latestInboundText: 'Thank you 😊',
        automated: true,
    }).code,
    'gratitude_closer_unsupported_detail'
);
assert.strictEqual(validateSendTimeOutboundSafety({
    messagesToSend: ['No worries! 😊'],
    latestInboundText: 'Thank you 😊',
    automated: true,
}).ok, true);
assert.strictEqual(validateSendTimeOutboundSafety({
    messagesToSend: ['About 40 at the moment through Balance.'],
    latestInboundText: 'Awesome how many clients you got working with ya',
    automated: true,
}).ok, true);
assert.strictEqual(resolveAutomatedConversationAnchorAt({
    created_at: '2026-07-29T08:40:00.000Z',
    data: {
        source_inbound_created_at: '2026-07-29T08:39:00.000Z',
        inbound_message_batch: [{ created_at: '2026-07-29T08:39:30.000Z' }],
    },
}), '2026-07-29T08:39:30.000Z');

assert.strictEqual(
    joinSentChunkTexts([
        { text: 'Nice, that focus actually makes heaps of sense.' },
        { text: 'Are you into fitness much too?' },
    ], 'fallback'),
    'Nice, that focus actually makes heaps of sense.\n\nAre you into fitness much too?'
);

assert.strictEqual(
    validateOutboundTextIntegrity('Hahaha ?? what did you train?').code,
    'outbound_text_encoding_corruption'
);
assert.strictEqual(validateOutboundTextIntegrity('wait what??').ok, true);

const sendCoachReplySource = fs.readFileSync(
    path.join(root, 'netlify', 'functions', 'send-coach-reply.js'),
    'utf8'
);
assert.match(
    sendCoachReplySource,
    /replyTextUtf8Base64:\s*Buffer\.from\(replyText, 'utf8'\)\.toString\('base64'\)/,
    'the scheduled coach sender must preserve UTF-8 Base64 through the Instagram function hop'
);
assert.match(
    sendCoachReplySource,
    /draftTextUtf8Base64:\s*Buffer\.from\(draftText, 'utf8'\)\.toString\('base64'\)/
);

console.log('send ig challenge offer notification tests passed');
