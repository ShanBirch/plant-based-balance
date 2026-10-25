// Isolated PostgreSQL fixtures; no network, real messages or browser actions.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
test('one exact native-only owed reply retains ownership, source evidence and no-repeat',async t=>{
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE ig_threads(id uuid,ig_username text,custom_data jsonb);
 CREATE TABLE ig_personal_contacts(ig_username text);
 CREATE TABLE ig_next_actions(id uuid PRIMARY KEY,thread_id uuid,source_message_id uuid,
 ig_username text,owner text,action_type text,reason jsonb,receipt jsonb DEFAULT '{}',
 action_version integer DEFAULT 1,status text DEFAULT 'ready',due_at timestamptz DEFAULT now(),
 safe_after timestamptz,claim_owner text,claim_token uuid,claim_run_id text,claim_expires_at timestamptz);
 CREATE TABLE ig_next_action_receipts(ig_username text,action_type text,receipt jsonb);
 CREATE TABLE ig_browser_shift_runs(run_id text,browser_binding jsonb,lane text,status text,
 lease_expires_at timestamptz);
 CREATE FUNCTION ig_browser_surface_owned(r text,s text) RETURNS boolean LANGUAGE sql AS $$
 SELECT coalesce(bool_or(status='running' AND lease_expires_at>now() AND s='meta_business_suite'),false)
 FROM ig_browser_shift_runs WHERE run_id=r $$;
 CREATE FUNCTION ig_browser_action_owned(r text,s text,tab text,aid uuid,v integer,tok uuid,src uuid)
 RETURNS boolean LANGUAGE sql AS $$SELECT ig_browser_surface_owned(r,s) AND EXISTS(
 SELECT 1 FROM ig_next_actions a JOIN ig_browser_shift_runs b ON b.run_id=a.claim_run_id
 WHERE a.id=aid AND a.action_version=v AND a.claim_token=tok AND a.status='claimed'
 AND a.claim_expires_at>now() AND b.run_id=r AND b.browser_binding->>'tab_id'=tab
 AND a.source_message_id IS NOT DISTINCT FROM src)$$;`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261025074000_exact_native_only_owed_reply.sql'),'utf8'));
 const id='10000000-0000-4000-8000-000000000001',run='balance-reactive-offline-fixture';
 const reason=()=>({policy:'native_only_owed_reply_20261025_v1',authorization_source_chat:'01a170d1-9ce1-7600-abb1-c4317adb4642',
 explicit_user_authorization:true,native_account:'shan_n_sunny',native_conversation_id:'340282366841710301244259776334285016989',
 native_direct_id:'116842643039768',native_source_story_id:'3715640373089060623',native_source_text:'coco babyyyyy such a cutie',
 native_source_local_time:'2025-09-07T00:31+10:00',native_source_key:'forster.alice:116842643039768:3715640373089060623:20250907T0031',
 full_thread_reviewed:true,native_identity_verified:true,independent_holds_checked:true,native_pending_inbound:true,
 no_later_native_reply:true,native_following_verified:true,native_evidence_ref:'offline-proof.png',canonical_gate_ref:'offline-gates.json',
 authorization_request_id:'offline-only',run_id:run,final_text:'Thanks!',native_reviewed_at:new Date().toISOString(),
 authorization_expires_at:new Date(Date.now()+3600000).toISOString()});
 async function reset(r=reason()){
  await db.exec('TRUNCATE ig_threads,ig_personal_contacts,ig_next_actions,ig_next_action_receipts,ig_browser_shift_runs');
  await db.query("INSERT INTO ig_next_actions(id,ig_username,owner,action_type,reason) VALUES($1,'forster.alice','dm_manager','reply_inbound',$2)",[id,r]);
  await db.query(`INSERT INTO ig_browser_shift_runs VALUES($1,'{"tab_id":"offline-tab","kind":"meta_business_suite","account":"shan_n_sunny","page_id":"561122130919678"}','missed_dm_audit','running',now()+interval '300 seconds')`,[run]);
 }
 const eligible=async()=> (await db.query('SELECT ig_exact_native_owed_reply_eligible(a) ok FROM ig_next_actions a WHERE id=$1',[id])).rows[0].ok;
 const claim=()=>db.query('SELECT * FROM claim_ig_exact_native_owed_reply($1,1,$2,$3,$4)',[id,run,'offline-tab','Thanks!']);
 await t.test('exact native source is supported without creating canonical rows',async()=>{
  await reset();assert.equal(await eligible(),true);const a=(await claim()).rows[0];
  assert.equal(a.thread_id,null);assert.equal(a.source_message_id,null);
  assert.equal((await db.query('SELECT count(*) n FROM ig_threads')).rows[0].n,0);
  const args=[id,1,a.claim_token,run,'offline-tab'];
  assert.equal((await db.query('SELECT reserve_ig_exact_native_owed_reply($1,$2,$3,$4,$5) r',args)).rows[0].r.reserved,true);
  await assert.rejects(db.query('SELECT reserve_ig_exact_native_owed_reply($1,$2,$3,$4,$5)',args));
  await db.exec("UPDATE ig_next_actions SET status='ready',claim_token=null");await assert.rejects(claim());
 });
 for(const [k,v] of Object.entries({policy:'story_reply',authorization_source_chat:'other',explicit_user_authorization:false,
 native_account:'other',native_conversation_id:'116842643039768',native_direct_id:'1',native_source_story_id:'1',native_source_text:'different',
 native_source_local_time:'2025-09-08T00:31+10:00',native_source_key:'different',full_thread_reviewed:false,native_identity_verified:false,
 independent_holds_checked:false,native_pending_inbound:false,no_later_native_reply:false,native_following_verified:false,
 native_evidence_ref:'',canonical_gate_ref:'',authorization_request_id:'',run_id:'foreign',final_text:''})){
  await t.test('reject altered or missing '+k,async()=>{await reset({...reason(),[k]:v});assert.equal(await eligible(),false);});
 }
 await t.test('freshness and authority expiry remain required',async()=>{
  for(const [k,v] of [['native_reviewed_at',new Date(Date.now()-360000).toISOString()],['authorization_expires_at',new Date(Date.now()-1000).toISOString()],['authorization_expires_at',new Date(Date.now()+25*3600000).toISOString()],['native_reviewed_at','invalid']]){
   await reset({...reason(),[k]:v});assert.equal(await eligible(),false);
  }
 });
 await t.test('wrong recipient, category and fabricated source remain rejected',async()=>{
  for(const sql of ["UPDATE ig_next_actions SET ig_username='other'","UPDATE ig_next_actions SET owner='story_operator'","UPDATE ig_next_actions SET action_type='reactivation'",'UPDATE ig_next_actions SET thread_id=gen_random_uuid()','UPDATE ig_next_actions SET source_message_id=gen_random_uuid()']){
   await reset();await db.exec(sql);assert.equal(await eligible(),false);
  }
 });
 await t.test('new canonical identity, personal hold and other owner block',async()=>{
  for(const sql of ["INSERT INTO ig_threads VALUES(gen_random_uuid(),'forster.alice','{}')",`INSERT INTO ig_threads VALUES(gen_random_uuid(),'other','{"instagram_graph":{"username":"forster.alice"}}')`,"INSERT INTO ig_personal_contacts VALUES('forster.alice')",`INSERT INTO ig_next_actions(id,ig_username,status) VALUES(gen_random_uuid(),'forster.alice','needs_you')`]){
   await reset();await db.exec(sql);assert.equal(await eligible(),false);
  }
 });
 await t.test('archived and live no-repeat receipts cannot be bypassed by new version',async()=>{
  await reset();await db.exec(`INSERT INTO ig_next_action_receipts VALUES('forster.alice','reply_inbound','{"no_repeat":true}')`);assert.equal(await eligible(),false);
  await reset();await db.exec(`INSERT INTO ig_next_actions(id,ig_username,action_type,status,receipt) VALUES(gen_random_uuid(),'forster.alice','reply_inbound','completed','{"attempt_reserved_at":"2026-10-25T00:00:00Z"}')`);assert.equal(await eligible(),false);
 });
 await t.test('claim rejects wrong binding or expired lease',async()=>{
  for(const sql of ["UPDATE ig_browser_shift_runs SET browser_binding=browser_binding||'{\"tab_id\":\"other\"}'", "UPDATE ig_browser_shift_runs SET browser_binding=browser_binding||'{\"account\":\"other\"}'", "UPDATE ig_browser_shift_runs SET browser_binding=browser_binding||'{\"page_id\":\"other\"}'", "UPDATE ig_browser_shift_runs SET lease_expires_at=now()-interval '1 second'"]){
   await reset();await db.exec(sql);await assert.rejects(claim());
  }
 });
 await t.test('reservation rejects wrong token and new personal hold',async()=>{
  await reset();const a=(await claim()).rows[0];await assert.rejects(db.query('SELECT reserve_ig_exact_native_owed_reply($1,1,gen_random_uuid(),$2,$3)',[id,run,'offline-tab']));
  await db.exec("INSERT INTO ig_personal_contacts VALUES('forster.alice')");await assert.rejects(db.query('SELECT reserve_ig_exact_native_owed_reply($1,1,$2,$3,$4)',[id,a.claim_token,run,'offline-tab']));
 });
 await t.test('reservation rejects changed Page binding and expired exact claim',async()=>{
  for(const sql of ["UPDATE ig_browser_shift_runs SET browser_binding=browser_binding||'{\"page_id\":\"other\"}'", "UPDATE ig_next_actions SET claim_expires_at=now()-interval '1 second'"]){
   await reset();const a=(await claim()).rows[0];await db.exec(sql);
   await assert.rejects(db.query('SELECT reserve_ig_exact_native_owed_reply($1,1,$2,$3,$4)',[id,a.claim_token,run,'offline-tab']));
  }
 });
 await t.test('claim binds reviewed text and version exactly',async()=>{
  await reset();await assert.rejects(db.query('SELECT claim_ig_exact_native_owed_reply($1,2,$2,$3,$4)',[id,run,'offline-tab','Thanks!']));
  await assert.rejects(db.query('SELECT claim_ig_exact_native_owed_reply($1,1,$2,$3,$4)',[id,run,'offline-tab','Different text']));
 });
 await t.test('new helpers remain invoker and service-only',async()=>{
  const rows=(await db.query("SELECT prosecdef,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated FROM pg_proc WHERE proname IN ('ig_exact_native_owed_reply_eligible','claim_ig_exact_native_owed_reply','reserve_ig_exact_native_owed_reply')")).rows;
  assert.equal(rows.length,3);for(const r of rows){assert.equal(r.prosecdef,false);assert.equal(r.anon,false);assert.equal(r.authenticated,false);}
 });
 await db.close();
});
