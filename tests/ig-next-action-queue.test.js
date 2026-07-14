const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const queue = require('../netlify/functions/_lib/ig-next-action-queue');
const priorities = require('../netlify/functions/ig-engagement-priorities')._test;

test('queue owner and limits are constrained before an operator can claim work', () => {
    assert.equal(queue.cleanOwner('story_operator'), 'story_operator');
    assert.throws(() => queue.cleanOwner('anything_goes'), /Invalid IG next-action owner/);
    assert.equal(queue._test.clampInteger('999', 20, 1, 100), 100);
    assert.equal(queue._test.clampInteger('bad', 20, 1, 100), 20);
});

test('story priority rows retain the claim token needed for a verified completion', () => {
    const rows = priorities.mapClaimedStoryRows([
        {
            id: 'action-1',
            thread_id: 'thread-1',
            action_type: 'story_reply',
            action_version: 4,
            claim_token: 'claim-token-1',
            claim_expires_at: '2026-07-14T12:00:00.000Z',
        },
    ], [{
        thread_id: 'thread-1',
        ig_username: 'plants.with.sarah',
        profile_name: 'Sarah',
        engagement_temperature: 'hot',
        engagement_label: 'hot',
        priority_score: 120,
        story_outreach_eligible: true,
    }]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].igUsername, 'plants.with.sarah');
    assert.deepEqual(rows[0].nextAction, {
        id: 'action-1',
        type: 'story_reply',
        version: 4,
        claimToken: 'claim-token-1',
        claimExpiresAt: '2026-07-14T12:00:00.000Z',
    });
});

test('migration keeps the queue server-only and uses an atomic claim lease', () => {
    const migration = fs.readFileSync(
        path.join(__dirname, '..', 'supabase', 'migrations', '20260714103000_ig_next_action_queue.sql'),
        'utf8'
    );
    assert.match(migration, /ALTER TABLE public\.ig_next_actions ENABLE ROW LEVEL SECURITY/i);
    assert.match(migration, /FOR UPDATE SKIP LOCKED/i);
    assert.match(migration, /story_reply[\s\S]{0,600}24 hours/i);
    assert.match(migration, /feed_engagement[\s\S]{0,900}7 days/i);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_ig_next_actions[\s\S]+TO service_role/i);
});
