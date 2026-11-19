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
const { buildReelLearning } = require('../netlify/functions/_lib/meta-reel-learning');
const testReel = {
    platform_post_id: 'reel',
    posted_at: '2026-11-01T00:00:00Z',
    snapshot_at: '2026-11-04T00:00:00Z',
    insights: { views: 100, reach: 50, shares: 2, reels_skip_rate: 0, ig_reels_avg_watch_time: 500 },
};
const brief = buildReelLearning([
    { ...testReel, meta_collected_at: '2026-11-01T20:00:00Z', insights: { views: 50 } },
    { ...testReel, meta_collected_at: '2026-11-02T01:00:00Z' },
    { ...testReel, meta_collected_at: '2026-11-04T00:00:00Z', insights: { views: 20000 } },
    { ...testReel, meta_collected_at: '2026-11-08T03:00:00Z', insights: { views: 250, reach: 190 } },
]);
const comparison = brief.reels[0].windows;
assert.strictEqual(comparison['24h'].age_hours, 25);
assert.strictEqual(comparison['24h'].views, 100);
assert.strictEqual(comparison['24h'].shares_per_1000_reached, 40);
assert.strictEqual(comparison['24h'].saves, null);
assert.strictEqual(comparison['24h'].skip_rate, 0);
assert.strictEqual(comparison['24h'].average_watch_seconds, 0.5);
assert.strictEqual(comparison['7d'].views, 250);
assert.strictEqual(comparison['7d'].shares_per_1000_reached, null);
assert.deepStrictEqual(buildReelLearning([{ ...testReel, insights: {} }]).reels[0].windows, {});
