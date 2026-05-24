const assert = require('assert');

const {
    buildMediaReviewInfo,
    buildMessageMediaBatchParts,
    mergeDraftReviewContextReview,
    normalizeImplicitMediaMarkers,
    softenMediaOnlyDraftReview,
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
    assert.ok(reelLink.reelContextText.includes('third-party media context'));
    assert.ok(reelLink.reelContextText.includes('do not answer it as Shannon unless the sender separately asked Shannon that question'));
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

    const mediaOnlyContextReview = mergeDraftReviewContextReview({
        verdict: 'block',
        confidence: 1,
        summary: "The draft ignores the latest message 'video'.",
        issues: ['The draft does not acknowledge or respond to the latest inbound video marker.'],
        suggested_fix: 'Open the source DM and inspect the video before sending.',
        context_loss_suspected: true,
        notification_required: true,
        notification_reason: 'ignored_latest_message',
    }, {
        required: false,
        reasons: [],
        label: '',
        latest_text: 'video',
        context_dependent: true,
        tracked_outbound_context: true,
    });
    assert.strictEqual(
        mediaOnlyContextReview.required,
        false,
        'media-only latest messages should stay media review, not missing-context review'
    );
    const softenedMediaOnlyReview = softenMediaOnlyDraftReview({
        verdict: 'block',
        confidence: 1,
        summary: "The draft ignores the latest message 'video'.",
        issues: ['ignored latest message'],
        suggested_fix: 'Open source DM.',
        context_loss_suspected: true,
        notification_required: true,
        notification_reason: 'ignored_latest_message',
    }, {
        latest_text: '[attached video #1]',
    });
    assert.strictEqual(softenedMediaOnlyReview.verdict, 'warn');
    assert.strictEqual(softenedMediaOnlyReview.context_loss_suspected, false);
    assert.strictEqual(softenedMediaOnlyReview.notification_required, false);
    assert.strictEqual(softenedMediaOnlyReview.notification_reason, 'media_review_required');

    const textContextReview = mergeDraftReviewContextReview({
        verdict: 'block',
        confidence: 1,
        summary: 'The draft ignores the latest text message.',
        issues: ['ignored latest message'],
        suggested_fix: 'Answer the latest text.',
        context_loss_suspected: true,
        notification_required: true,
        notification_reason: 'ignored_latest_message',
    }, {
        required: false,
        reasons: [],
        label: '',
        latest_text: 'Concert was great x',
        context_dependent: true,
        tracked_outbound_context: true,
    });
    assert.strictEqual(textContextReview.required, true);

    global.fetch = originalFetch;
    console.log('media-batch-parts tests passed');
})().catch(err => {
    global.fetch = originalFetch;
    console.error(err);
    process.exit(1);
});
