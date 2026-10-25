// Prints a transaction-only fixture for the authenticated SQL tool. Never sends.
const fs = require('node:fs');
const path = require('node:path');
const {buildFreeCoachingProgram} = require('../netlify/functions/_lib/free-coaching-program');
const plan = buildFreeCoachingProgram({equipment:'none',schedule:[{weekday:2,time:'16:30'},{weekday:5,time:'17:15'}],sessionMinutes:30,movementRestrictions:'none_reported'});
let sql = fs.readFileSync(path.join(__dirname,'../supabase/tests/free-coaching-month.sql'),'utf8');
if (process.argv.includes('--challenge')) {
    const change = (from,to) => { if(!sql.includes(from)) throw new Error('Fixture contract changed: '+from); sql=sql.replace(from,to); };
    change("'internal_rollback_test',now()-interval '1 day'","'internal_rollback_test',now()");
    change(' queued_job:=queue_balance_free_coaching',` perform reserve_balance_coaching_challenge(tid,acceptance,jsonb_build_object(
 'full_thread_reviewed',true,'organic_fit_verified',true,'routine_understood',true,'existing_support_understood',true,
 'help_wanted',true,'terms_disclosed',true,'explicit_challenge_acceptance',true,'independent_holds_checked',true,
 'reviewed_by','rollback_fixture','routine_summary','Two afternoons','existing_support_summary','Own routine, no coach',
 'help_wanted_summary','Wants help with consistency','source_message_ids',jsonb_build_array(acceptance)));
 queued_job:=queue_balance_free_coaching`);
    change("grant_row.ends_at<>grant_row.starts_at+interval '1 month'","grant_row.ends_at<>grant_row.starts_at+interval '28 days'");
    change("p.weekly_schedule=v_plan->'weekly_schedule'","p.weekly_schedule=v_plan->'weekly_schedule' and p.duration_weeks=4");
    change("if grant_row.user_id is not null", "if grant_row.setup->>'challengeIntakeId' is distinct from 'consistency_20261025' then raise exception 'Challenge grant tag missing'; end if;\n if grant_row.user_id is not null");
    sql=sql.replaceAll('PASS: free coaching transaction checks','PASS: four-week challenge transaction checks');
}
sql=sql.replaceAll('__PROGRAM__',JSON.stringify(plan).replaceAll("'","''"));
process.stdout.write(sql);
