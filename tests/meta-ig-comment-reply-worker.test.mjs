import assert from 'node:assert';

process.env.META_IG_COMMENT_REPLY_TARGET_HANDLES = 'shan_n_sunny';
process.env.META_IG_COMMENT_REPLY_DELAY_MS = '240000';
process.env.META_IG_COMMENT_REPLY_MAX_AGE_HOURS = '6';

const { _test } = await import('../netlify/functions/meta-ig-comment-reply-worker.mjs');

assert.strictEqual(_test.normalizeHandle('@Shan_N_Sunny'), 'shan_n_sunny');

assert.strictEqual(
    _test.buildGraphCommentReplyPath('18000000000000000', 'public'),
    '18000000000000000/replies'
);
assert.strictEqual(
    _test.buildGraphCommentReplyPath('18000000000000000', 'private'),
    '18000000000000000/private_replies'
);
assert.strictEqual(_test.replySourceForMode('public'), 'instagram_comment_public_reply');
assert.strictEqual(_test.replySourceForMode('private'), 'instagram_comment_private_reply');

const baseInteraction = {
    received_at: '2026-06-22T10:00:00.000Z',
    raw_payload: {
        latest_comment: {
            timestamp: '2026-06-22T10:00:00.000Z',
            text: 'Love this perspective',
            username: 'plant_lead',
        },
    },
};

assert.deepStrictEqual(
    _test.commentIsDue(baseInteraction, Date.parse('2026-06-22T10:03:59.000Z'), 240000, 6 * 60 * 60 * 1000).due,
    false
);
assert.strictEqual(
    _test.commentIsDue(baseInteraction, Date.parse('2026-06-22T10:04:00.000Z'), 240000, 6 * 60 * 60 * 1000).due,
    true
);
assert.strictEqual(
    _test.commentIsDue(baseInteraction, Date.parse('2026-06-22T17:00:00.000Z'), 240000, 6 * 60 * 60 * 1000).stale,
    true
);
assert.strictEqual(_test.shouldPollNow(Date.parse('2026-06-22T10:05:00.000Z'), 5 * 60 * 1000), true);
assert.strictEqual(_test.shouldPollNow(Date.parse('2026-06-22T10:06:00.000Z'), 5 * 60 * 1000), false);

const content = {
    raw_payload: {
        latest_media: {
            username: 'shan_n_sunny',
        },
    },
};
assert.strictEqual(_test.contentMatchesTarget(content, {}, new Set(['shan_n_sunny'])), true);
assert.strictEqual(_test.contentMatchesTarget(content, {}, new Set(['goldcoast_ai_solutions'])), false);

assert.strictEqual(
    _test.shouldSkipComment({
        interaction: {
            text: 'Love this perspective',
            from_username: 'plant_lead',
            raw_payload: {},
        },
        content,
        accountConfig: { botAccount: 'shan_n_sunny' },
        handles: new Set(['shan_n_sunny']),
    }).skip,
    false
);
assert.strictEqual(
    _test.shouldSkipComment({
        interaction: { text: 'Great post', from_username: 'shan_n_sunny', raw_payload: {} },
        content,
        accountConfig: { botAccount: 'shan_n_sunny' },
        handles: new Set(['shan_n_sunny']),
    }).reason,
    'own_comment'
);
assert.strictEqual(
    _test.shouldSkipComment({
        interaction: { text: '!!!', from_username: 'plant_lead', raw_payload: {} },
        content,
        accountConfig: { botAccount: 'shan_n_sunny' },
        handles: new Set(['shan_n_sunny']),
    }).reason,
    'emoji_or_punctuation_only'
);
assert.strictEqual(_test.looksLikeSpam('Promote it on @growth_one @growth_two'), true);

const parsed = _test.parseReplyDecision('{"action":"reply","reply":"Appreciate that, that was exactly the point of the post.","reason":"positive"}');
assert.deepStrictEqual(parsed, {
    action: 'reply',
    reply: 'Appreciate that, that was exactly the point of the post.',
    reason: 'positive',
});
assert.strictEqual(_test.parseReplyDecision('{"action":"skip","reason":"spam"}').action, 'skip');
assert.strictEqual(
    _test.sanitizePublicReply('Reply: "@plant_lead Appreciate that - here is a link https://example.com #fitness"'),
    'Appreciate that - here is a link'
);
assert.strictEqual(_test.sanitizePublicReply("DM'd you \u263a\ufe0f"), 'got you');
assert.strictEqual(_test.sanitizePublicReply('check your DMs, sent it you'), 'got you');

assert.strictEqual(_test.shouldRetryState({ status: 'sent' }, Date.now()), false);
assert.strictEqual(_test.shouldRetryState({ status: 'failed', attempts: 3 }, Date.now()), false);
assert.strictEqual(_test.shouldRetryState({ status: 'failed', attempts: 1, last_attempt_at: '2026-06-22T10:00:00.000Z' }, Date.parse('2026-06-22T10:11:00.000Z')), true);
assert.strictEqual(_test.shouldRetryState({ status: 'sending', updated_at: '2026-06-22T10:00:00.000Z' }, Date.parse('2026-06-22T10:05:00.000Z')), false);

const prompt = _test.buildCommentReplyPrompt({
    interaction: { text: 'I love this', from_username: 'plant_lead', raw_payload: {} },
    content: { content_type: 'reel', analysis_reply_context: 'A post about honesty in fitness information.' },
    accountHandle: 'shan_n_sunny',
});
assert.match(prompt, /public Instagram comment reply/);
assert.match(prompt, /I love this/);

console.log('meta ig comment reply worker tests passed');
