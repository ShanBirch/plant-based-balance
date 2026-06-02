const assert = require('assert');

const {
    buildContextReviewInfo,
    buildLearningReelContextBlock,
    findDuplicateLearningReels,
    mergeLearningReelContext,
    normalizeLearningReelHistory,
} = require('../netlify/functions/_lib/client-context');
const { _test: managerTest } = require('../netlify/functions/client-lead-manager');

const sentAt = '2026-06-02T02:00:00.000Z';
const customData = mergeLearningReelContext({}, [{
    topic_label: 'Mindset',
    title: 'How emotions are made',
    description: 'Lisa Feldman Barrett explains how the brain constructs emotion from prediction and body signals.',
    channel_title: 'Lisa Feldman Barrett',
    url: 'https://www.youtube.com/shorts/DXDp7tqpcdU?feature=share',
    youtube_query: 'Lisa Feldman Barrett emotional brain short',
    reason: 'Matched the client learning interest: Mindset.',
    learning_modules: ['Mindset', 'Neuroscience'],
}], {
    sentAt,
    sentMessage: "this is cool, reckon you'll like this one\nhttps://www.youtube.com/shorts/example",
    source: 'learning-reels-test',
    graphMessageIds: ['ig_mid_1'],
    messageIds: ['ig_messages_row_1'],
});

const history = normalizeLearningReelHistory({ custom_data: customData });
assert.strictEqual(history.length, 1);
assert.strictEqual(history[0].topic_label, 'Mindset');
assert.strictEqual(history[0].title, 'How emotions are made');
assert.strictEqual(history[0].description, 'Lisa Feldman Barrett explains how the brain constructs emotion from prediction and body signals.');
assert.strictEqual(history[0].channel_title, 'Lisa Feldman Barrett');
assert.strictEqual(history[0].sent_at, sentAt);
assert.strictEqual(history[0].video_id, 'DXDp7tqpcdU');
assert.deepStrictEqual(history[0].graph_message_ids, ['ig_mid_1']);

const block = buildLearningReelContextBlock({ custom_data: customData });
assert.ok(block.includes('RECENT LEARNING REELS SHANNON SENT'));
assert.ok(block.includes('Mindset'));
assert.ok(block.includes('How emotions are made'));
assert.ok(block.includes('brain constructs emotion'));
assert.ok(block.includes('Lisa Feldman Barrett'));
assert.ok(block.includes("this is cool, reckon you'll like this one"));

const duplicateReels = findDuplicateLearningReels({ custom_data: customData }, [{
    title: 'Different title from another share page',
    url: 'https://youtu.be/DXDp7tqpcdU',
}]);
assert.strictEqual(duplicateReels.length, 1);
assert.strictEqual(duplicateReels[0].previous.title, 'How emotions are made');

const uniqueReels = findDuplicateLearningReels({ custom_data: customData }, [{
    title: 'A new Huberman clip',
    url: 'https://www.youtube.com/shorts/7gBJbEDwccw',
}]);
assert.strictEqual(uniqueReels.length, 0);

const contextReviewWithReel = buildContextReviewInfo({
    channel: 'instagram',
    ig_thread_id: 'thread-1',
    message_preview: 'what was that reel about?',
    inbound_message_batch: [{ text: 'what was that reel about?', is_current: true }],
    learning_reels: customData.learning_reels,
});
assert.strictEqual(contextReviewWithReel.required, false);
assert.strictEqual(contextReviewWithReel.tracked_outbound_context, true);

const contextReviewMissingReel = buildContextReviewInfo({
    channel: 'instagram',
    ig_thread_id: 'thread-1',
    message_preview: 'what was that reel about?',
    inbound_message_batch: [{ text: 'what was that reel about?', is_current: true }],
});
assert.strictEqual(contextReviewMissingReel.required, true);

const routedWithoutReel = managerTest.classifyNeedsYou({
    data: {
        channel: 'instagram',
        ig_thread_id: 'thread-1',
        message_preview: 'what was that reel about?',
        inbound_message_batch: [{ text: 'what was that reel about?', is_current: true }],
    },
});
assert.strictEqual(routedWithoutReel.shouldRoute, true);
assert.ok(routedWithoutReel.reasons.includes('missing_learning_reel_context'));

const routedWithReel = managerTest.classifyNeedsYou({
    data: {
        channel: 'instagram',
        ig_thread_id: 'thread-1',
        message_preview: 'what was that reel about?',
        inbound_message_batch: [{ text: 'what was that reel about?', is_current: true }],
        learning_reels: customData.learning_reels,
    },
});
assert.strictEqual(routedWithReel.shouldRoute, false);

console.log('learning reel context tests passed');
