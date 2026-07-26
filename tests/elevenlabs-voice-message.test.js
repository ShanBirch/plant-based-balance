const assert = require('assert');

const voice = require('../netlify/functions/_lib/elevenlabs-voice-message');
const igDraft = require('../netlify/functions/ig-instant-draft')._test;
const sendIg = require('../netlify/functions/send-ig-reply')._test;

const personalVoicePrompt = igDraft.buildPersonalVoiceNoteDraftingBlock(true);
assert.match(personalVoicePrompt, /20 to 26 seconds/i);
assert.match(personalVoicePrompt, /At least one must be a natural "um" or "ah"/i);
assert.match(personalVoicePrompt, /punctuation-led breathing pauses/i);
assert.match(personalVoicePrompt, /Vary the hesitation placement/i);
assert.match(personalVoicePrompt, /hard-blocks shorter or longer scripts/i);
assert.match(personalVoicePrompt, /Never write laughter into a generated voice note/i);
assert.match(personalVoicePrompt, /any imitation of a chuckle/i);
assert.strictEqual(igDraft.buildPersonalVoiceNoteDraftingBlock(false), '');

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

const reviewedTiming = igDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 30 * 60 * 1000, label: '30m', reason: 'normal timing' },
    allowImmediate: true,
});
assert.strictEqual(reviewedTiming.action, 'schedule');
assert.strictEqual(reviewedTiming.delay_ms, 30 * 60 * 1000);

const normalTiming = igDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 0, label: 'now', reason: 'normal timing' },
});
assert.strictEqual(normalTiming.action, 'schedule');
assert.strictEqual(normalTiming.delay_ms, 15 * 60 * 1000);

assert.strictEqual(
    voice.buildTtsText(['hey there', 'second bubble']),
    'hey there\n\nUm... second bubble'
);

assert.strictEqual(
    voice.ensureNaturalVoiceHesitation('Yeah, um, that makes sense. Keep it simple.'),
    'Yeah, um, that makes sense. Keep it simple.'
);

assert.match(
    voice.ensureNaturalVoiceHesitation('That makes sense. Keep the next step simple.'),
    /\. Um\.\.\. Keep/
);

