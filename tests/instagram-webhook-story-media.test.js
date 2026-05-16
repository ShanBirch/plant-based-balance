const assert = require('assert');

const { _test } = require('../netlify/functions/instagram-webhook');
const { normalizeMetaIgWebhookEvents } = require('../netlify/functions/_lib/meta-ig-context');

const text = _test.messageTextForDraft({
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '978239761327698' },
        recipient: { id: '17841400000000000' },
        message: {
            reply_to: {
                story: {
                    id: '18000011122233344',
                    url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg',
                },
            },
            text: 'Good tip, I follow less vegan foodies now',
        },
    },
});

assert.ok(text.includes('replied to your story (story media attached)'));
assert.ok(text.includes('Good tip, I follow less vegan foodies now'));
assert.ok(!text.includes('[PHOTO:'));

const outbound = _test.messageTextForDraft({
    field: 'message_echoes',
    igAccountId: '17841400000000000',
    item: {
        sender: { id: '17841400000000000' },
        recipient: { id: '978239761327698' },
        message: {
            is_echo: true,
            reply_to: {
                story: {
                    id: '18000011122233345',
                    url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/their-story.jpg',
                },
            },
            text: 'Ooooh I dunno about that! How was it?',
        },
    },
});

assert.ok(outbound.includes('replied to their story (story media attached)'));
assert.ok(!outbound.includes('replied to your story'));
assert.ok(outbound.includes('Ooooh I dunno about that! How was it?'));

const outboundEvents = normalizeMetaIgWebhookEvents({
    object: 'instagram',
    entry: [{
        id: '17841400000000000',
        messaging: [{
            sender: { id: '17841400000000000' },
            recipient: { id: '978239761327698' },
            timestamp: 1778223722476,
            message: {
                mid: 'outbound-story-echo',
                is_echo: true,
                reply_to: { story: { id: '18000011122233345' } },
                text: 'Ooooh I dunno about that! How was it?',
            },
        }],
    }],
});

assert.strictEqual(outboundEvents[0].direction, 'out');
assert.strictEqual(_test.shouldProcessContentContextEvent(outboundEvents[0]), false);

console.log('instagram webhook story media tests passed');
