const assert = require('assert');

const {
    sanitizeIgStoryReplyContextText,
} = require('../netlify/functions/ig-instant-draft')._test;

const rawStoryReply = `[IG_STORY_REPLY_CONTEXT]
Story caption: If I add them In, next time I want treats, I can check how long it's been since my last piggo night
Visible story text: Meal Logged - 516 cal - now
Their reply: "Hahah how many calories was it"
Story media, if present, belongs to Shannon's story reference. It is not a separate photo or video from the lead.

Raw IG message: replied to your story (story media attached) Hahah how many calories was it`;

assert.strictEqual(
    sanitizeIgStoryReplyContextText(rawStoryReply),
    'Hahah how many calories was it'
);

assert.strictEqual(
    sanitizeIgStoryReplyContextText('Raw IG message: replied to your story [PHOTO:https://example.com/story.jpg] 😍'),
    '😍'
);

assert.strictEqual(
    sanitizeIgStoryReplyContextText('normal non-story message'),
    'normal non-story message'
);

console.log('ig story reply sanitize tests passed');
