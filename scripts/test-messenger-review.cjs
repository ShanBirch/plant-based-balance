const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReviewHandler } = require('../netlify/functions/_lib/messenger-review');
const code = 'a'.repeat(64), tid = 'a5b1ef87-3eeb-45c0-a3d9-22ea8c94eaf1';
const stamp = '2026-09-23T01:00:00Z', clock = Date.parse('2026-09-23T02:00:00Z');
function fixture(change = {}) {
    const grant = { enabled:true, thread_id:tid, page_id:'561122130919678', psid:'3259915884123945', since:'2026-09-23T00:00:00Z', expires_at:'2026-09-24T00:00:00Z', ...change.grant };
    const thread = { channel:'messenger', linked_user_id:null, subscriber_id:`fb_graph:${grant.page_id}:${grant.psid}`, custom_data:{facebook_messenger:{page_id:grant.page_id,psid:grant.psid}}, last_inbound_at:stamp, ...change.thread };
    const message = { id:'message1', direction:'in', text:'Test question', created_at:stamp, ...change.message };
    const alert = { id:'alert1', status:'pending', alert_type:'fb_incoming_dm', client_id:null, created_at:stamp, data:{ig_thread_id:tid,channel:'messenger',draft_text:'Test reply'}, ...change.alert };
    const paths=[], sends=[];
    const handler = createReviewHandler({ now:()=>clock, query:async path=>{
        paths.push(path);
        if (path.startsWith('app_private_secrets')) return change.missing ? [] : [{value:JSON.stringify(grant)}];
        if (path.startsWith('ig_threads')) return [thread];
        if (path.startsWith('ig_messages')) return [message];
        if (path.startsWith('coach_alerts')) return [alert];
        throw new Error('Unexpected query');
    }, send:async event=>{sends.push(JSON.parse(event.body)); return change.receipt || {statusCode:200,body:JSON.stringify({ok:true,delivery_transport:'facebook_messenger',chunks_sent:1,chunks_total:1})};} });
    const call = async (body={action:'read'},auth=code,extra={})=>handler(new Request('https://plantbased-balance.org/.netlify/functions/messenger-review',{method:'POST',headers:{Authorization:`Bearer ${auth}`,...extra},body:JSON.stringify(body)}));
    return {call,paths,sends};
}
test('unauthenticated and unknown grants cannot access data',async()=>{
    const f=fixture(); assert.equal((await f.call(undefined,'bad')).status,401); assert.equal(f.paths.length,0);
    const g=fixture({missing:true}); assert.equal((await g.call()).status,403); assert.equal(g.paths.length,1);
});
test('expired or disabled access fails closed',async()=>{
    for (const grant of [{enabled:false},{expires_at:stamp},{since:'2026-09-24T00:00:00Z'}]) assert.equal((await fixture({grant}).call()).status,403);
});
test('cross-site and client-selected identifiers rejected',async()=>{
    const f=fixture(); assert.equal((await f.call(undefined,code,{'sec-fetch-site':'cross-site'})).status,403);
    assert.equal((await f.call({action:'read',thread_id:'other'})).status,400);
});
test('linked clients and incorrect recipient routes rejected',async()=>{
    for(const thread of [{linked_user_id:'client'},{channel:'instagram'},{subscriber_id:'other'},{custom_data:{facebook_messenger:{page_id:'1',psid:'2'}}}]) assert.equal((await fixture({thread}).call()).status,403);
});
test('reads only fixed thread and date range without leaking capabilities',async()=>{
    const f=fixture(), r=await f.call(), data=await r.json(); assert.equal(r.status,200); assert.equal(data.canSend,true);
    assert.equal(JSON.stringify(data).includes('alert1'),false); assert.equal(JSON.stringify(data).includes(tid),false);
    assert.ok(f.paths.filter(p=>p.startsWith('ig_messages')||p.startsWith('coach_alerts')).every(p=>p.includes(tid)&&p.includes('created_at=gte.')));
    assert.equal(r.headers.get('cache-control'),'no-store');
});
test('window expiry, outbound latest, linked alert and outdated draft block sends',async()=>{
    for(const change of [{thread:{last_inbound_at:'2026-09-21T00:00:00Z'}},{message:{direction:'out'}},{alert:{client_id:'client'}},{message:{created_at:'2026-09-23T01:05:00Z'}}]) {
        const f=fixture(change), data=await (await f.call()).json(); assert.equal(data.canSend,false);
        assert.equal((await f.call({action:'send',revision:data.revision,text:'hello'})).status,409); assert.equal(f.sends.length,0);
    }
});
test('only valid current revision reaches guarded sender',async()=>{
    const f=fixture(), data=await (await f.call()).json();
    assert.equal((await f.call({action:'send',revision:'b'.repeat(64),text:'reply'})).status,409);
    assert.equal((await f.call({action:'send',revision:data.revision,text:'  Reviewed reply  '})).status,200);
    assert.deepEqual(f.sends.map(s=>[s.alertId,s.replyText,s.forceText]),[['alert1','Reviewed reply',true]]);
});
test('unconfirmed and partial delivery never claim success',async()=>{
    for(const body of [{ok:true},{ok:true,delivery_transport:'instagram_graph',chunks_sent:1,chunks_total:1},{ok:true,delivery_transport:'facebook_messenger',chunks_sent:1,chunks_total:2}]) {
        const f=fixture({receipt:{statusCode:200,body:JSON.stringify(body)}}), data=await (await f.call()).json();
        assert.equal((await f.call({action:'send',revision:data.revision,text:'reply'})).status,409);
    }
});
