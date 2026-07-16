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
        '20260716003146_repair_ig_browser_shift_throughput.sql'
    ),
    'utf8'
);

test('the ledger accepts the broad Story-tray lane', () => {
    assert.match(migration, /'story_tray_discovery'/);
    assert.match(migration, /DROP CONSTRAINT IF EXISTS ig_browser_shift_runs_lane_check/i);
    assert.match(migration, /ADD CONSTRAINT ig_browser_shift_runs_lane_check/i);
});

test('each segment receives action counts from its own base shift only', () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS base_run_id/i);
    assert.match(migration, /WHERE base_run_id = v_base_run_id/i);
    assert.match(migration, /jsonb_build_object\('verified_native_actions', v_verified_native_actions\)/i);
    assert.match(migration, /'shift_state'/i);
    assert.match(migration, /handoff_is_same_base_shift/i);
});

test('a verified Story reply remains terminal after its cooldown timestamp', () => {
    assert.match(
        migration,
        /action_type = 'story_reply'[\s\S]+v_status IN \('completed', 'cooldown'\)/i
    );
    assert.doesNotMatch(
        migration,
        /action_type = 'story_reply'[\s\S]{0,160}v_status := 'cooldown'/i
    );
    assert.match(
        migration,
        /UPDATE public\.ig_next_actions[\s\S]+SET status = 'completed'[\s\S]+native_receipt_verified/i
    );
});

test('repaired RPCs remain service-role only with fixed search paths', () => {
    assert.match(migration, /SET search_path = public, pg_temp/i);
    assert.match(
        migration,
        /REVOKE ALL ON FUNCTION public\.start_ig_browser_shift[\s\S]+FROM PUBLIC, anon, authenticated/i
    );
    assert.match(
        migration,
        /GRANT EXECUTE ON FUNCTION public\.complete_ig_next_action[\s\S]+TO service_role/i
    );
});
