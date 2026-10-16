import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

// Run with PGLITE_MODULE pointing to the available PGlite package. No browser,
// credentials, external database, native comments or messages are used.
test('reactive reply ownership, source, one-use, holds and receipt regression', {skip:!process.env.PGLITE_MODULE}, async()=>{
 const {PGlite}=createRequire(import.meta.url)(process.env.PGLITE_MODULE);
 const db=new PGlite();
 try {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE ig_public_comment_runs(run_id text primary key,browser_binding jsonb,started_at timestamptz default now(),lease_expires_at timestamptz default now()+interval '5 minutes',status text default 'running');
 CREATE TABLE fb_public_comment_runs(run_id text primary key,binding jsonb,started_at timestamptz default now(),lease_expires_at timestamptz default now()+interval '5 minutes',status text default 'running');
 CREATE TABLE ig_public_comment_attempts(id uuid primary key,post_url text,status text,proof jsonb);
 CREATE TABLE fb_public_comment_attempts(id uuid primary key,post_url text,status text,proof jsonb);
 CREATE TABLE ig_personal_contacts(ig_username text);
 CREATE TABLE ig_threads(ig_username text,auto_send_enabled boolean,custom_data jsonb);
 CREATE TABLE ig_next_actions(id uuid default gen_random_uuid(),ig_username text,status text,claim_expires_at timestamptz,claim_token uuid);
 CREATE FUNCTION ig_public_comment_run_owned(r text,t text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM ig_public_comment_runs WHERE run_id=r AND browser_binding->>'tab_id'=t AND status='running' AND lease_expires_at>now() AND started_at>now()-interval '30 minutes')$$;
 CREATE FUNCTION fb_public_comment_owned(r text,t text) RETURNS boolean LANGUAGE sql AS $$SELECT EXISTS(SELECT 1 FROM fb_public_comment_runs WHERE run_id=r AND binding->>'tab_id'=t AND status='running' AND lease_expires_at>now() AND started_at>now()-interval '30 minutes')$$;
 INSERT INTO ig_public_comment_runs(run_id,browser_binding) VALUES('fixture-ig','{"tab_id":"fixture-tab"}');
 INSERT INTO fb_public_comment_runs(run_id,binding) VALUES('fixture-fb','{"tab_id":"fixture-tab"}');
 INSERT INTO ig_public_comment_attempts VALUES('00000000-0000-4000-8000-000000000001','https://www.instagram.com/p/FIXTURE/','verified','{"native_comment_id":"100"}');
 INSERT INTO fb_public_comment_attempts VALUES('00000000-0000-4000-8000-000000000002','https://www.facebook.com/fixture/posts/1/','verified','{"native_comment_id":"100"}');
 `);
 const migration=new URL('../supabase/migrations/20261016004055_outbound_comment_replies.sql',import.meta.url);
 await db.exec(fs.readFileSync(migration,'utf8'));
 const evidence={history_complete:true,eligibility_clear:true,cross_worker_clear:true,expanded_replies_reviewed:true,unanswered:true,public_context_understood:true,native_source_screenshot:'synthetic-never-sent.png',history_review:'synthetic complete history',eligibility_review:'synthetic clear',authorization_source:'rollback fixture only',reviewed_at:new Date().toISOString()};
 const reserve=async({channel='instagram',run='fixture-ig',tab='fixture-tab',root='00000000-0000-4000-8000-000000000001',person='fixture_person',username='fixture_person',url='https://www.instagram.com/p/FIXTURE/',inbound='200',parent='100',review=evidence}={})=>(await db.query('select * from reserve_outbound_comment_reply($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[channel,run,tab,root,person,username,url,'100',inbound,parent,'Synthetic inbound never sent.','Synthetic answer never sent.',review])).rows[0];
 await assert.rejects(()=>reserve({tab:'foreign'}),/ownership/);
 await assert.rejects(()=>reserve({review:{...evidence,unanswered:false}}),/review/);
 await assert.rejects(()=>reserve({review:{...evidence,reviewed_at:'2000-01-01'}}),/review/);
 await assert.rejects(()=>reserve({parent:'foreign'}),/parent/);
 await assert.rejects(()=>reserve({url:'https://www.instagram.com/p/OTHER/'}),/parent/);
 await assert.rejects(()=>reserve({username:'cavazzanafrancesca'}),/hold/);
 await db.exec("INSERT INTO ig_next_actions(ig_username,status,claim_expires_at) VALUES('fixture_person','claimed',now()+interval '5 minutes')");
 await assert.rejects(()=>reserve(),/foreign claim/);
 await db.exec('DELETE FROM ig_next_actions');
 const a=await reserve();assert.equal(a.status,'reserved');
 await assert.rejects(()=>reserve(),/no-repeat|unique/);
 await assert.rejects(()=>db.exec("INSERT INTO ig_next_actions(ig_username,status,claim_expires_at) VALUES('fixture_person','claimed',now()+interval '5 minutes')"),/owned public reply/);
 await db.exec("INSERT INTO ig_threads VALUES('fixture_person',true,'{\"manual_only\":true}')");
 const activate=(id=a.id,tab='fixture-tab')=>db.query('select activate_outbound_comment_reply($1,$2,$3,$4,$5,$6)',['fixture-ig',tab,id,'200',a.final_text,evidence]);
 await assert.rejects(()=>activate(),/hold/);
 await db.exec('DELETE FROM ig_threads');
 await assert.rejects(()=>activate(a.id,'foreign'),/exact reply/);
 await activate();await assert.rejects(()=>activate(),/one-use/);
 await assert.rejects(()=>db.query('select reconcile_outbound_comment_reply($1,$2,true)',[a.id,{}]),/native reply proof/);
 await db.query('select reconcile_outbound_comment_reply($1,$2,false)',[a.id,{reason:'synthetic timeout'}]);
 await assert.rejects(()=>activate(),/one-use/);
 await assert.rejects(()=>reserve({inbound:'201'}),/no-repeat/);
 // No sending after expiry; saved evidence can still reconcile without retry.
 await db.exec("UPDATE ig_public_comment_runs SET lease_expires_at=now()-interval '1 minute'");
 const proof={post_url:a.post_url,inbound_comment_id:'200',reply_to_comment_id:'200',native_comment_id:'300',sender:'shan_n_sunny',text:a.final_text,native_reload_screenshot:'synthetic.png',native_readback:'synthetic',observed_at:new Date().toISOString()};
 const saved=await db.query('select (reconcile_outbound_comment_reply($1,$2,true)).status',[a.id,proof]);assert.equal(saved.rows[0].status,'verified');
 await assert.rejects(()=>reserve({inbound:'201'}),/ownership/);
 await db.exec("UPDATE ig_public_comment_runs SET lease_expires_at=now()+interval '5 minutes'");
 await assert.rejects(()=>reserve(),/unique/);
 const b=await reserve({inbound:'201',parent:'300'});assert.equal(b.status,'reserved');
 await assert.rejects(()=>db.query("update outbound_comment_replies set inbound_comment_id='changed' where id=$1",[b.id]),/immutable/);
 const fb=await reserve({channel:'facebook',run:'fixture-fb',root:'00000000-0000-4000-8000-000000000002',username:null,person:'https://www.facebook.com/synthetic',url:'https://www.facebook.com/fixture/posts/1/'});
 assert.equal(fb.channel,'facebook');
 await db.exec('SET ROLE anon');
 await assert.rejects(()=>db.query('select * from outbound_comment_replies'),/permission denied/);
 await db.exec('RESET ROLE');
 assert.equal((await db.query("select count(*)::int n from outbound_comment_replies")).rows[0].n,3);
 } finally {await db.close();}
});
