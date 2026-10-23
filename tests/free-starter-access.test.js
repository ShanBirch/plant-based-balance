const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
test('the actual first lesson supplies the eight questions required by the guarded completion API',()=>{
    const source=read('lib/learning-inline.js');
    const first=source.indexOf("id: 'mind-1-1', unitId:");
    const next=source.indexOf("id: 'mind-1-2', unitId:",first);
    const start=source.lastIndexOf('            {',first);
    const end=source.lastIndexOf('            },',next);
    const lesson=new Function('GAME_TYPES','LEARNING_IMAGES','return ('+source.slice(start,end)+'            });')(new Proxy({},{get:(_,key)=>key}),new Proxy({},{get:()=>''}));
    assert.equal(lesson.id,'mind-1-1');
    assert.equal(lesson.games.length,8);
    assert.ok(lesson.games.every(game=>game.type));
});
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
function endpoint({authOk=true, anonymous=false, rows=[], profiles=[], queryError=false}={}) {
    const calls=[];
    const exports={};
    vm.runInNewContext(read('netlify/functions/free-starter-access.js'),{
        exports, process:{env:{SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-only'}},
        require:name=>name==='node:crypto'?require(name):{supabaseQuery:async(...args)=>{calls.push(args);if(queryError)throw Error('conflict');return args[0].startsWith('users?') ? profiles : rows;}},
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
test('a paid member keeps normal paid access instead of being limited to the starter',async()=>{
    const e=endpoint({rows:[{id:'grant',workout_limit:2}],profiles:[{subscription_status:'active'}]});
    const r=await e.handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:'{}'});
    assert.deepEqual(JSON.parse(r.body),{starter:null,alreadyMember:true});
});
test('starter Home actions describe the free offer without changing ordinary member actions',async()=>{
    const w=client({ok:true,json:async()=>({starter:{id:'grant',workoutsReady:false}})});
    const action={id:'coach_checkin_intro',title:'Paid coaching',body:'Weekly review',action:()=>{throw Error('must not open paid explainer');}};
    assert.equal(w.BalanceFreeStarter.adaptAction(action),action);
    await w.BalanceFreeStarter.resolve({user:{id:'jessie'},access_token:'test'});
    const adapted=w.BalanceFreeStarter.adaptAction(action);
    assert.equal(adapted.title,'What your free starter includes');
    assert.match(adapted.body,/not included/);
    adapted.action();
    assert.equal(action.title,'Paid coaching');
});
test('pending workout review keeps course steps but removes gates requiring an exercise programme',()=>{
    const source=read('dashboard.html');
    const start=source.indexOf('  function requiredOnboardingTourSteps()');
    const end=source.indexOf('\n  steps.push',start);
    const context={window:{BalanceFreeStarter:{active:()=>true,reviewPending:()=>true}},REQUIRED_ONBOARDING_TOUR_TITLES:['Check your workout week','Exercise','First lesson','Weekly goals'],findTourStep:title=>({title,workoutEducation:title==='Exercise'})};
    vm.runInNewContext(source.slice(start,end)+'\nthis.run=requiredOnboardingTourSteps;',context);
    const steps=context.run();
    assert.deepEqual(Array.from(steps,step=>step.title),['Your two free workouts','First lesson','Weekly goals']);
    assert.equal(steps.some(step=>step.workoutEducation||step.requiresWorkoutBrowse),false);
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
