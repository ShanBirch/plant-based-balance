const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('delivery learning uses exact, proven, deduplicated receipts without changing sends or ABC', async t => {
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
        CREATE TABLE ig_messages(id uuid,thread_id uuid,direction text,created_at timestamptz);
        CREATE TABLE ig_threads(id uuid,ig_username text);
        CREATE TABLE ig_browser_shift_runs(run_id text);
        CREATE TABLE ig_next_actions(id uuid,action_version int,thread_id uuid,ig_username text,
            owner text,action_type text,status text,receipt jsonb);
        CREATE TABLE ig_next_action_receipts(action_id uuid,action_version int,thread_id uuid,
            ig_username text,owner text,action_type text,terminal_status text,receipt jsonb);
        INSERT INTO ig_browser_shift_runs VALUES ('fixture-run');`);
    await db.exec(fs.readFileSync(path.join(__dirname,
        '../supabase/migrations/20261029001529_dm_delivery_attribution.sql'), 'utf8'));
    const thread = '10000000-0000-4000-8000-000000000001';
    const message = '20000000-0000-4000-8000-000000000001';
    const source = '30000000-0000-4000-8000-000000000001';
    const action = '40000000-0000-4000-8000-000000000001';
    const other = '50000000-0000-4000-8000-000000000001';
    const start = '2026-10-27T14:00:00Z', end = '2026-10-28T14:00:00Z';
    const base = () => ({ canonical_outbound_message_id: message, source_message_id: source,
        native_verified: true, claim_run_id: 'fixture-run', no_repeat: true });
    async function reset(receipt = base(), options = {}) {
        await db.exec('TRUNCATE ig_messages,ig_threads,ig_next_actions,ig_next_action_receipts');
        await db.query('INSERT INTO ig_threads VALUES($1,$2)', [thread, 'fixture']);
        await db.query("INSERT INTO ig_messages VALUES($1,$2,'in',$3),($4,$2,'out',$5)",
            [source, thread, '2026-10-28T01:00:00Z', message, '2026-10-28T01:01:00Z']);
        await db.query('INSERT INTO ig_next_actions VALUES($1,1,$2,$3,$4,$5,$6,$7)',
            [action, options.nullThread ? null : thread, options.username || 'fixture',
                options.owner || 'dm_manager', options.type || 'reply_inbound',
                options.status || 'completed', receipt]);
    }
    async function attribution() {
        return (await db.query('SELECT * FROM balance_dm_delivery_attribution($1,$2)', [start,end])).rows;
    }
    for (const key of ['canonical_outbound_message_id','canonical_outbound_id','canonical_message_id','outbound_message_id']) {
        await t.test(`reads historical ${key}`, async () => {
            const r = base(); delete r.canonical_outbound_message_id; r[key] = message;
            await reset(r);
            assert.equal((await attribution())[0].attribution, 'verified_automation');
        });
    }
    await t.test('matches Story canonical thread while preserving its lane', async () => {
        await reset({ ...base(), canonical_thread_id: thread },
            { nullThread: true, owner: 'story_operator', type: 'story_reply' });
        assert.equal((await attribution())[0].operator_lane, 'story_operator');
        await reset({ ...base(), canonical_thread_id: thread }, { nullThread: true, username: 'wrong' });
        assert.equal((await attribution())[0].attribution, 'unknown');
    });
    await t.test('reads archived versions and deduplicates their current copy', async () => {
        await reset();
        await db.exec('INSERT INTO ig_next_action_receipts SELECT * FROM ig_next_actions');
        assert.equal((await attribution()).length, 1);
        await db.exec('DELETE FROM ig_next_actions');
        assert.equal((await attribution())[0].attribution, 'verified_automation');
    });
    for (const [name, patch] of Object.entries({
        'wrong thread': { canonical_thread_id: other },
        'wrong source': { source_message_id: other },
        'unverified': { native_verified: false },
        'uncertain': { result: 'uncertain' },
        'reconciliation required': { reconciliation_required: true },
        'unknown run': { claim_run_id: 'missing' },
        'conflicting aliases': { outbound_message_id: other },
        'malformed ID': { canonical_outbound_message_id: 'not-a-uuid' }
    })) {
        await t.test(`rejects ${name}`, async () => {
            await reset({ ...base(), ...patch });
            assert.equal((await attribution())[0].attribution, 'unknown');
        });
    }
    await t.test('native-visible proof needs clear composer', async () => {
        await reset({ ...base(), native_verified: false, native_visible: true });
        assert.equal((await attribution())[0].attribution, 'unknown');
        await reset({ ...base(), native_verified: false, native_visible: true, composer_empty: true });
        assert.equal((await attribution())[0].attribution, 'verified_automation');
    });
    await t.test('distinct actions claiming the same outbound stay ambiguous', async () => {
        await reset();
        await db.query('INSERT INTO ig_next_actions SELECT $1,action_version,thread_id,ig_username,owner,action_type,status,receipt FROM ig_next_actions', [other]);
        assert.equal((await attribution())[0].attribution, 'unknown');
    });
    await t.test('noncompleted and human actions do not prove automation', async () => {
        await reset(base(), { status: 'waiting' });
        assert.equal((await attribution())[0].attribution, 'unknown');
        await reset(base(), { owner: 'manual' });
        assert.equal((await attribution())[0].attribution, 'unknown');
    });
    await t.test('exclusive date boundaries, repeatability and service-only access', async () => {
        await reset();
        await db.query("INSERT INTO ig_messages VALUES($1,$2,'out',$3)", [other,thread,end]);
        const first = await attribution();
        assert.deepEqual(await attribution(), first);
        assert.equal(first.length, 1);
        assert.equal((await db.query('SELECT count(*)::int n FROM ig_messages')).rows[0].n, 3);
        assert.equal((await db.query("SELECT has_function_privilege('anon','balance_dm_delivery_attribution(timestamptz,timestamptz)','execute') allowed")).rows[0].allowed, false);
        await assert.rejects(db.query('SELECT * FROM balance_dm_delivery_attribution($1,$2)', [end,start]), /ordered activity window/);
    });
});
