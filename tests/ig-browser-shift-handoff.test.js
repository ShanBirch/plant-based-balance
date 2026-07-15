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

test('an early-finished lane rolls forward without multiplying native actions', () => {
    assert.match(operatingBrief, /rolls forward through later lanes when one finishes early/i);
    assert.match(operatingBrief, /actively works for 22 minutes/i);
    assert.match(operatingBrief, /watchdog wakes every five minutes/i);
    assert.match(operatingBrief, /up to ten verified native Instagram interactions/i);
    assert.match(operatingBrief, /verified_native_actions/i);
    assert.match(operatingBrief, /no separate messages\/comments subcap/i);
    assert.match(operatingBrief, /watchdog replacing an abandoned worker inherits/i);
    assert.match(operatingBrief, /start_ig_browser_shift\(\.\.\., 600\)/i);
    assert.match(operatingBrief, /final segment running and heartbeating/i);
    assert.match(operatingBrief, /visits at most one full rotation/i);
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
