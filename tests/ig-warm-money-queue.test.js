const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260716090000_ig_warm_money_queue.sql'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

test('money queue only follows explicit commercial milestones', () => {
    assert.match(migration, /commercial_stage[\s\S]+checkout_followup[\s\S]+offer_followup[\s\S]+offer_ready/i);
    assert.match(migration, /outbound_at <= NOW\(\) - INTERVAL '24 hours'/i);
    assert.match(migration, /outbound_at >= NOW\(\) - INTERVAL '7 days'/i);
    assert.match(migration, /checkout_followup_sent[\s\S]+coaching_followup_sent/i);
    assert.doesNotMatch(migration, /just checking in/i);
});

test('money events are idempotent and server-written', () => {
    assert.match(migration, /ig-money:' \|\| p_thread_id::TEXT[\s\S]+p_event_type/i);
    assert.match(migration, /ON CONFLICT \(event_key\) DO UPDATE/i);
    assert.match(migration, /record_ig_money_event[\s\S]+TO service_role/i);
    assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.record_ig_money_event\([^;]+TO authenticated/i);
});

test('acquisition capacity protects revenue work', () => {
    assert.match(migration, /v_due >= 16 THEN 'paused'/i);
    assert.match(migration, /v_due >= 6 THEN 'half'/i);
    assert.match(migration, /WHEN 'half' THEN 0\.5/i);
    assert.match(migration, /reply_inbound' AND q\.priority >= 900/i);
});

test('admin metrics exposes the warm funnel and exact money queue', () => {
    assert.match(dashboard, /Warm Lead Money Queue/);
    assert.match(dashboard, /get_ig_warm_lead_scorecard/);
    assert.match(dashboard, /get_ig_money_queue/);
    assert.match(dashboard, /get_ig_acquisition_capacity/);
    assert.match(dashboard, /openIgLeadModal\('\$\{row\.thread_id\}'\)/);
});
