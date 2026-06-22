const assert = require('assert');

const snapshot = require('../netlify/functions/content-performance-snapshot')._test;

assert.strictEqual(
    snapshot.scoreMetrics({ likes: 1, outcomeScore: 12 }),
    13,
    'outcome score should lift the content performance score'
);

assert.strictEqual(
    snapshot.scoreMetrics({ likes: 1, outcomeScore: -30 }),
    -29,
    'negative revenue outcomes should be able to reduce the score'
);

const row = snapshot.standardRow({
    id: 'post-1',
    platform: 'instagram',
    title: 'Reel',
    metrics: {
        likes: 2,
        comments: 1,
        outcomeScore: '24',
        salesEvents: 2,
        revenueEvents: 1,
        freeInfoClaims: 3,
        subscriptions: 1,
    },
});

assert.strictEqual(row.metrics.outcomeScore, 24);
assert.strictEqual(row.metrics.salesEvents, 2);
assert.strictEqual(row.metrics.revenueEvents, 1);
assert.strictEqual(row.metrics.freeInfoClaims, 3);
assert.strictEqual(row.metrics.subscriptions, 1);
assert.ok(row.score > 24, 'score should include both engagement and outcome signals');

console.log('content performance snapshot tests passed');
