const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../netlify/functions/_lib/codex-dm-operator');
const now = Date.parse('2026-09-30T06:40:00Z');
function fixture() {
    const thread = { id: 't', coach_id: policy.COACH_ID, channel: 'instagram', custom_data: { bot_account: 'shan_n_sunny' } };
    const latest = { id: 'm', direction: 'in', manychat_message_id: 'graph:m' };
    const action = { id: 'a', action_version: 2, thread_id: 't', owner: 'dm_manager', status: 'claimed', action_type: 'reply_inbound',
        source_message_id: 'm', claim_token: 'token', claim_run_id: 'run', claim_expires_at: '2026-09-30T06:45:00Z' };
    const proof = { action_id: 'a', action_version: 2, source_message_id: 'm', claim_token: 'token',
        run_id: 'run', reviewed_at: '2026-09-30T06:39:00Z', reviewed_text: 'Hello' };
    return { alert: { coach_id: policy.COACH_ID, data: { ig_thread_id: 't', manychat_message_id: 'graph:m' } },
        thread, latest, action, proof, replyText: 'Hello', now };
}
test('ownership is limited to Balance external DMs and excludes other brands and app coaching', () => {
    for (const channel of ['instagram', 'messenger', 'whatsapp']) assert.equal(policy.operatorOwnsDm({coach_id:policy.COACH_ID,channel}),true);
    assert.equal(policy.operatorOwnsDm({coach_id:policy.COACH_ID,channel:'in_app'}),false);
    assert.equal(policy.operatorOwnsDm({coach_id:'other',channel:'instagram'}),false);
    assert.equal(policy.operatorOwnsDm({coach_id:policy.COACH_ID,channel:'instagram',custom_data:{bot_account:'littlecompanionportraits'}}),false);
    assert.equal(policy.operatorOwnsDm({coach_id:policy.COACH_ID,alert_type:'ig_incoming_dm',data:{}}),true);
});
test('old auto senders stop while Shannon manual sends remain available', () => {
    const alert={coach_id:policy.COACH_ID,alert_type:'ig_incoming_dm',data:{}};
    for(const source of ['auto_send','scheduled_worker','balance_lead_client_manager_cron','unknown']) assert.equal(policy.legacySendBlocked(alert,source),true);
    for(const source of ['admin_dashboard','admin_dashboard_schedule','android_inline_reply_worker','manual_instagram']) assert.equal(policy.legacySendBlocked(alert,source),false);
});
test('operator claim binds exact person, source, version, owner, text and fresh lease', () => {
    assert.equal(policy.validateOperatorClaim(fixture()),null);
    const cases = [
        f=>f.thread.coach_id='other',f=>f.alert.data.ig_thread_id='other',
        f=>f.action.claim_token='other',f=>f.action.claim_run_id='other',
        f=>f.action.action_version=1,f=>f.action.owner='browser_dispatcher',f=>f.action.action_type='welcome_follower',
        f=>f.action.claim_expires_at='2026-09-30T06:39:00Z',f=>f.latest.direction='out',
        f=>f.latest.id='new-inbound',f=>f.proof.reviewed_text='Changed',
        f=>f.proof.reviewed_at='2026-09-30T06:34:00Z',f=>f.proof.reviewed_at='2026-09-30T06:41:00Z',
        f=>f.thread.custom_data.manual_review_only=true,f=>f.thread.custom_data.no_ai_send=true,
        f=>f.thread.custom_data.operator_lock='takeover',f=>f.alert.data.send_claim_id='foreign',
        f=>f.action.receipt={action_version:2,delivery_outcome:'sent_attribution_pending',no_repeat:true}
    ];
    for(const mutate of cases){const f=fixture();mutate(f);assert.ok(policy.validateOperatorClaim(f));}
    const renewed=fixture();renewed.action.receipt={action_version:1,no_repeat:true};assert.equal(policy.validateOperatorClaim(renewed),null);
});
test('inbound delegation persists source without generating or sending a reply',async()=>{
    const calls=[];
    const query=async(path,options)=>{
        calls.push({path,options});
        if(path.startsWith('ig_messages'))return [{id:'m',direction:'in',text:'Question',manychat_message_id:'graph:m'}];
        if(path.startsWith('coach_alerts?'))return [];
        return [{id:'alert'}];
    };
    const result=await policy.delegateInbound(fixture().thread,query);
    assert.equal(result.alert_id,'alert');assert.equal(result.source_message_id,'m');
    assert.equal(calls[2].options.body.suggested_message,null);
    assert.equal(calls[2].options.body.data.reply_owner,'codex_conversation_operator');
    assert.equal(calls.filter(c=>c.options?.method==='POST').length,1);
});
test('existing manual alert and answered thread are never rewritten by delegation',async()=>{
    let writes=0;
    const existing=await policy.delegateInbound(fixture().thread,async(path,options)=>{
        if(options)writes++;
        return path.startsWith('ig_messages')?[{id:'m',direction:'in',manychat_message_id:'graph:m'}]:[{id:'held',status:'pending',data:{needs_you_required:true}}];
    });
    assert.equal(existing.alert_id,'held');assert.equal(writes,0);
    const answered=await policy.delegateInbound(fixture().thread,async()=>[{id:'out',direction:'out'}]);
    assert.equal(answered.delegated,false);
});
