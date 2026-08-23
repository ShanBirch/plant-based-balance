const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'supabase',
        'migrations',
        '20260715224011_ig_browser_shift_handoff.sql'
    ),
    'utf8'
);
const operatingBrief = fs.readFileSync(path.join(__dirname, '..', 'CODEX.md'), 'utf8');

test('browser shifts have one durable global running lease', () => {
    assert.match(migration, /CREATE TABLE public\.ig_browser_shift_runs/i);
    assert.match(
        migration,
        /CREATE UNIQUE INDEX ig_browser_shift_runs_one_running_idx[\s\S]+WHERE status = 'running'/i
    );
    assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('ig_browser_shift_dispatcher'/i);
    assert.match(migration, /lease_expired_before_finalization/i);
    assert.match(migration, /'acquired', FALSE[\s\S]+'active_shift_lease'/i);
});

test('a new shift receives the latest handoff for its own lane', () => {
    assert.match(
        migration,
        /FROM public\.ig_browser_shift_runs[\s\S]+WHERE lane = p_lane[\s\S]+ORDER BY started_at DESC/i
    );
    assert.match(
        migration,
        /v_handoff\.next_resume[\s\S]+v_handoff\.cursor_end[\s\S]+v_handoff\.cursor_current/i
    );
    assert.match(migration, /'handoff', CASE WHEN v_handoff\.id IS NULL/i);
});

test('checkpoint and finalization receipts retain resume-critical evidence', () => {
    for (const field of [
        'cursor_current',
        'counts',
        'last_surface',
        'canonical_ids',
        'uncertain_actions',
        'block_evidence',
        'next_resume',
    ]) {
        assert.match(migration, new RegExp(field, 'i'));
    }
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.heartbeat_ig_browser_shift/i);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.finish_ig_browser_shift/i);
});

test('the shift ledger and RPCs are server-only', () => {
    assert.match(migration, /ALTER TABLE public\.ig_browser_shift_runs ENABLE ROW LEVEL SECURITY/i);
    assert.match(
        migration,
        /REVOKE ALL ON TABLE public\.ig_browser_shift_runs FROM PUBLIC, anon, authenticated/i
    );
    assert.match(
        migration,
        /GRANT EXECUTE ON FUNCTION public\.start_ig_browser_shift[\s\S]+TO service_role/i
    );
    assert.doesNotMatch(migration, /GRANT EXECUTE[\s\S]+TO authenticated/i);
    assert.doesNotMatch(migration, /SECURITY DEFINER/i);
});

test('the dispatcher runs one persistent lane under the live watchdog contract', () => {
    assert.match(operatingBrief, /watchdog wakes every 10 minutes/i);
    assert.match(operatingBrief, /Each owned shift works one persistent lane task/i);
    assert.match(operatingBrief, /for at most one 30-minute shift/i);
    assert.match(operatingBrief, /reserves five minutes for reconciliation/i);
    assert.match(operatingBrief, /up to 30 verified native Instagram interactions/i);
    assert.match(operatingBrief, /Thirty is a hard ceiling/i);
    assert.match(operatingBrief, /phone approval close condition remains 60 minutes/i);
    assert.match(operatingBrief, /does not change that hourly notification cadence/i);
    assert.match(operatingBrief, /start_ig_browser_shift\(\.\.\., 900\)/i);
    assert.match(operatingBrief, /lease_seconds=900/i);
    assert.doesNotMatch(operatingBrief, /rolls forward through later lanes when one finishes early/i);
});

test('recent discovery follows defer welcomes instead of losing them', () => {
    assert.match(operatingBrief, /claim due deferred welcomes first/i);
    assert.match(operatingBrief, /safe_after=touch\+24 hours/i);
    assert.match(operatingBrief, /not permanently cancelled/i);
});

test('genuine replies create delayed reciprocal cross-surface nurture', () => {
    assert.match(operatingBrief, /reply to Shannon's comment[\s\S]+Story check after at least 24 hours/i);
    assert.match(operatingBrief, /reply to Shannon's Story message[\s\S]+feed check/i);
    assert.match(operatingBrief, /p_supersede=false/i);
    assert.match(operatingBrief, /cross_surface_nurture/i);
    assert.match(operatingBrief, /one reciprocal cross-surface touch per person per rolling seven days/i);
});

test('Story and discovery targets match the weighted single-lane runtime', () => {
    assert.match(operatingBrief, /Story lanes normally target five canonical replies/i);
    assert.match(operatingBrief, /discovery-follow slots target three verified follows/i);
    assert.match(operatingBrief, /ranked, follower, inbound, and client lanes are inventory-bound/i);
    assert.match(operatingBrief, /Boundary-driven lanes clear only their eligible live boundary/i);
});

test('queue lifecycle is not confused with Instagram delivery truth', () => {
    assert.match(operatingBrief, /Queue lifecycle and Instagram delivery truth are separate/i);
    assert.match(operatingBrief, /receipt\.delivery_outcome/i);
    assert.match(operatingBrief, /cancelled queue row or replaced action version may still represent a verified native send/i);
    assert.match(operatingBrief, /Reconciliation operates only on exact unresolved or invariant-broken receipts/i);
});

test('dispatcher health measures coverage and downstream progression', () => {
    assert.match(operatingBrief, /owned shift starts, not watchdog invocations/i);
    assert.match(operatingBrief, /unexplained gap above 45 minutes/i);
    assert.match(operatingBrief, /problem_qualified/i);
    assert.match(operatingBrief, /offer_ready/i);
    assert.match(operatingBrief, /buyer_intent/i);
});

test('daily revenue review measures movement and instrumentation quality', () => {
    assert.match(operatingBrief, /Balance Daily Lead Movement Brief/i);
    assert.match(operatingBrief, /completed Brisbane days/i);
    assert.match(operatingBrief, /stalled revenue opportunities/i);
    assert.match(operatingBrief, /acquisition source/i);
    assert.match(operatingBrief, /incomplete tracking as a true zero/i);
});

test('the API DM manager has its own short ten-minute operating cycle', () => {
    assert.match(operatingBrief, /API-based `Balance Lead \+ Client DM Manager` is a separate 24-hour worker/i);
    assert.match(operatingBrief, /wakes every 10 minutes/i);
    assert.match(operatingBrief, /stops claiming new work after minute seven/i);
    assert.match(operatingBrief, /releases its own lock by minute nine/i);
    assert.match(operatingBrief, /15-minute crash-recovery lease/i);
    assert.match(operatingBrief, /never shared with the browser dispatcher/i);
    assert.doesNotMatch(operatingBrief, /API-based[\s\S]{0,500}90-minute/i);
});
