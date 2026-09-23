const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashCode, recordPairingProof } = require('../netlify/functions/_lib/messenger-review-pairing');
const { createReviewHandler } = require('../netlify/functions/_lib/messenger-review');
const invite = '1'.repeat(64), page = '561122130919678';
const tid = 'a5b1ef87-3eeb-45c0-a3d9-22ea8c94eaf1';
const start = Date.parse('2026-09-23T11:00:00Z');

function fixture() {
    let now = start;
    const grants = new Map([[`messenger_review_${hashCode(invite)}`, JSON.stringify({kind:'invitation',enabled:true,page_id:page,expires_at:'2027-09-24T00:00:00Z'})]]);
    const messages = [], paths = [], threads = new Map();
    const query = async (path, options={}) => {
        paths.push(path);
        const [table, params] = path.split('?'), p = new URLSearchParams(params);
        if (table === 'app_private_secrets') {
            if (options.method === 'POST') {
                assert.equal(grants.has(options.body.key), false); grants.set(options.body.key,options.body.value); return [options.body];
            }
            const key = p.get('key').slice(3), value = grants.get(key);
            if (options.method === 'PATCH') {
                assert.match(p.get('value'), /^in\.\(".*"\)$/);
                const expected = JSON.parse(p.get('value').slice(4,-1));
                if (value !== expected) return [];
                grants.set(key, options.body.value); return [options.body];
            }
            return value ? [{value}] : [];
        }
        if (table === 'ig_threads') return threads.has(p.get('id').slice(3)) ? [threads.get(p.get('id').slice(3))] : [];
        if (table === 'ig_messages') {
            if (p.has('text')) return messages.filter(m=>m.text===p.get('text').slice(3)); // Other checks must also be enforced by handler.
            const since = Date.parse(p.get('created_at').slice(4));
            return messages.filter(m=>m.thread_id===p.get('thread_id').slice(3) && Date.parse(m.created_at)>=since).reverse();
        }
        if (table === 'coach_alerts') return [];
        throw Error('Unexpected query');
    };
    const handler=createReviewHandler({query,now:()=>now,send:async()=>{throw Error('No send expected');}});
    const call=async(code,body={action:'open'})=>{
        const response=await handler(new Request('https://plantbased-balance.org/.netlify/functions/messenger-review',{method:'POST',headers:{Authorization:`Bearer ${code}`},body:JSON.stringify(body)}));
        return {status:response.status,data:await response.json()};
    };
    const inbound=(text, changes={})=>{
        now+=1000;
        const m={thread_id:tid,source:'facebook_messenger',direction:'in',text,created_at:new Date(now).toISOString(),...changes};
        messages.push(m);
        threads.set(m.thread_id,{id:m.thread_id,channel:'messenger',subscriber_id:`fb_graph:${page}:12345`,linked_user_id:null,custom_data:{facebook_messenger:{page_id:page,psid:'12345'}},last_inbound_at:m.created_at});
        return m;
    };
    const proof=(phrase,change={})=>grants.set(`messenger_review_proof_${hashCode(phrase)}`,JSON.stringify({source:'facebook_messenger_verified',thread_id:tid,page_id:page,psid:'12345',at:new Date(now).toISOString(),...change}));
    const changeGrant=(code,change)=>{const key=`messenger_review_${hashCode(code)}`;grants.set(key,JSON.stringify({...JSON.parse(grants.get(key)),...change}));};
    return {call,inbound,proof,grants,messages,paths,threads,changeGrant,tick:ms=>{now+=ms;}};
}

test('invitation cannot read messages; each open gets an independent short session',async()=>{
    const f=fixture();
    assert.equal((await f.call(invite,{action:'read'})).status,400);
    const a=await f.call(invite),b=await f.call(invite);
    assert.equal(a.status,200);assert.equal(a.data.phase,'pair');
    assert.notEqual(a.data.sessionCode,b.data.sessionCode);assert.notEqual(a.data.challenge,b.data.challenge);
    assert.match(a.data.sessionCode,/^[a-f0-9]{64}$/);assert.match(a.data.challenge,/^BALANCE REVIEW [a-f0-9]{32}$/);
    assert.equal(f.paths.some(p=>p.startsWith('ig_')),false);
    assert.equal([...f.grants.values()].some(v=>v.includes(a.data.sessionCode)),false);
});

test('pairing requires exact verified inbound, then exposes only subsequent own messages',async()=>{
    const f=fixture(),s=(await f.call(invite)).data;
    f.inbound('Private older message');
    assert.equal((await f.call(s.sessionCode,{action:'pair'})).data.phase,'pair');
    const match=f.inbound(s.challenge);
    assert.equal((await f.call(s.sessionCode,{action:'pair'})).data.phase,'pair','a spoofed ordinary message row is not pairing proof');
    f.proof(s.challenge);
    assert.equal((await f.call(s.sessionCode,{action:'send',text:'hello'})).status,409);
    assert.equal((await f.call(s.sessionCode,{action:'pair'})).data.phase,'connected');
    f.tick(1);
    assert.deepEqual((await f.call(s.sessionCode,{action:'read'})).data.messages,[]);
    f.inbound('My review question');
    f.inbound('Someone else', {thread_id:'11111111-1111-1111-1111-111111111111'});
    const read=await f.call(s.sessionCode,{action:'read'});
    assert.deepEqual(read.data.messages.map(m=>m.text),['My review question']);
    assert.equal(JSON.stringify(read.data).includes(s.challenge),false);
    assert.equal(JSON.stringify(read.data).includes(tid),false);
    const g=JSON.parse(f.grants.get(`messenger_review_${hashCode(s.sessionCode)}`));
    assert.equal(Date.parse(g.since),Date.parse(match.created_at)+1);
});

