const assert = require('assert');

const { buildMessageMediaBatchParts } = require('../netlify/functions/_lib/client-context');

const originalFetch = global.fetch;

global.fetch = async (url) => {
    if (String(url).includes('/voice.m4a')) {
        return new Response(Buffer.from('fake audio bytes'), {
            status: 200,
            headers: { 'content-type': 'audio/mp4' },
        });
    }
    if (String(url).includes('/photo.png')) {
        return new Response(Buffer.from('fake image bytes'), {
            status: 200,
            headers: { 'content-type': 'image/png' },
        });
    }
    throw new Error(`unexpected fetch ${url}`);
};

(async () => {
    const audioThenText = await buildMessageMediaBatchParts([
        '[AUDIO:https://cdn.example.com/voice.m4a]',
        'Ps did a session today but it did not save in the app haha',
    ]);

    assert.strictEqual(audioThenText.audioUrlCount, 1);
    assert.strictEqual(audioThenText.audioParts.length, 1);
    assert.strictEqual(audioThenText.mediaParts.length, 1);
    assert.strictEqual(audioThenText.rewrittenMessages[0], '[voice note #1]');
    assert.strictEqual(
        audioThenText.rewrittenMessages[1],
        'Ps did a session today but it did not save in the app haha'
    );

    const photoAndAudio = await buildMessageMediaBatchParts([
        'look at this [PHOTO:https://cdn.example.com/photo.png]',
        '[AUDIO:https://cdn.example.com/voice.m4a]',
    ]);

    assert.strictEqual(photoAndAudio.photoUrlCount, 1);
    assert.strictEqual(photoAndAudio.audioUrlCount, 1);
    assert.strictEqual(photoAndAudio.imageParts.length, 1);
    assert.strictEqual(photoAndAudio.audioParts.length, 1);
    assert.strictEqual(photoAndAudio.rewrittenMessages[0], 'look at this [attached photo #1]');
    assert.strictEqual(photoAndAudio.rewrittenMessages[1], '[voice note #1]');

    global.fetch = originalFetch;
    console.log('media-batch-parts tests passed');
})().catch(err => {
    global.fetch = originalFetch;
    console.error(err);
    process.exit(1);
});
