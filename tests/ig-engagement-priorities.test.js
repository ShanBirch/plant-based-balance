const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
const { _test } = require('../netlify/functions/ig-engagement-priorities');

test('priority queue clamps bot requests to a safe batch size', () => {
    assert.equal(_test.clampLimit('99', 50, 20), 50);
    assert.equal(_test.clampLimit('0', 50, 20), 1);
    assert.equal(_test.clampLimit('', 50, 20), 20);
});

test('Story leases fit inside the half-hour browser handoff', () => {
    assert.equal(_test.STORY_CLAIM_LEASE_SECONDS, 25 * 60);
});

test('priority queue preserves the engagement state and opens the right profile', () => {
    const row = _test.mapPriorityRow({
        thread_id: 'thread-1',
        ig_username: '@plant.based.person',
        profile_name: 'Plant Based Person',
        relationship_kind: 'lead',
        engagement_temperature: 'hot',
        engagement_label: 'hot',
        priority_score: 120,
        unanswered_outbound_count: 1,
        story_outreach_eligible: true,
    });

    assert.equal(row.igUsername, 'plant.based.person');
    assert.equal(row.engagementLabel, 'hot');
    assert.equal(row.priorityScore, 120);
    assert.equal(row.profileUrl, 'https://www.instagram.com/plant.based.person/');
    assert.equal(row.storyOutreachEligible, true);
});

test('priority summary keeps clients and dead leads out of Story-ready counts', () => {
    const summary = _test.buildSummary([
        { engagementLabel: 'client', engagementTemperature: 'client', storyOutreachEligible: false },
        { engagementLabel: 'dead', engagementTemperature: 'dead', storyOutreachEligible: false },
        { engagementLabel: 'hot', engagementTemperature: 'hot', storyOutreachEligible: true },
        { engagementLabel: 'warm', engagementTemperature: 'warm', storyOutreachEligible: true },
    ]);

    assert.deepEqual(summary.labels, { client: 1, hot: 1, warm: 1, cold: 0, dead: 1 });
    assert.deepEqual(summary.storyReady, { hot: 1, warm: 1, cold: 0 });
});
