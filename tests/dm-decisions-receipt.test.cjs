const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('completion preserves exact review provenance without modifying delivery or ABC', async t => {
    const db = new PGlite(); t.after(() => db.close());
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
        CREATE TABLE ig_next_actions(id int PRIMARY KEY,thread_id uuid,source_message_id uuid,
        owner text,status text,reason jsonb,receipt jsonb);
        CREATE TABLE fixture_archive(receipt jsonb);
        CREATE FUNCTION fixture_archive_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN INSERT INTO fixture_archive VALUES(OLD.receipt); RETURN NEW; END $$;
        CREATE TRIGGER archive_fixture BEFORE UPDATE OF reason ON ig_next_actions
        FOR EACH ROW EXECUTE FUNCTION fixture_archive_receipt();`);
    await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261029005359_preserve_dm_decisions_reviews.sql'),'utf8'));
    const thread = '10000000-0000-4000-8000-000000000001';
    const source = '20000000-0000-4000-8000-000000000001';
    const review = { version: 'dm_decisions_review_20261029_v1', threadId: thread,
        sourceMessageId: source, sendAuthorized: false, status: 'passed', reviewId: 'synthetic-review' };
    const reason = { decisions_review: review, conversation_policy_version: 'abc-unchanged' };
    const receipt = { native_verified: true, canonical_outbound_message_id: 'synthetic-outbound', no_repeat: true };
    await db.query("INSERT INTO ig_next_actions VALUES(1,$1,$2,'dm_manager','claimed',$3,$4)",[thread,source,reason,receipt]);
    assert.equal((await db.query('SELECT receipt FROM ig_next_actions')).rows[0].receipt.decisions_review,undefined);
    await db.exec("UPDATE ig_next_actions SET status='completed'");
    const saved = (await db.query('SELECT * FROM ig_next_actions')).rows[0];
    assert.deepEqual(saved.receipt.decisions_review,review);
    assert.equal(saved.receipt.canonical_outbound_message_id,'synthetic-outbound');
    assert.equal(saved.receipt.native_verified,true);
    assert.equal(saved.status,'completed');
    assert.equal(saved.receipt.conversation_policy_version,'abc-unchanged');
    await db.exec("UPDATE ig_next_actions SET reason='{}'");
    assert.equal((await db.query('SELECT receipt FROM fixture_archive')).rows[0].receipt.decisions_review.reviewId,'synthetic-review');
    for (const patch of [{ sourceMessageId: thread },{ threadId: source },{ sendAuthorized: true },{ version: 'unknown' }]) {
        await db.query("INSERT INTO ig_next_actions VALUES(2,$1,$2,'dm_manager','completed',$3,$4)",[thread,source,{ decisions_review: { ...review,...patch } },receipt]);
        assert.equal((await db.query('SELECT receipt FROM ig_next_actions WHERE id=2')).rows[0].receipt.decisions_review,undefined);
        await db.exec('DELETE FROM ig_next_actions WHERE id=2');
    }
    assert.equal((await db.query("SELECT has_function_privilege('anon','capture_dm_decisions_review_receipt()','execute') allowed")).rows[0].allowed,false);
});
