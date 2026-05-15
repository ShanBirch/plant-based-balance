const assert = require('assert');

const {
    normalizeMetaIgWebhookEvents,
    sourceKeyForEvent,
    buildContextMessage,
} = require('../netlify/functions/_lib/meta-ig-context');

const commentPayload = {
    object: 'instagram',
    entry: [{
        id: '17841400000000000',
        time: 1778223729,
        changes: [{
            field: 'comments',
            value: {
                id: '18114716611826474',
                from: { id: '27021621630806157', username: 'plant_lead' },
                text: 'recipe please',
                media: { id: '17933258556187263', media_product_type: 'REELS' },
            },
        }],
    }],
};

const commentEvents = normalizeMetaIgWebhookEvents(commentPayload);
assert.strictEqual(commentEvents.length, 1);
assert.strictEqual(commentEvents[0].type, 'comment');
assert.strictEqual(commentEvents[0].commentId, '18114716611826474');
assert.strictEqual(commentEvents[0].username, 'plant_lead');
assert.strictEqual(commentEvents[0].mediaId, '17933258556187263');
assert.strictEqual(commentEvents[0].contentType, 'reel');
assert.strictEqual(sourceKeyForEvent(commentEvents[0]), 'ig_media:17933258556187263');

const storyPayload = {
    object: 'instagram',
    entry: [{
        id: '17841400000000000',
        time: 1778223729706,
        messaging: [{
            sender: { id: '978239761327698' },
            recipient: { id: '17841400000000000' },
            timestamp: 1778223722476,
            message: {
                mid: 'aWdfZAG1faXRlbToxOklHTWVz',
                reply_to: {
                    story: {
                        id: '18000011122233344',
                        url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg',
                    },
                },
                text: 'yum',
            },
        }],
    }],
};

const storyEvents = normalizeMetaIgWebhookEvents(storyPayload);
assert.strictEqual(storyEvents.length, 1);
assert.strictEqual(storyEvents[0].type, 'story_reply');
assert.strictEqual(storyEvents[0].storyId, '18000011122233344');
assert.strictEqual(storyEvents[0].storyUrl, 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg');
assert.strictEqual(sourceKeyForEvent(storyEvents[0]), 'ig_story:18000011122233344');

const context = buildContextMessage(storyEvents[0], {
    content_type: 'story',
    analysis_summary: 'Shannon posted a tofu bowl with a practical plant-protein angle.',
});
assert.ok(context.includes('[IG_STORY_REPLY_CONTEXT]'));
assert.ok(context.includes('tofu bowl'));
assert.ok(context.includes('"yum"'));
assert.ok(context.includes('not a separate photo or video from the lead'));

console.log('meta ig context tests passed');
