const assert = require('assert');
const { _test } = require('../netlify/functions/ig-instant-draft');

const storyReply = reply => `[IG_STORY_REPLY_CONTEXT]\nStory: Shannon shared a workout clip.\nTheir reply: "${reply}"`;

assert.strictEqual(_test.isLowContentIgStoryReply(storyReply('🔥🔥🔥')), true);
assert.strictEqual(_test.isLowContentIgStoryReply(storyReply('❤️')), true);
assert.strictEqual(_test.isLowContentIgStoryReply(storyReply('Love this!')), true);
assert.strictEqual(_test.isLowContentIgStoryReply('replied to your story 🔥🔥🔥'), true);
assert.strictEqual(_test.isLowContentIgStoryReply(storyReply('How many reps was that?')), false);
assert.strictEqual(_test.isLowContentIgStoryReply(storyReply('I have been struggling with this lately')), false);
assert.strictEqual(_test.buildLowContentStoryAcknowledgement(storyReply('🔥🔥🔥')), '❤️');
assert.strictEqual(_test.buildLowContentStoryAcknowledgement(storyReply('Love this!')), 'thanks ❤️');

const policy = _test.buildLowContentStoryReplyPolicyBlock({ currentMessage: storyReply('🔥🔥') });
assert.match(policy, /Do not start a conversation, ask a follow-up/);
assert.match(policy, /Return exactly one tiny acknowledgement/);

const substantiveBatch = _test.buildLowContentStoryReplyPolicyBlock({
    currentMessage: storyReply('🔥🔥'),
    recentInboundMessages: [{ text: storyReply('How many reps was that?') }],
});
assert.strictEqual(substantiveBatch, '');

console.log('ig story low-content reply tests passed');
