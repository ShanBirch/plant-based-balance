const assert = require('assert');

const { _test } = require('../netlify/functions/manychat-inbound');

const rawMultilineJson = `{"subscriber_id":"1817414324","message":"Been thinking too, back in 2019 when I was in my best shape.
Like, I have been doing more Pilates style workouts for the last 3/4 years.

So you think I should try emulate that situation again?","custom_data":{"source":"instagram"}}`;

const parsedMultiline = _test.parseManyChatPayload(rawMultilineJson);
assert.strictEqual(parsedMultiline.subscriber_id, '1817414324');
assert.strictEqual(
    parsedMultiline.message,
    'Been thinking too, back in 2019 when I was in my best shape.\nLike, I have been doing more Pilates style workouts for the last 3/4 years.\n\nSo you think I should try emulate that situation again?'
);
assert.deepStrictEqual(parsedMultiline.custom_data, { source: 'instagram' });

const parsedForm = _test.parseManyChatPayload(
    'subscriber_id=1817414324&message=Line%201%0ALine%202&custom_data=%7B%22source%22%3A%22instagram%22%7D'
);
assert.strictEqual(parsedForm.message, 'Line 1\nLine 2');
assert.deepStrictEqual(parsedForm.custom_data, { source: 'instagram' });

const storyReplyContext = `[IG_STORY_REPLY_CONTEXT]
Story caption: If I add them In, next time I want treats, I can check how long it's been since my last piggo night
Visible story text: Meal Logged - 516 cal - now
Their reply: "Hahah how many calories was it"

Raw IG message: replied to your story (story media attached) Hahah how many calories was it`;

assert.strictEqual(
    _test.normalizeComparableText(storyReplyContext),
    _test.normalizeComparableText('Hahah how many calories was it')
);

console.log('manychat-inbound parse tests passed');
