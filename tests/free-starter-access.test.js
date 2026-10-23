const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
function storage() { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (k,v) => values.set(k,String(v)), removeItem: key => values.delete(key) }; }
function client(reply, token) {
    const sessionStorage = storage(), localStorage = storage();
    if (token) sessionStorage.setItem('pbb_free_starter_invite',token);
    const window = { sessionStorage, localStorage, currentUser: {id:'jessie'}, document: { addEventListener(){}, querySelector(){return null;},getElementById(){return null;} }, fetch: async () => reply };
    vm.runInNewContext(read('lib/free-starter.js'), {window});
    return window;
}
test('only a server-confirmed grant unlocks the starter, and switching accounts removes it', async () => {
    const w = client({ok:true,json:async()=>({starter:{id:'grant',workoutsReady:false,workoutLimit:2}})},'x'.repeat(43));
    assert.equal(w.BalanceFreeStarter.active(),false);
    await w.BalanceFreeStarter.resolve({user:{id:'jessie'},access_token:'test'});
    assert.equal(w.BalanceFreeStarter.active(),true);
    assert.equal(w.BalanceFreeStarter.canStartWorkout(),false);
    assert.equal(w.sessionStorage.getItem('pbb_free_starter_invite'),null);
    assert.equal(w.localStorage.getItem('subscription_status'),null);
    w.currentUser = {id:'another-person'};
    assert.equal(w.BalanceFreeStarter.active(),false);
});
test('invalid or unavailable invitations never unlock access and remain retryable', async () => {
    const w=client({ok:false,json:async()=>({error:'Invitation unavailable'})},'x'.repeat(43));
    await assert.rejects(w.BalanceFreeStarter.resolve({user:{id:'jessie'},access_token:'test'}));
    assert.equal(w.BalanceFreeStarter.active(),false);
    assert.equal(w.BalanceFreeStarter.needsRetry('jessie'),true);
});
test('returning accounts restore access without needing the invitation again', async () => {
    const w=client({ok:true,json:async()=>({starter:{id:'grant',workoutsReady:true,workoutLimit:2}})});
    await w.BalanceFreeStarter.resolve({user:{id:'jessie'},access_token:'test'});
    assert.equal(w.BalanceFreeStarter.active(),true);
    assert.equal(w.BalanceFreeStarter.canStartWorkout(),true);
    assert.equal(w.BalanceFreeStarter.needsRetry('jessie'),true);
});
test('ordinary accounts get no starter rules',async()=>{
    const w=client({ok:true,json:async()=>({starter:null})});
    await w.BalanceFreeStarter.resolve({user:{id:'jessie'},access_token:'test'});
    assert.equal(w.BalanceFreeStarter.active(),false);
    assert.equal(w.BalanceFreeStarter.canStartWorkout(),true);
});
function endpoint({authOk=true, anonymous=false, rows=[], queryError=false}={}) {
    const calls=[];
    const exports={};
    vm.runInNewContext(read('netlify/functions/free-starter-access.js'),{
        exports, process:{env:{SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only'}},
        require:name=>name==='node:crypto'?require(name):{supabaseQuery:async(...args)=>{calls.push(args);if(queryError)throw Error('conflict');return rows;}},
        fetch:async()=>({ok:authOk,json:async()=>({id:'verified-user',is_anonymous:anonymous})})
    });
    return {handler:exports.handler,calls};
}
test('claim binds to the verified identity, hashes the secret, and ignores a supplied user id',async()=>{
    const e=endpoint({rows:[{id:'grant',workout_limit:2,workouts_ready:false}]});
    const token='x'.repeat(43);
    const r=await e.handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({token,user_id:'attacker'})});
    assert.equal(r.statusCode,200);
    assert.equal(e.calls[0][1].body.p_user_id,'verified-user');
    assert.equal(e.calls[0][1].body.p_token_hash,require('node:crypto').createHash('sha256').update(token).digest('hex'));
    assert.equal(r.body.includes(token),false);
    assert.equal(r.body.includes('token_hash'),false);
});
test('anonymous, missing-auth, malformed and conflicting claims fail without granting access',async()=>{
    const event={httpMethod:'POST',headers:{authorization:'Bearer test'},body:'{"token":"invalid"}'};
    for(const options of [{authOk:false},{anonymous:true}]) assert.equal((await endpoint(options).handler(event)).statusCode,401);
    assert.equal((await endpoint().handler({...event,headers:{}})).statusCode,401);
    assert.equal((await endpoint().handler(event)).statusCode,400);
    assert.equal((await endpoint({queryError:true}).handler({...event,body:JSON.stringify({token:'x'.repeat(43)})})).statusCode,409);
});
test('lesson handoff reaches Home even if progress persistence or an intermediate view fails',async()=>{
    const source=read('js/dashboard/pbb-social-journey.js');
    const body=source.slice(source.indexOf('  async function completeFirstCourseLesson()'),source.indexOf('  function showWelcome()',source.indexOf('  async function completeFirstCourseLesson()')));
    for(const fails of [false,true]) {
        const events=[];
        const context={window:{switchAppTab:tab=>events.push(tab)},sessionStorage:storage(),clearTimeout(){},setTimeout:fn=>fn(),document:{getElementById:()=>null},console:{warn(){}},closeJourney:()=>events.push('close'),renderCard(){},showToast(){},showGoals:async options=>{assert.equal(options.render,false);if(fails)throw Error('save error');return true;}};
        vm.runInNewContext(body+'\nthis.run=completeFirstCourseLesson;',context);
        await context.run();
        assert.deepEqual(events,['close','dashboard']);
    }
});
