const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('person-led observations retain exact sources across archives and health distinguishes missing records from inactivity', async t => {
 const db = new PGlite(); t.after(() => db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table ig_threads(id uuid primary key,ig_username text,linked_user_id uuid,custom_data jsonb default '{}');
 create table ig_messages(id uuid primary key,thread_id uuid,direction text,created_at timestamptz);
 create table ig_personal_contacts(ig_username text);
 create table ig_next_actions(id int primary key,thread_id uuid,source_message_id uuid,owner text,action_type text,status text,reason jsonb,receipt jsonb,updated_at timestamptz default now());
 create table ig_next_action_receipts(thread_id uuid,owner text,action_type text,terminal_status text,receipt jsonb,archived_at timestamptz default now());
 create table balance_coaching_challenge_enrolments(id uuid,intake_id text,thread_id uuid,accepted_at timestamptz);
 create table balance_coaching_challenge_milestones(enrolment_id uuid,milestone text);
 create table balance_coaching_challenge_progress(thread_id uuid,intake_id text,accepted_at timestamptz,onboarding_complete boolean);
 create table balance_challenge_approach_experiments(id text,enabled boolean,opened_at timestamptz);
 create table balance_challenge_timing_assignments(id uuid,experiment_id text,thread_id uuid);
 create table balance_challenge_approach_assignments(assignment_id uuid,experiment_id text,assigned_at timestamptz);
 create table balance_challenge_timing_events(assignment_id uuid,kind text,message_id uuid);
 create function balance_coaching_challenge_status(text) returns jsonb language sql as $$select '{"open":true}'::jsonb$$;
 insert into balance_challenge_approach_experiments values('factorial_abc_20261030',true,now()-interval '20 days');`);
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261030011411_challenge_tracking_health.sql'),'utf8'));
 await db.exec(`create trigger capture_fixture before insert or update of status,receipt on ig_next_actions for each row execute function capture_dm_decisions_review_receipt()`);
 const thread='10000000-0000-4000-8000-000000000001', source='20000000-0000-4000-8000-000000000001', out='30000000-0000-4000-8000-000000000001', other='40000000-0000-4000-8000-000000000001';
 const assignment='50000000-0000-4000-8000-000000000001';
 const review={lane:'organic_business',disposition:'continue',reason:'Offline reviewed inbound',transition:{kind:'person_led_fitness',sourceMessageIds:[source]}};
 const decisions={version:'dm_decisions_review_20261029_v1',threadId:thread,sourceMessageId:source,sendAuthorized:false,transition:review.transition};
 const receipt={native_verified:true,no_repeat:true,canonical_outbound_id:out,source_message_id:source};
 const reason={conversation_review:review,decisions_review:decisions};
 await db.query('insert into ig_threads(id,ig_username) values($1,$2)',[thread,'fixture']);
 await db.query("insert into ig_messages values($1,$2,'in',now()-interval '10 days'),($3,$2,'out',now()-interval '10 days'+interval '1 minute'),($4,$2,'in',now()-interval '10 days'+interval '2 minutes')",[source,thread,out,other]);
 const report=async()=> (await db.query("select balance_person_led_fitness_report(now()-interval '30 days',now()) r")).rows[0].r;
 const health=async()=> (await db.query('select balance_challenge_tracking_health() r')).rows[0].r;
 await db.query("insert into ig_next_actions values(1,$1,$2,'dm_manager','reply_inbound','completed',$3,$4,now())",[thread,source,reason,receipt]);
 let r=await report();assert.equal(r.people,1);assert.equal(r.reviewed_inbound_turns,1);assert.equal(r.verified_replies,1);assert.equal(r.replied_mature_48h,1);assert.equal(r.accepted_people_mature_7d,0);
 await db.exec('insert into ig_next_action_receipts select thread_id,owner,action_type,status,receipt,now() from ig_next_actions');
 assert.equal((await report()).reviewed_inbound_turns,1,'duplicate current/archive source counts once');
 await db.exec('delete from ig_next_actions');
 assert.equal((await report()).verified_replies,1,'archived transition survives reuse of the current action');
 const stored=(await db.query('select receipt from ig_next_action_receipts')).rows[0].receipt;
 assert.deepEqual(stored.conversation_review,review);
 for(const patch of [{native_verified:false},{no_repeat:false},{source_message_id:other},{outbound_message_id:other},{reconciliation_required:true},{result:'uncertain'}]) {
  await db.query('update ig_next_action_receipts set receipt=$1',[{...stored,...patch}]);
  assert.equal((await report()).verified_replies,0,JSON.stringify(patch));
 }
 await db.query('update ig_next_action_receipts set receipt=$1',[stored]);
 await db.exec("update ig_threads set custom_data='{\"acquisition_mode\":\"paid_meta\"}'");assert.equal((await report()).people,0);
 await db.exec("update ig_threads set custom_data='{}'");
 await db.query('insert into ig_personal_contacts values($1)',['fixture']);assert.equal((await report()).people,0);await db.exec('delete from ig_personal_contacts');
 await db.query('update ig_threads set linked_user_id=$1',[other]);assert.equal((await report()).people,0);await db.exec('update ig_threads set linked_user_id=null');
 // Missing transition evidence never becomes an invented person-led observation.
 await db.query('update ig_next_action_receipts set receipt=$1',[{...stored,conversation_review:{...review,transition:{kind:'person_led_fitness',sourceMessageIds:[other]}}}]);
 assert.equal((await report()).people,0);
 await db.query('update ig_next_action_receipts set receipt=$1',[stored]);
 // Downstream acceptance is distinct from a reply and is canonical, not inferred.
 await db.query("insert into balance_coaching_challenge_enrolments values($1,'consistency_20261025',$2,now()-interval '9 days')",[other,thread]);
 assert.equal((await report()).accepted_people_mature_7d,1);
 await db.query("insert into balance_coaching_challenge_progress values($1,'consistency_20261025',now()-interval '9 days',true)",[thread]);
 await db.query("insert into balance_coaching_challenge_milestones values($1,'first_workout_completed')",[other]);
 r=await report();assert.equal(r.onboarded_people_mature_7d,1);assert.equal(r.first_workout_people_mature_7d,1);
 assert.equal((await health()).state,'awaiting_eligible_activity');
 await db.query("insert into balance_challenge_timing_assignments values($1,'pre_christmas_timing_20261028',$2)",[assignment,thread]);
 assert.equal((await health()).state,'eligibility_review_required','fresh sources require review, not automatic assignment');
 await db.query("insert into balance_challenge_approach_assignments values($1,'factorial_abc_20261030',now()-interval '11 days')",[assignment]);
 assert.equal((await health()).state,'recording');
 // Person-led transitions never create a missing randomised exposure alert.
 assert.equal((await health()).verified_exposure_receipt_gaps,0);
 const invitation={...review,disposition:'invite_challenge',transition:{kind:'topic_wind_down_gym',sourceMessageIds:[source]}};
 await db.query('update ig_next_action_receipts set receipt=$1',[{...stored,conversation_review:invitation}]);
 assert.equal((await health()).state,'receipt_reconciliation_required');
 await db.query("insert into balance_challenge_timing_events values($1,'invited',$2)",[assignment,out]);
 assert.equal((await health()).verified_exposure_receipt_gaps,0);
 for(const name of ['balance_challenge_tracking_health()','balance_dm_reviewed_turns(timestamptz,timestamptz)','balance_person_led_fitness_report(timestamptz,timestamptz)']) {
  assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') allowed",[name])).rows[0].allowed,false);
 }
});
