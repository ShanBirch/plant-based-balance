const assert = require('assert');

const {
    detectConversationEpisode,
    buildConversationEpisodeTimeline,
} = require('../netlify/functions/ig-instant-draft')._test;

const event = (direction, text, createdAt) => ({ direction, text, created_at: createdAt });

const longSilence = detectConversationEpisode({
    events: [
        event('out', 'how is training going?', '2026-07-10T00:00:00.000Z'),
        event('in', 'pretty good', '2026-07-10T00:10:00.000Z'),
        event('in', 'that recipe looks unreal', '2026-07-19T00:00:00.000Z'),
    ],
    now: '2026-07-19T00:00:00.000Z',
});
assert.strictEqual(longSilence.isNewEpisode, true);
assert.strictEqual(longSilence.reason, 'long_silence');
assert.deepStrictEqual(longSilence.currentEvents.map(item => item.text), ['that recipe looks unreal']);
assert.strictEqual(longSilence.relationshipEvents.length, 2);

const continuous = detectConversationEpisode({
    events: [
        event('out', 'how is training going?', '2026-07-19T00:00:00.000Z'),
        event('in', 'pretty good', '2026-07-19T02:00:00.000Z'),
    ],
    now: '2026-07-19T02:00:00.000Z',
});
assert.strictEqual(continuous.isNewEpisode, false);
assert.strictEqual(continuous.reason, 'continuous_thread');
assert.strictEqual(continuous.relationshipEvents.length, 0);

const shannonReopened = detectConversationEpisode({
    events: [
        event('in', 'thanks mate', '2026-07-17T00:00:00.000Z'),
        event('out', 'that hike looks unreal', '2026-07-18T00:00:00.000Z'),
        event('in', 'it was so good', '2026-07-18T00:20:00.000Z'),
    ],
    now: '2026-07-18T00:20:00.000Z',
});
assert.strictEqual(shannonReopened.reason, 'shannon_reopened_after_pause');
assert.deepStrictEqual(shannonReopened.currentEvents.map(item => item.text), [
    'that hike looks unreal',
    'it was so good',
]);

const storyEpisode = detectConversationEpisode({
    events: [
        event('in', 'old topic', '2026-07-19T00:00:00.000Z'),
        event('out', 'was that homemade?', '2026-07-19T00:05:00.000Z'),
        event('in', 'yeah it was', '2026-07-19T00:10:00.000Z'),
    ],
    storyOutreachSummary: {
        sent_comment: 'was that homemade?',
        sent: true,
        sent_at: '2026-07-19T00:05:00.000Z',
        context_reliable: true,
    },
    now: '2026-07-19T00:10:00.000Z',
});
assert.strictEqual(storyEpisode.reason, 'fresh_story_opener');
assert.deepStrictEqual(storyEpisode.currentEvents.map(item => item.text), [
    'was that homemade?',
    'yeah it was',
]);

const unsentStoryDoesNotReset = detectConversationEpisode({
    events: [
        event('in', 'old topic', '2026-07-19T00:00:00.000Z'),
        event('in', 'new line', '2026-07-19T00:10:00.000Z'),
    ],
    storyOutreachSummary: {
        sent_comment: 'draft only',
        send_status: 'draft_only',
        captured_at: '2026-07-19T00:05:00.000Z',
    },
    now: '2026-07-19T00:10:00.000Z',
});
assert.strictEqual(unsentStoryDoesNotReset.reason, 'continuous_thread');

const episodePrompt = buildConversationEpisodeTimeline({
    episode: storyEpisode,
    formatEvent: item => `${item.direction}: ${item.text}`,
});
assert.match(episodePrompt, /CURRENT CONVERSATION EPISODE/);
assert.match(episodePrompt, /OLDER RELATIONSHIP HISTORY/);
assert.match(episodePrompt, /Do not continue an old question sequence/);
assert.match(episodePrompt, /old sales momentum is not permission to pitch/);
assert.match(episodePrompt, /Never re-ask a known fact/);

console.log('ig conversation episode tests passed');
