const assert = require('assert');

const { _test } = require('../netlify/functions/content-growth-scan');

assert.strictEqual(_test.inferLane('Bench Press Form Cue #Shorts'), 'exercise');
assert.strictEqual(_test.inferLane('Today we look at a new health science paper'), 'science');
assert.strictEqual(_test.inferLane('Proof Pulse: small wins inside Balance'), 'proof');

const igMetrics = _test.instagramMetricsFromRaw({
    latest_counts: {
        like_count: 10,
        comments_count: 3,
    },
    latest_insights: {
        views: 1200,
        reach: 900,
        shares: 6,
        saved: 8,
        follows: 2,
        ig_reels_avg_watch_time: 4500,
        ig_reels_video_view_total_time: 90000,
    },
});

assert.strictEqual(igMetrics.views, 1200);
assert.strictEqual(igMetrics.reach, 900);
assert.strictEqual(igMetrics.likes, 10);
assert.strictEqual(igMetrics.comments, 3);
assert.strictEqual(igMetrics.shares, 6);
assert.strictEqual(igMetrics.saves, 8);
assert.strictEqual(igMetrics.follows_gained, 2);
assert.strictEqual(igMetrics.average_view_duration_seconds, 4.5);
assert.strictEqual(igMetrics.watch_time_minutes, 1.5);
assert.strictEqual(igMetrics.engagement_score, 88);

const rows = [
    { platform: 'youtube', content_lane: 'exercise', title: 'Bench', platform_post_id: 'a', views: 100, engagement_score: 20, shares: 2, saves: 0 },
    { platform: 'instagram', content_lane: 'proof', title: 'Proof', platform_post_id: 'b', views: 50, engagement_score: 4, shares: 0, saves: 0 },
];
const recommendations = _test.recommendationFromRows(rows);
assert.strictEqual(recommendations[0].type, 'remake_winner');
assert.strictEqual(recommendations[0].post_id, 'a');
assert.strictEqual(_test.rowScore(rows[0]) > _test.rowScore(rows[1]), true);

console.log('content-growth-scan tests passed');
