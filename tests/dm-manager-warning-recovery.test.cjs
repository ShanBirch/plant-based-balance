const {test}=require('node:test');
const assert=require('node:assert/strict');
const context=require('../netlify/functions/_lib/client-context');
const calls=[];
let reviewVerdict='pass';
context.supabaseQuery=async (url,options)=>{calls.push({url,options});return options?.method==='PATCH'?[{id:'mazzie'}]:[];};
context.reviewDraftAndUpdateAlert=async ({draftText})=>{
    calls.push({reviewed:draftText});
    return {review:{verdict:reviewVerdict,confidence:0.95,issues:reviewVerdict==='pass'?[]:['Needs human judgment'],notification_required:false}};
};
context.callGeminiFallback=async ()=>{throw new Error('Deletion-only repair must not generate text');};
const m=require('../netlify/functions/client-lead-manager')._test;
const q=require('../netlify/functions/_lib/qualifier-engine');
function alert(){return {id:'mazzie',status:'pending',alert_type:'ig_incoming_dm',client_id:null,
    suggested_message:'Ahh damn, Paul missing out then 😣\nIf he changes his mind, I can help him lock in enough protein without the soy panic.',
    data:{channel:'instagram',ig_thread_id:'mazzie-thread',message_preview:'Sadly yeah, I don’t think Paul’s ready to join us 😣',
        qualifier:{commercial_stage:'buyer_intent'},draft_review:{verdict:'warn',confidence:0.74,notification_required:false,
        notification_reason:'none',context_loss_suspected:false,issues:['A concrete promise not grounded in the latest message.'],
        summary:'The soy/protein promise could be softened.',suggested_fix:'Soften the offer.'}}};}

test('negated readiness is not buyer intent, but a later real purchase request still is',()=>{
    assert.equal(q.hasDirectBuyerIntent(alert().data.message_preview),false);
    assert.equal(q.deriveCommercialStage({qualifier:{commercial_stage:'buyer_intent'},currentMessage:alert().data.message_preview}),'engaged');
    for(const text of ["I'm ready to join",'Can you send me the link?',"Paul isn't ready to join, but can you send me the link?"]) assert.equal(q.hasDirectBuyerIntent(text),true,text);
});
test('fresh messages get reserved capacity despite hundreds of old higher-ranked cards',()=>{
    const fresh=alert();
    const backlog=Array.from({length:501},(_,i)=>({...alert(),id:`old-${i}`,data:{...alert().data,message_preview:'How much? Send me the link?'}}));
    const selected=m.selectPendingDmAlerts([fresh],backlog,80);
    assert.equal(selected[0].id,'mazzie');assert.equal(selected.length,80);
    assert.equal(new Set(selected.map(a=>a.id)).size,80);
});
test('loader actually queries both the fresh and old ends of the queue',async()=>{
    calls.length=0;await m.loadPendingDmAlerts(80);
    assert(calls.some(c=>c.url.includes('order=created_at.desc,id.desc&limit=40')));
    assert(calls.some(c=>c.url.includes('order=created_at.asc')));
});
test('exact Mazzie warning gets deletion, a real review, then clean schedule eligibility',async()=>{
    calls.length=0;reviewVerdict='pass';const a=alert();
    assert.equal(m.shouldAttemptCleanLeadCloudRepair(a,m.classifyNeedsYou(a)),true);
    const result=await m.repairCleanLeadCloudDraft(a);
    assert.equal(result.accepted,true);
    assert.equal(result.alert.suggested_message,'Ahh damn, Paul missing out then 😣');
    assert(calls.some(c=>c.reviewed===result.alert.suggested_message));
    assert.equal(m.shouldAutoScheduleCleanLeadCloudFallback(result.alert,m.classifyNeedsYou(result.alert)),true);
});
test('failed second review cannot schedule the trimmed reaction',async()=>{
    reviewVerdict='block';const result=await m.repairCleanLeadCloudDraft(alert());
    assert.equal(result.accepted,false);
    assert.equal(m.shouldAutoScheduleCleanLeadCloudFallback(result.alert,m.classifyNeedsYou(result.alert)),false);
    reviewVerdict='pass';
});
test('manual, client, media, safety and real buying holds stay excluded',()=>{
    for(const patch of [{needs_you_required:true},{linked_user_id:'client'},{audio_url_count:1},{sales_moment:true},
        {message_preview:'Can you send me the checkout link?'},
        {draft_review:{...alert().data.draft_review,issues:['Medical advice is unsafe.']}}]){
        const a=alert();a.data={...a.data,...patch};
        assert.equal(m.shouldAttemptCleanLeadCloudRepair(a,m.classifyNeedsYou(a)),false,JSON.stringify(patch));
    }
});
