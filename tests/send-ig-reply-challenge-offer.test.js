const assert = require('assert');

const {
    isCocosAlertData,
    isChallengeOfferSend,
    hasClientFacingAiSelfReference,
    isGratitudeCloserText,
    resolveLatestInboundTextForSend,
    isSafeGratitudeAcknowledgement,
    validateSendTimeOutboundSafety,
    resolveAutomatedConversationAnchorAt,
    joinSentChunkTexts,
    validateOutboundTextIntegrity,
    shouldForceTextDelivery,
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

assert.strictEqual(hasClientFacingAiSelfReference('Sorry that was shanbot'), true);
assert.strictEqual(hasClientFacingAiSelfReference("haha fair call, I'm not AI"), true);
assert.strictEqual(hasClientFacingAiSelfReference('that weighted pull-up setup is cooked'), false);

assert.strictEqual(isGratitudeCloserText('Thanks!!!'), true);
assert.strictEqual(isGratitudeCloserText('thanks, can you send the link?'), false);
assert.strictEqual(isGratitudeCloserText('Awesome I think I just need help with my diet and some accountability'), false);
assert.strictEqual(isGratitudeCloserText('Awesome, send me the details'), false);
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

console.log('send ig challenge offer notification tests passed');
