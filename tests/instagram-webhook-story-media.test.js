const assert = require('assert');

const { _test } = require('../netlify/functions/instagram-webhook');

const text = _test.messageTextForDraft({
    item: {
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

console.log('instagram webhook story media tests passed');
