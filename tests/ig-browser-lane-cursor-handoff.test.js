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
        '20260716005539_fix_ig_browser_lane_cursor_handoffs.sql'
    ),
    'utf8'
);

test('cross-lane next_resume pointers cannot become a lane cursor', () => {
    assert.match(
        migration,
        /v_handoff\.status IN \('partial', 'blocked', 'interrupted'\)[\s\S]+v_handoff\.next_resume ->> 'lane'[\s\S]+p_lane/i
    );
    assert.match(migration, /v_handoff\.cursor_end ->> 'lane' = p_lane/i);
    assert.match(migration, /v_handoff\.cursor_current ->> 'lane' = p_lane/i);
});

test('inherited lane cursors cannot carry an old shift action budget', () => {
    assert.match(migration, /- 'verified_native_actions'/i);
    assert.match(migration, /- 'interaction_budget_remaining'/i);
    assert.match(migration, /- 'canonical_ids'/i);
    assert.match(
        migration,
        /jsonb_build_object\('verified_native_actions', v_verified_native_actions\)/i
    );
});

test('a just-started mismatched segment is repaired without overwriting progress', () => {
    assert.match(migration, /running\.heartbeat_at = running\.started_at/i);
    assert.match(migration, /running\.canonical_ids = '\[\]'::JSONB/i);
    assert.match(migration, /cross_lane_cursor_repaired/i);
});

test('the repaired start RPC remains server-only', () => {
    assert.match(migration, /SECURITY INVOKER/i);
    assert.match(migration, /SET search_path = public, pg_temp/i);
    assert.match(
        migration,
        /REVOKE ALL ON FUNCTION public\.start_ig_browser_shift[\s\S]+FROM PUBLIC, anon, authenticated/i
    );
    assert.match(
        migration,
        /GRANT EXECUTE ON FUNCTION public\.start_ig_browser_shift[\s\S]+TO service_role/i
    );
});
