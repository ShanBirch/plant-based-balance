const assert = require('assert');

const { _test } = require('../netlify/functions/ig-instant-draft');

const input = `[IG_STORY_REPLY_CONTEXT]
They replied to Shannon's story: Shannon talks about influencing actions, changing Instagram algorithms, getting a coach, and changing the physical environment.
Their reply: "Good tip, I follow a lot less vegan foodies now"

Raw IG message: replied to your story [PHOTO:https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg?asset_id=123] Good tip, I follow a lot less vegan foodies now`;

const output = _test.sanitizeIgStoryReplyContextText(input);

assert.strictEqual(_test.isIgStoryReplyContextText(input), true);
assert.ok(output.includes('changing Instagram algorithms'));
assert.ok(output.includes('Good tip, I follow a lot less vegan foodies now'));
assert.ok(output.includes('story media attached'));
assert.ok(!/\[PHOTO:https?:\/\//i.test(output));

console.log('ig story reply sanitize tests passed');
