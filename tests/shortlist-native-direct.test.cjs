// Runs only against an in-memory PostgreSQL instance; no network or real contacts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const migration = fs.readFileSync(path.join(__dirname,
 '../supabase/migrations/20261025023809_allow_shortlist_native_direct_checkins.sql'), 'utf8');

test('finite shortlist native Direct controls in offline PostgreSQL', async t => {
 const db = new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE ig_threads(id uuid PRIMARY KEY,ig_username text,channel text,custom_data jsonb);
 CREATE TABLE ig_messages(id uuid PRIMARY KEY,thread_id uuid,created_at timestamptz);
 CREATE TABLE ig_personal_contacts(ig_username text);
 CREATE TABLE ig_next_actions(id uuid PRIMARY KEY,thread_id uuid,source_message_id uuid,
 ig_username text,owner text,action_type text,reason jsonb,receipt jsonb DEFAULT '{}',
 action_version integer DEFAULT 1,status text DEFAULT 'ready',due_at timestamptz DEFAULT now(),
 safe_after timestamptz,claim_token uuid,claim_owner text,claim_run_id text,claim_expires_at timestamptz);
 CREATE TABLE ig_next_action_receipts(ig_username text,receipt jsonb);
 CREATE TABLE ig_browser_shift_runs(run_id text,browser_binding jsonb,lane text,status text,expires_at timestamptz);
 CREATE FUNCTION ig_browser_surface_owned(r text,s text) RETURNS boolean LANGUAGE sql AS $$
 SELECT coalesce(bool_or(status='running' AND expires_at>now() AND s='instagram'),false)
 FROM ig_browser_shift_runs WHERE run_id=r $$;`);
 await db.exec(migration);
 await db.exec(`CREATE FUNCTION ig_browser_action_owned(r text,s text,tab text,aid uuid,v integer,tok uuid,src uuid)
 RETURNS boolean LANGUAGE sql AS $$ SELECT ig_browser_surface_owned(r,s) AND EXISTS(
 SELECT 1 FROM ig_next_actions a JOIN ig_browser_shift_runs b ON b.run_id=a.claim_run_id
 WHERE a.id=aid AND a.action_version=v AND a.claim_token=tok AND a.status='claimed'
 AND a.claim_expires_at>now() AND b.run_id=r AND b.browser_binding->>'tab_id'=tab
 AND a.source_message_id IS NOT DISTINCT FROM src AND ig_user_requested_checkin_eligible(a)) $$;`);
 const action='10000000-0000-4000-8000-000000000001';
 const run='balance-shortlist-dm-20261025-seg999';
 const makeReason=()=>({policy:'shortlist_native_direct_20261025_v1',campaign:'shortlist_casual_seven_day_v2',
 authorization_source_chat:'01a170d1-9ce1-7600-abb1-c4317adb4642',explicit_user_authorization:true,
 authorization_request_id:'offline-fixture',authorization_expires_at:new Date(Date.now()+3600000).toISOString(),
 run_id:run,final_text:'Hey, how have you been?',native_account:'shan_n_sunny',
 native_conversation_id:'1234567890',native_display_name:'Offline fixture',
 native_evidence_ref:'offline.txt',canonical_gate_ref:'offline.json',full_thread_reviewed:true,
 native_identity_verified:true,native_following_verified:true,independent_holds_checked:true,
 canonical_history_empty:true,native_pending_inbound:false,native_reviewed_at:new Date().toISOString(),
 native_latest_direction:'empty',native_history_empty:true,native_last_outbound_at:null});
 async function reset(reason=makeReason(),extra={}) {
  await db.exec('TRUNCATE ig_next_actions,ig_threads,ig_messages,ig_personal_contacts,ig_next_action_receipts,ig_browser_shift_runs;');
  await db.query('INSERT INTO ig_next_actions(id,ig_username,owner,action_type,reason) VALUES($1,$2,$3,$4,$5)',
   [action,extra.ig_username||'sahil__20__',extra.owner||'manual',extra.action_type||'reactivation',reason]);
  await db.query(`INSERT INTO ig_browser_shift_runs VALUES($1,'{"tab_id":"offline-tab"}',
   'active_client_instagram_community','running',now()+interval '300 seconds')`,[run]);
 }
 async function eligible(){return (await db.query('SELECT ig_user_requested_checkin_eligible(a) ok FROM ig_next_actions a WHERE id=$1',[action])).rows[0].ok;}
 await t.test('verified empty history is eligible without inventing a thread/source',async()=>{await reset();assert.equal(await eligible(),true);});
 await t.test('old unanswered native outbound is eligible',async()=>{await reset({...makeReason(),native_latest_direction:'out',native_history_empty:false,native_last_outbound_at:new Date(Date.now()-8*86400000).toISOString()});assert.equal(await eligible(),true);});
 for(const [field,value] of Object.entries({policy:'story_reply',campaign:'other',authorization_source_chat:'other',
 explicit_user_authorization:false,run_id:'foreign-run',final_text:'',native_account:'other',native_conversation_id:'slug',
 native_display_name:'',native_evidence_ref:'',canonical_gate_ref:'',full_thread_reviewed:false,
 native_identity_verified:false,native_following_verified:false,independent_holds_checked:false,
 canonical_history_empty:false,native_pending_inbound:true,native_latest_direction:'in'})) {
  await t.test('reject '+field,async()=>{await reset({...makeReason(),[field]:value});assert.equal(await eligible(),false);});
 }
 await t.test('reject noncampaign or protected recipient',async()=>{await reset(makeReason(),{ig_username:'not-in-campaign'});assert.equal(await eligible(),false);await reset(makeReason(),{ig_username:'___rebeccarose'});assert.equal(await eligible(),false);});
 for(const [name,patch] of [
  ['expired authority',{authorization_expires_at:new Date(Date.now()-1000).toISOString()}],
  ['overlong authority',{authorization_expires_at:new Date(Date.now()+25*3600000).toISOString()}],
  ['stale native review',{native_reviewed_at:new Date(Date.now()-6*60000).toISOString()}],
  ['future native review',{native_reviewed_at:new Date(Date.now()+60000).toISOString()}],
  ['unanswered in last seven days',{native_latest_direction:'out',native_history_empty:false,native_last_outbound_at:new Date(Date.now()-86400000).toISOString()}],
  ['outbound date missing',{native_latest_direction:'out',native_history_empty:false}],
  ['contradictory empty history',{native_history_empty:false}],
  ['invalid timestamp',{native_reviewed_at:'not-a-date'}]
 ]) await t.test(name,async()=>{await reset({...makeReason(),...patch});assert.equal(await eligible(),false);});
 await t.test('canonical identity or graph alias appearing requires re-review',async()=>{
  await reset();await db.exec(`INSERT INTO ig_threads VALUES(gen_random_uuid(),'other','instagram','{"instagram_graph":{"username":"sahil__20__"}}')`);assert.equal(await eligible(),false);
 });
 await t.test('personal hold and competing recipient owner block',async()=>{
  await reset();await db.exec("INSERT INTO ig_personal_contacts VALUES('sahil__20__')");assert.equal(await eligible(),false);
  await reset();await db.exec(`INSERT INTO ig_next_actions(id,ig_username,status) VALUES(gen_random_uuid(),'sahil__20__','needs_you')`);assert.equal(await eligible(),false);
 });
 await t.test('archived reservation blocks new version',async()=>{
  await reset();await db.exec(`INSERT INTO ig_next_action_receipts VALUES('sahil__20__','{"campaign":"shortlist_casual_seven_day_v2","attempt_reserved_at":"2026-10-25T00:00:00Z"}')`);assert.equal(await eligible(),false);
 });
 await t.test('another live-row reservation blocks even after completion',async()=>{
  await reset();await db.exec(`INSERT INTO ig_next_actions(id,ig_username,status,receipt)
   VALUES(gen_random_uuid(),'sahil__20__','completed','{"campaign":"shortlist_casual_seven_day_v2","attempt_reserved_at":"2026-10-25T00:00:00Z"}')`);assert.equal(await eligible(),false);
 });
 await t.test('fabricated canonical thread or source is rejected',async()=>{
  await reset();await db.exec(`UPDATE ig_next_actions SET source_message_id=gen_random_uuid()`);assert.equal(await eligible(),false);
  await reset();await db.exec(`UPDATE ig_next_actions SET thread_id=gen_random_uuid()`);assert.equal(await eligible(),false);
 });
 await t.test('exact claim rejects wrong tab/text/version/run',async()=>{
  for(const args of [[action,1,run,'wrong','Hey, how have you been?'],[action,2,run,'offline-tab','Hey, how have you been?'],[action,1,'foreign','offline-tab','Hey, how have you been?'],[action,1,run,'offline-tab','changed']]){
   await reset();await assert.rejects(db.query('SELECT claim_ig_shortlist_native_action($1,$2,$3,$4,$5)',args));
  }
 });
 await t.test('one claim and reservation; no second reservation or expired retry',async()=>{
  await reset();const claimed=(await db.query('SELECT * FROM claim_ig_shortlist_native_action($1,1,$2,$3,$4)',[action,run,'offline-tab','Hey, how have you been?'])).rows[0];
  const args=[action,1,claimed.claim_token,run,'offline-tab'];
  const reserved=(await db.query('SELECT reserve_ig_shortlist_native_send($1,$2,$3,$4,$5) receipt',args)).rows[0].receipt;
  assert.equal(reserved.reserved,true);assert.equal(await eligible(),true);
  await assert.rejects(db.query('SELECT reserve_ig_shortlist_native_send($1,$2,$3,$4,$5)',args));
  await db.exec("UPDATE ig_next_actions SET claim_expires_at=now()-interval '1 second'");assert.equal(await eligible(),false);
  await assert.rejects(db.query('SELECT claim_ig_shortlist_native_action($1,1,$2,$3,$4)',[action,run,'offline-tab','Hey, how have you been?']));
 });
 await t.test('existing canonical policy still accepts exact latest and rejects holds',async()=>{
  await reset();const tid='20000000-0000-4000-8000-000000000001',mid='30000000-0000-4000-8000-000000000001';
  await db.query(`INSERT INTO ig_threads VALUES($1,'sahil__20__','instagram','{}')`,[tid]);
  await db.query('INSERT INTO ig_messages VALUES($1,$2,now())',[mid,tid]);
  await db.query(`UPDATE ig_next_actions SET thread_id=$1,reason=reason||$2::jsonb`,[tid,JSON.stringify({policy:'user_requested_checkin_v1',expected_latest_message_id:mid})]);
  assert.equal(await eligible(),true);
  await db.exec(`UPDATE ig_threads SET custom_data='{"manual_review_only":true}'`);assert.equal(await eligible(),false);
 });
 await t.test('new endpoints remain invoker and unavailable to public client roles',async()=>{
  const rows=(await db.query(`SELECT proname,prosecdef,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated FROM pg_proc WHERE proname IN ('ig_shortlist_native_checkin_eligible','claim_ig_shortlist_native_action','reserve_ig_shortlist_native_send')`)).rows;
  assert.equal(rows.length,3);for(const row of rows){assert.equal(row.prosecdef,false);assert.equal(row.anon,false);assert.equal(row.authenticated,false);}
 });
 await db.exec('ALTER TABLE ig_threads ADD COLUMN linked_user_id uuid');
 await db.exec(fs.readFileSync(path.join(__dirname,
  '../supabase/migrations/20261025034230_shortlist_exact_empty_canonical.sql'),'utf8'));
 const emptyThread='ded9b806-8598-4a44-878a-45e8e94177ef';
 async function emptyCanonical(){
  await reset(makeReason(),{ig_username:'yadi.z95'});
  await db.query("INSERT INTO ig_threads(id,ig_username,channel,custom_data) VALUES($1,'yadi.z95','instagram','{}')",[emptyThread]);
  await db.query('UPDATE ig_next_actions SET thread_id=$1',[emptyThread]);
 }
 await t.test('exact empty canonical identity keeps real thread and null source',async()=>{
  await emptyCanonical();assert.equal(await eligible(),true);
  const claimed=(await db.query('SELECT * FROM claim_ig_shortlist_native_action($1,1,$2,$3,$4)',[action,run,'offline-tab','Hey, how have you been?'])).rows[0];
  assert.equal(claimed.thread_id,emptyThread);assert.equal(claimed.source_message_id,null);
  const args=[action,1,claimed.claim_token,run,'offline-tab'];
  assert.equal((await db.query('SELECT reserve_ig_shortlist_native_send($1,$2,$3,$4,$5) r',args)).rows[0].r.reserved,true);
  await assert.rejects(db.query('SELECT reserve_ig_shortlist_native_send($1,$2,$3,$4,$5)',args));
 });
 await t.test('empty canonical exception rejects missing/wrong identity, source and new history',async()=>{
  for(const sql of ["UPDATE ig_next_actions SET thread_id=null",'UPDATE ig_next_actions SET thread_id=gen_random_uuid()',
   'UPDATE ig_next_actions SET source_message_id=gen_random_uuid()',"UPDATE ig_threads SET ig_username='other'",
   "UPDATE ig_threads SET channel='facebook'",'UPDATE ig_threads SET linked_user_id=gen_random_uuid()',
   'INSERT INTO ig_messages SELECT gen_random_uuid(),id,now() FROM ig_threads']){
   await emptyCanonical();await db.exec(sql);assert.equal(await eligible(),false,sql);
  }
 });
 await t.test('empty canonical exception preserves independent holds and duplicate aliases',async()=>{
  for(const flag of ['do_not_follow_up','blocked_by_shannon','manual_review_only','friend_manual_only','personal_outreach']){
   await emptyCanonical();await db.query('UPDATE ig_threads SET custom_data=$1',[{[flag]:true}]);assert.equal(await eligible(),false,flag);
  }
  await emptyCanonical();await db.exec(`INSERT INTO ig_threads(id,ig_username,custom_data) VALUES(gen_random_uuid(),'other','{"instagram_graph":{"username":"yadi.z95"}}')`);
  assert.equal(await eligible(),false);
  await emptyCanonical();await db.exec("INSERT INTO ig_personal_contacts VALUES('yadi.z95')");assert.equal(await eligible(),false);
  await emptyCanonical();await db.exec(`INSERT INTO ig_next_action_receipts VALUES('yadi.z95','{"campaign":"shortlist_casual_seven_day_v2","attempt_reserved_at":"2026-10-25T00:00:00Z"}')`);assert.equal(await eligible(),false);
 });
 await t.test('original absent-identity path still rejects newly found canonical identity',async()=>{
  await reset();await db.exec("INSERT INTO ig_threads(id,ig_username,channel,custom_data) VALUES(gen_random_uuid(),'sahil__20__','instagram','{}')");assert.equal(await eligible(),false);
 });
 await db.close();
});
