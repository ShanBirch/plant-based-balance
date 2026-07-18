const assert = require('assert');

const {
    extractMediaReferences,
    transcriptLooksUsable,
} = require('../netlify/functions/_lib/ig-message-media');

const refs = extractMediaReferences(
    'one [AUDIO:https://cdn.example.com/a.m4a] two [PHOTO:https://cdn.example.com/p.jpg] [VIDEO:https://cdn.example.com/v.mp4]'
);
assert.deepStrictEqual(refs, [
    { ordinal: 1, kind: 'audio', sourceUrl: 'https://cdn.example.com/a.m4a' },
    { ordinal: 2, kind: 'photo', sourceUrl: 'https://cdn.example.com/p.jpg' },
    { ordinal: 3, kind: 'video', sourceUrl: 'https://cdn.example.com/v.mp4' },
]);

assert.strictEqual(transcriptLooksUsable('Yep'), true);
assert.strictEqual(transcriptLooksUsable('I trained this morning and my knee felt good.'), true);
assert.strictEqual(transcriptLooksUsable('inaudible'), false);
assert.strictEqual(transcriptLooksUsable('cannot transcribe this audio'), false);
assert.strictEqual(transcriptLooksUsable('hello hello hello hello hello hello hello'), false);
assert.strictEqual(transcriptLooksUsable(''), false);

console.log('ig-message-media tests passed');