test('wrong proof source, old/future timestamps and wrong Page cannot bind',async()=>{
    for(const change of [{source:'instagram_graph'},{page_id:'999'},{at:new Date(start-1000).toISOString()},{at:new Date(start+3600000).toISOString()}]){
        const f=fixture(),s=(await f.call(invite)).data;f.inbound(s.challenge);f.proof(s.challenge,change);
        assert.equal((await f.call(s.sessionCode,{action:'pair'})).status,409);
    }
    for(const mode of ['wrongPsid','wrongPage','linked']){
        const f=fixture(),s=(await f.call(invite)).data;f.inbound(s.challenge);f.proof(s.challenge);
        if(mode==='wrongPsid')f.threads.get(tid).custom_data.facebook_messenger.psid='999';
        if(mode==='wrongPage')f.threads.get(tid).custom_data.facebook_messenger.page_id='999';
        if(mode==='linked')f.threads.get(tid).linked_user_id='client';
        assert.ok([403,409].includes((await f.call(s.sessionCode,{action:'pair'})).status));
    }
});

test('pairing expires in 30 minutes and existing sessions respect parent revocation',async()=>{
    const f=fixture(),s=(await f.call(invite)).data;
    f.tick(30*60000);assert.equal((await f.call(s.sessionCode,{action:'pair'})).status,403);
    const g=fixture(),t=(await g.call(invite)).data;g.inbound(t.challenge);
    g.proof(t.challenge);
    await g.call(t.sessionCode,{action:'pair'});g.tick(1);g.changeGrant(invite,{enabled:false});
    assert.equal((await g.call(t.sessionCode,{action:'read'})).status,403);
    g.changeGrant(invite,{enabled:true});g.tick(2*3600000);
    assert.equal((await g.call(t.sessionCode,{action:'read'})).status,403);
});

test('client-selected identities and cross-session pairing cannot bypass possession',async()=>{
    const f=fixture(),a=(await f.call(invite)).data,b=(await f.call(invite)).data;
    f.inbound(a.challenge);
    f.proof(a.challenge);
    assert.equal((await f.call(b.sessionCode,{action:'pair'})).data.phase,'pair');
    for(const key of ['thread_id','psid','page_id','challenge']) assert.equal((await f.call(a.sessionCode,{action:'pair',[key]:'forged'})).status,400);
});

test('simultaneous opens use compare-and-swap and daily session cap is enforced',async()=>{
    const f=fixture();
    const results=await Promise.all([f.call(invite),f.call(invite)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    f.changeGrant(invite,{session_day:'2026-09-23',session_count:20});
    assert.equal((await f.call(invite)).status,429);
});

test('simultaneous pairing cannot overwrite a binding, and later client linking revokes read',async()=>{
    const f=fixture(),s=(await f.call(invite)).data;f.inbound(s.challenge);
    f.proof(s.challenge);
    const results=await Promise.all([f.call(s.sessionCode,{action:'pair'}),f.call(s.sessionCode,{action:'pair'})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    f.tick(1);f.threads.get(tid).linked_user_id='client';
    assert.equal((await f.call(s.sessionCode,{action:'read'})).status,403);
});

test('proof writer ignores echoes and ordinary text and never overwrites first signed receipt',async()=>{
    const e={direction:'in',text:'BALANCE REVIEW '+ 'f'.repeat(32),pageId:page,psid:'12345',at:new Date(start).toISOString()};
    let value=JSON.stringify({phase:'waiting',page_id:page,since:e.at,expires_at:new Date(start+30000).toISOString()}),writes=0;
    const query=async(path,o={})=>{
        if(!o.method)return [{value}];
        assert.equal(o.method,'PATCH');
        assert.equal(JSON.parse(new URLSearchParams(path.split('?')[1]).get('value').slice(4,-1)),value);
        value=o.body.value;writes++;return [{value}];
    };
    assert.equal(await recordPairingProof({...e,direction:'out'},{id:tid},query,start),false);
    assert.equal(await recordPairingProof({...e,text:'Hello'},{id:tid},query,start),false);
    await recordPairingProof(e,{id:tid},query,start);
    await recordPairingProof({...e,psid:'999'},{id:'other'},query,start);
    assert.equal(writes,1);assert.equal(JSON.parse(value).psid,'12345');
    assert.equal(await recordPairingProof(e,{id:tid},async()=>[],start),true,'unknown phrase is ignored without allocating a proof');
});
