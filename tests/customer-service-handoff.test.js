const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildCourseClientContext, loadCourseClientContext } = require('../netlify/functions/_lib/course-client-context');
const { loadCustomerServicePermission } = require('../netlify/functions/_lib/customer-service-policy');
const { resolveIgAcquisitionMode } = require('../netlify/functions/_lib/ig-acquisition-mode');
const { isProtectedManualClient, isClientManagerAutoReplyEnabled } = require('../netlify/functions/_lib/client-context');
const { isManagerOwnedClientAutoReply } = require('../netlify/functions/send-coach-reply')._test;
const { handoffPurchasedCustomer } = new Function(fs.readFileSync(require.resolve('../netlify/edge-functions/lib/customer-dm-handoff.js'),'utf8').replace('export async function','async function') + '\nreturn {handoffPurchasedCustomer};')();

test('verified payment leaves paid ad lane before account creation, while ad evidence remains', () => {
    const data = { meta_ad_attribution:{source:'meta_ads'}, customer_lifecycle:{purchase_id:'purchase'} };
    assert.equal(resolveIgAcquisitionMode({customData:data}), 'existing_client');
    assert.equal(resolveIgAcquisitionMode({customData:{meta_ad_attribution:data.meta_ad_attribution}}), 'paid_meta');
});
test('manual contacts cannot be enabled accidentally', () => {
    for (const name of ['Nat','Shane Minahan','Arunima Sharma']) {
        const person = {name,custom_data:{client_manager_auto_reply_enabled:true}};
        assert.equal(isProtectedManualClient(person),true);
        assert.equal(isClientManagerAutoReplyEnabled(person),false);
    }
});
test('only verified new active coaching relationships qualify; opt-outs and unknowns fail closed', async () => {
    const query = (name='New Client', prefs={}, assigned='2026-09-16T05:00:00Z') => async path =>
        path.startsWith('users?') ? [{name,created_at:'2026-08-01',is_test_account:false}] :
        path.startsWith('coach_clients?') ? [{id:'rel',assigned_at:assigned}] : [{preferences:prefs}];
    assert.equal(await loadCustomerServicePermission(query(),'coach','client'),true);
    assert.equal(await loadCustomerServicePermission(query('Nat'),'coach','client'),false);
    assert.equal(await loadCustomerServicePermission(query('New Client',{customer_service_auto_reply_enabled:false}),'coach','client'),false);
    assert.equal(await loadCustomerServicePermission(query('Old Client',{},'2026-08-01'),'coach','client'),false);
    assert.equal(await loadCustomerServicePermission(async()=>{throw Error('offline')},'coach','client'),false);
});
test('in-app manager permission cannot authorize worker or proactive messages', () => {
    const alert = {alert_type:'incoming_dm',_liveCustomerServicePermission:true,data:{}};
    assert.equal(isManagerOwnedClientAutoReply(alert,'balance_lead_client_manager_cron'),true);
    assert.equal(isManagerOwnedClientAutoReply(alert,'scheduled_worker'),false);
    assert.equal(isManagerOwnedClientAutoReply({...alert,alert_type:'coaching_idea'},'balance_lead_client_manager_cron'),false);
});
test('course evidence separates public offer, assigned curriculum, progress and missing data', async () => {
    const text = buildCourseClientContext({account:[{onboarding_complete:true}],enrollment:[{id:'e',course_id:'learn',start_date:'2026-09-01'}],journey:[{current_week:2,settings:{learn_curriculum:'six_v2'}}],lessons:[{lessons_completed:['mind-2-1']}],reviews:[{enrollment_id:'e',week:2,status:'submitted',reflection_text:'shift work',report:{}}]});
    assert.match(text,/six-week public course/); assert.match(text,/week 2: Work with your energy/);
    assert.match(text,/recorded lessons: 1\/10/); assert.match(text,/shift work/);
    const unavailable = await loadCourseClientContext('u',async()=>{throw Error('unavailable')});
    assert.match(unavailable,/Enrolment lookup unavailable/); assert.doesNotMatch(unavailable,/No active practical-action enrolment/);
});
test('purchase handover links exact identity, cancels stale drafts once, preserves attribution and holds', async () => {
    let thread = {id:'t',coach_id:'c',linked_user_id:null,custom_data:{meta_ad_attribution:{source:'meta_ads'},customer_service_manual_only:true}};
    const calls=[];
    const query=async(path,opts)=>{
        if(opts){calls.push({path,opts});if(path.startsWith('ig_threads?'))thread={...thread,...opts.body};return [];}
        if(path.startsWith('ig_threads?'))return [thread];
        return [{id:'old',data:{},created_at:'2026-09-01'}];
    };
    const purchase={id:'p',status:'paid',metadata:{},purchased_at:'2026-09-16',stripe_checkout_session_id:'cs'};
    await handoffPurchasedCustomer({query,purchase,threadId:'t'});
    assert.equal(thread.custom_data.customer_lifecycle.state,'paid_awaiting_account');
    assert.equal(thread.custom_data.customer_service_manual_only,true);
    assert.equal(thread.custom_data.meta_ad_attribution.source,'meta_ads');
    const n=calls.length;
    await handoffPurchasedCustomer({query,purchase,threadId:'t'});assert.equal(calls.length,n);
    await handoffPurchasedCustomer({query,purchase,threadId:'t',userId:'u'});
    assert.equal(thread.linked_user_id,'u'); assert.equal(thread.custom_data.customer_lifecycle.state,'customer_coaching');
    assert.equal((await handoffPurchasedCustomer({query,purchase,threadId:'t',userId:'wrong'})).skipped,'identity_conflict');
});
