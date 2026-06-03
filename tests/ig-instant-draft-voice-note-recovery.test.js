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

const fallback = _test.buildEmptyMediaDraftFallbackChunks({
    mediaDecode: { audio_url_count: 1 },
    currentMessageText: '[AUDIO:https://example.com/voice.m4a]',
});
assert.strictEqual(fallback.length, 1);
assert.match(fallback[0], /voice note/i);
assert.doesNotMatch(fallback[0], /\b(ai|automation|draft)\b/i);

console.log('ig instant draft voice-note recovery tests passed');
