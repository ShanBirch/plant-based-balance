import assert from 'node:assert';

const { _test } = await import('../netlify/functions/learning-reel-drip.mjs');

const nowMs = Date.parse('2026-06-02T02:00:00.000Z');
const plan = _test.buildInitialPlan(nowMs);
assert.strictEqual(plan.length, 168);
assert.strictEqual(plan[0].topic_id, 'plant_based_cooking');
assert.strictEqual(plan[1].topic_id, 'protein_science');
assert.strictEqual(plan[3].topic_id, 'workout_motivation');
assert.strictEqual(plan[14].topic_id, 'plant_based_cooking');
assert.strictEqual(Date.parse(plan[1].due_at) - Date.parse(plan[0].due_at), 60 * 60 * 1000);

const state = _test.normalizeDripState({ custom_data: {} }, nowMs);
assert.strictEqual(state.id, 'shan_n_sunny_cocos_learning_drip_2026_06');
assert.strictEqual(state.revision, 'hourly_168_v2');
assert.strictEqual(state.status, 'active');
assert.strictEqual(state.total_sends, 168);
assert.strictEqual(state.plan.length, 168);

const upgraded = _test.normalizeDripState({
    custom_data: {
        learning_reel_drip: {
            id: state.id,
            status: 'active',
            interval_ms: 12 * 60 * 60 * 1000,
            plan: plan.slice(0, 14),
            sent: [{ video_id: 'already-sent' }],
        },
    },
}, nowMs);
assert.strictEqual(upgraded.revision, 'hourly_168_v2');
assert.strictEqual(upgraded.previous_plan_count, 14);
assert.strictEqual(upgraded.plan.length, 168);
assert.strictEqual(upgraded.sent[0].video_id, 'already-sent');

const due = _test.nextDuePlanItem(state, nowMs);
assert.strictEqual(due.topic_id, 'plant_based_cooking');

const nextState = _test.updatePlanItem(state, due.index, {
    status: 'sent',
    sent_at: new Date(nowMs).toISOString(),
    video_id: 'video-one',
});
assert.strictEqual(nextState.plan[0].status, 'sent');
assert.strictEqual(nextState.status, 'active');
assert.strictEqual(nextState.next_send_at, state.plan[1].due_at);

assert.strictEqual(_test.shouldHoldPausedState({
    status: 'paused',
    next_send_at: new Date(nowMs + 60 * 60 * 1000).toISOString(),
}, nowMs), true);
assert.strictEqual(_test.shouldHoldPausedState({
    status: 'paused',
    next_send_at: new Date(nowMs - 60 * 1000).toISOString(),
}, nowMs), false);

const customData = _test.applyCocosThreadCustomData({}, {
    recipientId: 'recipient_1',
    accountId: 'account_1',
}, state);
assert.strictEqual(customData.bot_account, 'cocos_pt_studio');
assert.strictEqual(customData.algorithm_fork, 'cocos_acquisition_v1');
assert.strictEqual(customData.instagram_graph.bot_account, 'cocos_pt_studio');
assert.strictEqual(customData.instagram_graph.ig_graph_user_id, 'recipient_1');

const graph = _test.resolveThreadGraph({
    subscriber_id: 'ig_graph:account_1:recipient_1',
    custom_data: {},
});
assert.deepStrictEqual(graph, { accountId: 'account_1', recipientId: 'recipient_1' });

const candidate = _test.candidateFromResult({
    id: { videoId: 'abc123xyz' },
    snippet: {
        title: 'Fallback title',
        channelTitle: 'Fallback channel',
        channelId: 'fallback_channel',
        description: 'fallback description',
    },
}, {
    id: 'abc123xyz',
    snippet: {
        title: 'Protein explained #shorts',
        channelTitle: 'Jeff Nippard',
        channelId: 'UC68TLK0mAEzUyHx5x5k-S1Q',
        description: 'A useful explanation of protein intake and muscle growth.',
        publishedAt: '2026-05-01T00:00:00Z',
        thumbnails: { high: { url: 'https://img.youtube.com/high.jpg' } },
    },
    contentDetails: { duration: 'PT45S' },
    statistics: { viewCount: '120000' },
}, 'protein_science', 'Jeff Nippard protein intake');

assert.strictEqual(candidate.title, 'Protein explained #shorts');
assert.strictEqual(candidate.channel_title, 'Jeff Nippard');
assert.strictEqual(candidate.description, 'A useful explanation of protein intake and muscle growth.');
assert.strictEqual(candidate.duration_seconds, 45);
assert.strictEqual(candidate.view_count, 120000);
assert.strictEqual(candidate.thumbnail_url, 'https://img.youtube.com/high.jpg');

const proteinMessage = _test.buildVisibleMessage(candidate, 0);
assert.ok(proteinMessage.includes('https://www.youtube.com/shorts/abc123xyz'));
assert.match(proteinMessage, /protein|nutrition/);
assert.ok(!proteinMessage.includes("this is cool, reckon you'll like this one"));

const cookingMessage = _test.buildVisibleMessage({
    topic_id: 'plant_based_cooking',
    topic_label: 'Plant-based cooking',
    title: 'The BEST cucumber salad',
    url: 'https://www.youtube.com/shorts/xMdz4-AiYA4',
    video_id: 'xMdz4-AiYA4',
}, 0);
assert.match(cookingMessage, /cucumber salad|make me this|looks yum|eat this|dinner/);
assert.ok(cookingMessage.includes('https://www.youtube.com/shorts/xMdz4-AiYA4'));
assert.ok(!cookingMessage.includes("this is cool, reckon you'll like this one"));

console.log('learning reel drip tests passed');
