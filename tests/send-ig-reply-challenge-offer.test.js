const assert = require('assert');

const {
    isCocosAlertData,
    isChallengeOfferSend,
} = require('../netlify/functions/send-ig-reply')._test;

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
    replyText: 'I can get you into the free 30 day challenge if you want',
}), true);
assert.strictEqual(isChallengeOfferSend({
    alertData: {},
    replyText: 'haha that looked like a good session',
}), false);

console.log('send ig challenge offer notification tests passed');
