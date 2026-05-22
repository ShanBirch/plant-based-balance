const assert = require('assert');

const {
    normalizeMetaIgWebhookEvents,
    sourceKeyForEvent,
    buildContextMessage,
    buildVerifiedStoryContext,
    extractStoryReplyText,
} = require('../netlify/functions/_lib/meta-ig-context');
const {
    parseMetaIgAccountMap,
    buildGraphSubscriberId,
    legacyGraphSubscriberIds,
} = require('../netlify/functions/_lib/meta-ig-accounts');

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
assert.strictEqual(commentEvents[0].ownerId, '17841400000000000');
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
assert.strictEqual(storyEvents[0].direction, 'in');
assert.strictEqual(storyEvents[0].storyId, '18000011122233344');
assert.strictEqual(storyEvents[0].storyUrl, 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg');
assert.strictEqual(storyEvents[0].ownerId, '17841400000000000');
assert.strictEqual(sourceKeyForEvent(storyEvents[0]), 'ig_story:18000011122233344');

const context = buildContextMessage(storyEvents[0], {
    content_type: 'story',
    analysis_summary: 'Shannon posted a tofu bowl with a practical plant-protein angle.',
});
assert.ok(context.includes('[IG_STORY_REPLY_CONTEXT]'));
assert.ok(context.includes('Story summary: Shannon posted a tofu bowl with a practical plant-protein angle.'));
assert.ok(context.includes('"yum"'));
assert.ok(context.includes('not a separate photo or video from the lead'));
assert.strictEqual(extractStoryReplyText(context), 'yum');

const verifiedContext = buildContextMessage(storyEvents[0], {
    content_type: 'story',
    caption: 'quick tofu bowl before training',
});
assert.ok(verifiedContext.includes('Story caption: quick tofu bowl before training'));

const verifiedStoryContext = buildVerifiedStoryContext({
    content_type: 'story',
    caption: 'Still stoked on this 200kg grind',
    media_type: 'VIDEO',
    analysis_visible_text: 'Still stoked on this 200kg grind',
    analysis_summary: 'Shannon posted a video of himself successfully squatting 200kg at the gym.',
    analysis_reply_context: 'User is celebrating a 200kg squat achievement.',
});
assert.ok(verifiedStoryContext.includes('Story caption: Still stoked on this 200kg grind'));
assert.ok(verifiedStoryContext.includes('Story summary: User is celebrating a 200kg squat achievement.'));

const outboundStoryPayload = {
    object: 'instagram',
    entry: [{
        id: '17841400000000000',
        time: 1778223729706,
        messaging: [{
            sender: { id: '17841400000000000' },
            recipient: { id: '978239761327698' },
            timestamp: 1778223722476,
            message: {
                mid: 'aWdfZAG1fb3V0Ym91bmQ',
                is_echo: true,
                reply_to: {
                    story: {
                        id: '18000011122233345',
                        url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/their-story.jpg',
                    },
                },
                text: 'how was it?',
            },
        }],
    }],
};

const outboundStoryEvents = normalizeMetaIgWebhookEvents(outboundStoryPayload);
assert.strictEqual(outboundStoryEvents.length, 1);
assert.strictEqual(outboundStoryEvents[0].direction, 'out');
const outboundContext = buildContextMessage(outboundStoryEvents[0], {
    content_type: 'story',
    analysis_summary: 'A smoothie with carrot and cucumber.',
});
assert.ok(outboundContext.includes('[IG_OUTBOUND_STORY_REPLY_CONTEXT]'));
assert.ok(outboundContext.includes('Shannon replied to their IG story'));
assert.ok(!outboundContext.includes('They replied to Shannon'));

const directMessagePayload = {
    object: 'instagram',
    entry: [{
        id: '17841499999999999',
        time: 1778223730000,
        messaging: [{
            sender: { id: '555222111' },
            recipient: { id: '17841499999999999' },
            timestamp: 1778223729000,
            message: {
                mid: 'ig_mid_dm_1',
                text: 'sounds good',
                attachments: [{
                    type: 'image',
                    payload: { url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/photo.jpg' },
                }],
            },
        }, {
            sender: { id: '17841499999999999' },
            recipient: { id: '555222111' },
            timestamp: 1778223729500,
            message: {
                mid: 'ig_mid_echo_1',
                text: 'owner echo',
                is_echo: true,
            },
        }],
    }],
};
const directEvents = normalizeMetaIgWebhookEvents(directMessagePayload);
assert.strictEqual(directEvents.length, 1);
assert.strictEqual(directEvents[0].type, 'message');
assert.strictEqual(directEvents[0].ownerId, '17841499999999999');
assert.strictEqual(directEvents[0].fromId, '555222111');
assert.ok(directEvents[0].text.includes('sounds good'));
assert.ok(directEvents[0].text.includes('[PHOTO:https://lookaside.fbsbx.com/ig_messaging_cdn/photo.jpg]'));

const accountMap = parseMetaIgAccountMap(JSON.stringify({
    '17841499999999999': {
        bot_account: 'cocos_pt_studio',
        access_token_env: 'META_IG_COCOS_ACCESS_TOKEN',
        auto_draft_messages: true,
    },
}));
assert.strictEqual(accountMap['17841499999999999'].botAccount, 'cocos_pt_studio');
assert.strictEqual(accountMap['17841499999999999'].accessTokenEnv, 'META_IG_COCOS_ACCESS_TOKEN');
assert.strictEqual(accountMap['17841499999999999'].autoDraftMessages, true);
assert.strictEqual(buildGraphSubscriberId('17841499999999999', '555222111'), 'ig_graph:17841499999999999:555222111');
assert.deepStrictEqual(legacyGraphSubscriberIds('555222111'), ['meta_ig:555222111', 'ig_graph:555222111']);

console.log('meta ig context tests passed');
