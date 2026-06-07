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
    true
);

assert.strictEqual(
    voice.resolveCocosShanSunnyVoiceTestReason({
        botAccount: 'cocos_pt_studio',
        igUsername: 'shan_n_sunny',
    }),
    'shan_n_sunny_to_cocos_pt_studio_test'
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
    voice.isCocosToShanSunnyVoiceTest({
        botAccount: '',
        igUsername: 'shan_n_sunny',
        customData: {
            instagram_graph: {
                ig_account_id: '17841435394720504',
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
assert.strictEqual(voiceConfig.outputFormat, voice.DEFAULT_OUTPUT_FORMAT);

const blockedVoiceConfig = sendIg.resolveOutboundVoiceMessageConfig(
    { outbound_voice_message: true },
    { shouldUseGraph: false, channel: 'instagram' }
);
assert.strictEqual(blockedVoiceConfig.enabled, true);
assert.strictEqual(blockedVoiceConfig.available, false);
assert.strictEqual(blockedVoiceConfig.blockedReason, 'voice_messages_require_instagram_graph');

assert.strictEqual(
    sendIg.isInstagramAudioUnsupportedError('Instagram Graph audio 400: This attachment format is not supported.'),
    true
);

assert.strictEqual(
    sendIg.isInstagramAudioUnsupportedError('Instagram Graph 500: timeout'),
    false
);

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

assert.strictEqual(
    voice.buildTtsText([
        'I would not overthink it. It is useful if you can repeat it. Do not make it ten new rules. You cannot keep that up.',
    ]),
    "I wouldn't overthink it. It's useful if you can repeat it. Don't make it ten new rules. You can't keep that up."
);

assert.strictEqual(
    voice._test.normalizeShannonVoiceContractions('i wouldnt say it is bad, but you are probably overthinking it'),
    "i wouldn't say it's bad, but you're probably overthinking it"
);

const wav = voice._test.wrapPcm16LeAsWav(Buffer.from([0, 0, 255, 127]), 16000, 1);
assert.strictEqual(wav.toString('ascii', 0, 4), 'RIFF');
assert.strictEqual(wav.toString('ascii', 8, 12), 'WAVE');
assert.strictEqual(wav.readUInt32LE(24), 16000);
assert.strictEqual(wav.readUInt16LE(34), 16);
assert.strictEqual(wav.readUInt32LE(40), 4);

assert.deepStrictEqual(
    voice._test.resolveAudioUploadFormat('pcm_16000', 'application/octet-stream'),
    {
        contentType: 'audio/wav',
        extension: 'wav',
        sourceEncoding: 'pcm_s16le',
        sampleRate: 16000,
    }
);

console.log('elevenlabs voice message tests passed');