assert.strictEqual(
    voice.buildTtsText([
        'I would not overthink it. It is useful if you can repeat it. Do not make it ten new rules. You cannot keep that up.',
    ]),
    "I wouldn't overthink it. Um... It's useful if you can repeat it. Don't make it ten new rules. You can't keep that up."
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

const words = count => Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
assert.strictEqual(voice.inspectVoiceScriptQuality(words(44)).valid, false);
assert.strictEqual(voice.inspectVoiceScriptQuality(words(45)).valid, true);
assert.strictEqual(voice.inspectVoiceScriptQuality(words(75)).valid, true);
assert.strictEqual(voice.inspectVoiceScriptQuality(words(76)).valid, false);
assert.strictEqual(
    voice.inspectVoiceScriptQuality(`Haha, ${words(50)}`).issues.some(issue => /written laughter/.test(issue)),
    true
);
assert.strictEqual(voice.inspectVoiceScriptQuality(`hahahahah, ${words(50)}`).valid, false);
assert.strictEqual(voice.inspectVoiceScriptQuality(`ahahaha, ${words(50)}`).valid, false);
assert.strictEqual(voice.inspectVoiceScriptQuality(`${words(20)} lol ${words(30)}`).valid, false);
assert.strictEqual(voice.inspectVoiceScriptQuality(`That's genuinely funny, ${words(50)}`).valid, true);

const shortVoiceRepairIssues = igDraft.collectCocosAutoRepairIssues({
    draft: { joined: 'ah yeah, that makes sense' },
    voiceNoteMode: true,
});
assert.strictEqual(shortVoiceRepairIssues.some(issue => /minimum is 45/i.test(issue)), true);

const personalVoicePlan = voice.resolvePersonalVoiceReplyPlan({
    channel: 'instagram',
    hasInstagramGraphRoute: true,
    currentMessage: "I've been struggling to stay consistent and I want to get stronger",
    qualifier: {
        facts: {
            current_state: 'struggling to stay consistent with training',
            motivation: 'wants to get stronger',
        },
    },
    meaningfulLeadReplyCount: 2,
    hasRecentVoiceMessage: false,
});
assert.strictEqual(personalVoicePlan.useSyntheticVoice, true);
assert.strictEqual(personalVoicePlan.reason, 'lead_shared_meaningful_goal_or_blocker');

const informationalFirstReplyPlan = voice.resolvePersonalVoiceReplyPlan({
    channel: 'instagram',
    hasInstagramGraphRoute: true,
    currentMessage: 'Hey can you tell me about your challenge?',
    qualifier: {
        facts: {
            current_state: 'asking about the challenge',
            motivation: 'wants to get stronger',
        },
    },
    meaningfulLeadReplyCount: 12,
    hasRecentVoiceMessage: false,
});
assert.strictEqual(informationalFirstReplyPlan.useSyntheticVoice, false);
assert.strictEqual(informationalFirstReplyPlan.reason, '');

assert.strictEqual(
    voice.resolvePersonalVoiceReplyPlan({
        channel: 'instagram',
        hasInstagramGraphRoute: true,
        currentMessage: 'I want to get stronger but consistency is hard',
        qualifier: { facts: { current_state: 'consistency is hard' } },
        meaningfulLeadReplyCount: 3,
        hasRecentVoiceMessage: true,
    }).useSyntheticVoice,
    false
);

const continuingVoicePlan = voice.resolvePersonalVoiceReplyPlan({
    channel: 'instagram',
    hasInstagramGraphRoute: true,
    currentMessage: '[voice note]',
    inboundVoiceMessage: true,
    meaningfulLeadReplyCount: 0,
    hasRecentVoiceMessage: true,
});
assert.strictEqual(continuingVoicePlan.useSyntheticVoice, true);
assert.strictEqual(continuingVoicePlan.reason, 'lead_continuing_voice_note_lane');

const manualVoiceFallbackPlan = voice.resolvePersonalVoiceReplyPlan({
    channel: 'instagram',
    hasInstagramGraphRoute: false,
    currentMessage: '[voice note]',
    inboundVoiceMessage: true,
});
assert.strictEqual(manualVoiceFallbackPlan.useSyntheticVoice, false);
assert.strictEqual(manualVoiceFallbackPlan.manualNativeVoiceRecommended, true);
assert.strictEqual(manualVoiceFallbackPlan.manualNativeVoiceReason, 'inbound_voice_requires_manual_route');

assert.strictEqual(
    igDraft.hasInboundVoiceNoteInUnansweredBatch({
        currentMessage: '[AUDIO:https://cdn.example.com/latest.m4a]',
    }),
    true
);
assert.strictEqual(
    igDraft.hasInboundVoiceNoteInUnansweredBatch({
        currentMessage: 'and one more thing',
        recentInboundMessages: [{ text: '[AUDIO:https://cdn.example.com/first.m4a]' }],
    }),
    true
);
assert.strictEqual(
    igDraft.hasInboundVoiceNoteInUnansweredBatch({ currentMessage: 'typed message only' }),
    false
);

const aiQuestionPlan = voice.resolvePersonalVoiceReplyPlan({
    channel: 'instagram',
    hasInstagramGraphRoute: true,
    currentMessage: 'Are you AI or is this really Shannon?',
    qualifier: { facts: { current_state: 'looking for support' } },
    meaningfulLeadReplyCount: 4,
    inboundVoiceMessage: true,
});
assert.strictEqual(aiQuestionPlan.useSyntheticVoice, false);
assert.strictEqual(aiQuestionPlan.syntheticVoiceForbidden, true);
assert.strictEqual(aiQuestionPlan.manualNativeVoiceRecommended, true);
assert.match(aiQuestionPlan.manualNativeVoiceScript, /use a bit of help organising my inbox/i);

console.log('elevenlabs voice message tests passed');
