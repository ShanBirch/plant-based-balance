const assert = require('assert');

const { _test } = require('../netlify/functions/ig-instant-draft');

const recoveredAfterGuard = _test.finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ['what kind of dog is it?'] }),
    {
        maxChunks: 3,
        leadName: 'Kennedy',
        currentMessageText: 'nero',
        hasDecodedMedia: true,
    }
);
assert.deepStrictEqual(
    recoveredAfterGuard,
    ['What kind of dog is it?'],
    'a conservative cleaner must not turn a non-empty model reply into a blank Needs You draft'
);

const cleanedReceipt = _test.finalizeDraftChunksFromRawText(
    JSON.stringify({ messages: ['just listened to your voice note, that makes sense. what happened after that?'] }),
    {
        maxChunks: 3,
        leadName: 'Kennedy',
        currentMessageText: '[AUDIO:https://example.com/voice.m4a]',
        hasDecodedMedia: true,
    }
);
assert.strictEqual(
    cleanedReceipt[0],
    'That makes sense. What happened after that?',
    'decoded voice-note drafts should not open with a listening receipt'
);

const reviewContext = _test.buildAudioTranscriptReviewContext({
    analysis_succeeded: true,
    audio_transcripts: [
        { text: 'I messaged because I was curious why you followed me, and now I am getting awkwardly flirty.' },
        { text: 'I want to hear your accent too.' },
    ],
}, 'Erika');
assert.match(reviewContext, /Decoded voice-note content from Erika/);
assert.match(reviewContext, /awkwardly flirty/);
assert.match(reviewContext, /hear your accent/);

const fallback = _test.buildEmptyMediaDraftFallbackChunks({
    mediaDecode: { audio_url_count: 1 },
    currentMessageText: '[AUDIO:https://example.com/voice.m4a]',
});
assert.strictEqual(fallback.length, 1);
assert.match(fallback[0], /voice note/i);
assert.doesNotMatch(fallback[0], /\b(ai|automation|draft)\b/i);

assert.strictEqual(
    _test.isAudioPuntDraftChunks(
        ["I'll listen to this properly and get back to you"],
        {
            mediaDecode: { audio_url_count: 1, audio_inline_count: 1 },
            currentMessageText: '[voice note #1]',
        }
    ),
    true,
    'audio drafts that punt to future listening must be blocked before reaching Needs You'
);

assert.strictEqual(
    _test.isAudioPuntDraftChunks(
        ['yeah that makes sense, Palmy sounds way more your speed already haha'],
        {
            mediaDecode: { audio_url_count: 1, audio_inline_count: 1 },
            currentMessageText: '[voice note #1 transcript: Palmy is way better already]',
        }
    ),
    false,
    'real replies to voice-note content should not be blocked'
);

console.log('ig instant draft voice-note recovery tests passed');
