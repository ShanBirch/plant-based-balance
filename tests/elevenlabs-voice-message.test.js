const assert = require('assert');

const voice = require('../netlify/functions/_lib/elevenlabs-voice-message');
const igDraft = require('../netlify/functions/ig-instant-draft')._test;
const sendIg = require('../netlify/functions/send-ig-reply')._test;

assert.strictEqual(
    voice.isCocosToShanSunnyVoiceTest({
        botAccount: 'shan_n_sunny',
        igUsername: 'cocos_pt_studio',
    }),
    true
);

assert.strictEqual(
    voice.isCocosToShanSunnyVoiceTest({
        botAccount: 'cocos_pt_studio',
        igUsername: 'shan_n_sunny',
    }),
    false
);

assert.strictEqual(
    voice.isCocosToShanSunnyVoiceTest({
        botAccount: 'cocos_pt_studio',
        igUsername: 'cocos_pt_studio',
        customData: {
            instagram_graph: {
                ig_account_id: '17841415641641750',
            },
        },
    }),
    true
);

assert.strictEqual(
    igDraft.isCocosToShanSunnyVoiceTest({
        botAccount: '@shan_n_sunny',
        igUsername: '@cocos_pt_studio',
    }),
    true
);

const voiceConfig = sendIg.resolveOutboundVoiceMessageConfig(
    { outbound_voice_message: true },
    { shouldUseGraph: true, channel: 'instagram' }
);
assert.strictEqual(voiceConfig.enabled, true);
assert.strictEqual(voiceConfig.available, true);
assert.strictEqual(voiceConfig.voiceId, voice.DEFAULT_SHANNON_PROFESSIONAL_VOICE_ID);

const blockedVoiceConfig = sendIg.resolveOutboundVoiceMessageConfig(
    { outbound_voice_message: true },
    { shouldUseGraph: false, channel: 'instagram' }
);
assert.strictEqual(blockedVoiceConfig.enabled, true);
assert.strictEqual(blockedVoiceConfig.available, false);
assert.strictEqual(blockedVoiceConfig.blockedReason, 'voice_messages_require_instagram_graph');

const immediateTiming = igDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 30 * 60 * 1000, label: '30m', reason: 'normal timing' },
    allowImmediate: true,
});
assert.strictEqual(immediateTiming.action, 'send_now');
assert.strictEqual(immediateTiming.delay_ms, 0);

const normalTiming = igDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 0, label: 'now', reason: 'normal timing' },
});
assert.strictEqual(normalTiming.action, 'schedule');
assert.strictEqual(normalTiming.delay_ms, 15 * 60 * 1000);

assert.strictEqual(
    voice.buildTtsText(['hey there', 'second bubble']),
    'hey there\n\nsecond bubble'
);

console.log('elevenlabs voice message tests passed');
