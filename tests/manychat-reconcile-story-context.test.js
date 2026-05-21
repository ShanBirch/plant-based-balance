const assert = require('assert');

const {
    _test,
} = require('../netlify/functions/manychat-reconcile');

const storyContext = [
    '[IG_STORY_REPLY_CONTEXT]',
    'Story caption: Still stoked on this 200kg grind',
    'Story summary: User is celebrating a 200kg squat achievement.',
    'Their reply: "Brooooooooooooo🤐🤐"',
    'Story media, if present, belongs to Shannon\'s story reference. It is not a separate photo or video from the lead, and the reply should not ask them to resend it.',
].join('\n');

assert.strictEqual(
    _test.normalizeComparableText(storyContext),
    _test.normalizeComparableText('Brooooooooooooo🤐🤐')
);

const current = new Date('2026-05-21T08:11:17.949Z');
const decision = _test.shouldBackfill({
    thread: { last_inbound_at: current.toISOString() },
    subscriber: { last_input_text: 'Brooooooooooooo🤐🤐' },
    latestInbound: {
        text: storyContext,
        created_at: current.toISOString(),
    },
    syntheticId: 'manychat_reconcile:instagram:1660205001:missing-last-interaction:b74ed97a46395b5f',
});

assert.strictEqual(decision.ok, false);
assert.strictEqual(decision.reason, 'latest_inbound_matches');

console.log('manychat reconcile story context tests passed');
