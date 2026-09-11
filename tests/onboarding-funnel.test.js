const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalize } = require('../lib/onboarding-funnel');
const { handler, summarize } = require('../netlify/functions/onboarding-progress');
const base = () => ({ event_id:'event-12345678',visitor_id:'visitor-12345678',session_id:'session-12345678',phase:'question',step:'why_now',status:'viewed',flow:'preview' });
const row = (visitor, step, status, extra = {}) => ({ visitor_id:visitor,created_at:'2026-09-11T01:00:00Z',duration_ms:10000,utm_source:'meta',utm_campaign:'launch',metadata:{phase:'question',step,status,mode:'setup',flow:'preview',last_touch:{utm_medium:'paid_social',ad_id:'ad123'},...extra} });

test('only operational metadata survives normalization', () => {
    const data = normalize({...base(),answers:'secret health answer',email:'private@example.com',user_id:'spoof',first_touch:{utm_campaign:'launch',answer:'private'},duration_ms:Infinity});
    assert.equal(data.answers,undefined); assert.equal(data.email,undefined); assert.equal(data.user_id,undefined);
    assert.deepEqual(data.first_touch,{utm_campaign:'launch'});
    assert.equal(data.duration_ms,3600000);
    assert.equal(normalize({...base(),phase:'invented'}),null);
});
test('report deduplicates repeat views and connects anonymous progress to the signed-in account', () => {
    const rows=[row('browser1','why_now','viewed'),row('browser1','why_now','viewed'),row('browser1','why_now','completed',{user_id:'account1'}),row('browser2','setup','completed',{phase:'setup',user_id:'account1'})];
    const report=summarize(rows,Date.parse('2026-09-12T12:00:00Z'),'paid');
    assert.equal(report.visitors,1); assert.equal(report.completed,1); assert.equal(report.quiet,0);
    const step=report.steps.find(step=>step.step==='why_now'); assert.equal(step.reached,1); assert.equal(step.completed,1);
});
test('test browsers stay excluded and organic activity does not become paid activity', () => {
    const rows=[row('test','intro','viewed'),row('test','name','viewed',{test_mode:true,user_id:'test-user'}),row('real','intro','viewed'),row('organic','intro','viewed',{last_touch:{}})];
    assert.equal(summarize(rows,Date.now(),'paid').visitors,1);
    assert.equal(summarize(rows).visitors,2);
});
test('late arrival does not overwrite last observed step; skips are not completions', () => {
    const rows=[row('real','first','viewed',{occurred_at:'2026-09-11T00:00:00Z'}),row('real','second','viewed',{occurred_at:'2026-09-11T00:01:00Z'}),row('real','first','completed',{occurred_at:'2026-09-11T00:00:30Z'}),row('real','second','skipped',{occurred_at:'2026-09-11T00:02:00Z'})];
    const result=summarize(rows,Date.parse('2026-09-13T00:00:00Z'));
    assert.equal(result.steps.find(step=>step.step==='second').last,1);
    assert.equal(result.steps.find(step=>step.step==='second').completed,0);
    assert.equal(result.quiet,1);
});

test('browser tracker handles rerenders, backward navigation, attribution and blocked storage', async () => {
    const calls=[]; const events={}; let seq=0;
    const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
    const window={document:{},location:{pathname:'/dashboard.html',search:'?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch'},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},localStorage:storage,sessionStorage:storage,addEventListener:(type,fn)=>events[type]=fn,setTimeout:()=>{},fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};}};
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/onboarding-funnel'),'utf8'),{window,URLSearchParams,Date});
    const track=window.BalanceOnboardingFunnel.track;
    track('question','name','viewed');track('question','name','viewed');track('question','name','completed');track('question','age','viewed');
    events.pagehide(); await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.filter(event=>event.step==='name'&&event.status==='viewed').length,1);
    assert.equal(calls.at(-1).step,'age'); assert.equal(calls.at(-1).status,'left');
    assert.equal(calls[0].last_touch.utm_campaign,'launch');
    assert.equal(new Set(calls.map(event=>event.visitor_id)).size,1);
});

test('report requires server-verified admin; public event cannot spoof an account or store answers', async () => {
    const oldFetch=global.fetch; const oldUrl=process.env.SUPABASE_URL;const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
    const requests=[];
    global.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>null};};
    try {
        assert.equal((await handler({httpMethod:'GET',headers:{}})).statusCode,401);
        assert.equal(requests.length,0);
        const result=await handler({httpMethod:'POST',headers:{},body:JSON.stringify({...base(),user_id:'spoof',answers:'private'})});
        assert.equal(result.statusCode,200);
        const stored=JSON.parse(requests[0].options.body);assert.equal(stored.metadata.user_id,null);assert.equal(stored.metadata.answers,undefined);
        global.fetch=async()=>({ok:true,json:async()=>({id:'not-admin',email:'someone@example.com',user_metadata:{is_admin:true}})});
        assert.equal((await handler({httpMethod:'GET',headers:{Authorization:'Bearer valid-session'}})).statusCode,403);
        global.fetch=async()=>({ok:false,status:503,json:async()=>({code:'db-down'})});
        assert.equal((await handler({httpMethod:'POST',headers:{},body:JSON.stringify(base())})).statusCode,503);
        global.fetch=async()=>({ok:false,status:409,json:async()=>({code:'23505'})});
        assert.equal((await handler({httpMethod:'POST',headers:{},body:JSON.stringify(base())})).statusCode,200);
    } finally {global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});

test('signed ad handoff resolves canonical ad identifiers without persisting its token', async () => {
    const oldFetch=global.fetch, oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
    const {createMetaAppPreviewRef}=require('../netlify/functions/_lib/meta-app-preview-ref');
    const ref=createMetaAppPreviewRef('11111111-1111-4111-8111-111111111111');
    let stored;
    global.fetch=async(url,options)=>({ok:true,json:async()=>{
        if(url.includes('/ig_threads?'))return [{id:'11111111-1111-4111-8111-111111111111',custom_data:{meta_ad_attribution:{source:'meta_ads',ad_id:'123',campaign_id:'456'}}}];
        stored=JSON.parse(options.body);return null;
    }});
    try {
        const result=await handler({httpMethod:'POST',headers:{},body:JSON.stringify({...base(),meta_ref:ref})});
        assert.equal(result.statusCode,200);assert.equal(stored.metadata.verified_paid_meta,true);
        assert.equal(stored.metadata.last_touch.ad_id,'123');assert.equal(stored.utm_campaign,'456');
        assert.equal(stored.metadata.meta_ref,undefined);assert.equal(stored.metadata.user_id,null);
    }finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;}
});
