const assert = require('assert');

const {
    buildMediaReviewInfo,
    buildMessageMediaBatchParts,
    normalizeImplicitMediaMarkers,
} = require('../netlify/functions/_lib/client-context');

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
    if (String(url).includes('lookaside.fbsbx.com/ig_messaging_cdn')) {
        return new Response(Buffer.from('fake jpg bytes'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
        });
    }
    if (String(url).includes('scontent.cdninstagram.com/reel-thumb.jpg')) {
        return new Response(Buffer.from('fake reel thumbnail bytes'), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
        });
    }
    if (String(url).includes('instagram.com/reel/')) {
        return new Response(`
            <html><head>
                <meta property="og:title" content="Michael Eckert on Instagram: &quot;I owe a lot of credit to these things, truly. You just have to use them correctly!&quot;">
                <meta property="og:description" content="296K likes, 1,684 comments - michaeleckert_fit on February 18, 2026: &quot;I owe a lot of credit to these things, truly. You just have to use them correctly!&quot;.">
                <meta property="og:image" content="https://scontent.cdninstagram.com/reel-thumb.jpg">
            </head></html>
        `, {
            status: 200,
            headers: { 'content-type': 'text/html' },
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

    const reelLink = await buildMessageMediaBatchParts([
        'https://www.instagram.com/reel/DYbSqu6A9qO/',
    ]);
    assert.strictEqual(reelLink.videoUrlCount, 1);
    assert.strictEqual(reelLink.videoParts.length, 0);
    assert.strictEqual(reelLink.reelContextCount, 1);
    assert.strictEqual(reelLink.reelThumbnailCount, 1);
    assert.strictEqual(reelLink.mediaParts.length, 1);
    assert.ok(reelLink.reelContextText.includes('Creator/account: Michael Eckert'));
    assert.ok(reelLink.reelContextText.includes('I owe a lot of credit'));
    assert.ok(reelLink.reelContextText.includes('Do not claim to have watched the full reel'));
    assert.strictEqual(reelLink.rewrittenMessages[0], '[Instagram reel #1]');

    const genericGraphAttachment = await buildMessageMediaBatchParts([
        '[attachment:https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=123&signature=abc]',
    ]);
    assert.strictEqual(genericGraphAttachment.photoUrlCount, 1);
    assert.strictEqual(genericGraphAttachment.imageParts.length, 1);
    assert.strictEqual(genericGraphAttachment.rewrittenMessages[0], '[attached photo #1]');

    const review = buildMediaReviewInfo({
        message_preview: 'https://www.instagram.com/reel/DYbSqu6A9qO/',
    });
    assert.strictEqual(review.required, true);
    assert.deepStrictEqual(review.kinds, ['video']);
    assert.strictEqual(
        normalizeImplicitMediaMarkers('[attachment:https://www.instagram.com/reel/DYbSqu6A9qO/]'),
        '[VIDEO:https://www.instagram.com/reel/DYbSqu6A9qO/]'
    );

    global.fetch = originalFetch;
    console.log('media-batch-parts tests passed');
})().catch(err => {
    global.fetch = originalFetch;
    console.error(err);
    process.exit(1);
});
