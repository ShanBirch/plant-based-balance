const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const privacy = require('../lib/telemetry-privacy');
const source = fs.readFileSync('js/dashboard/pbb-app-telemetry.js', 'utf8');
function harness({ storage = new Map(), fetcher = async () => ({status:200}), uncertain = false } = {}) {
  const listeners = {}, docListeners = {}, timers = new Map(), storedRows = new Map(), calls = [];
  let timerId = 0, fail = uncertain, marks = 0;
  const sessionStorage = { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
  const window = {
    BalanceTelemetryPrivacy: privacy, crypto: { randomUUID }, sessionStorage,
    location: { href: 'https://plantbased-balance.org/dashboard.html', origin: 'https://plantbased-balance.org', pathname: '/dashboard.html' },
    navigator: { onLine:true, userAgent:'iPhone Instagram' },
    console: { error() {} },
    currentUser: { id:'member-a' },
    addEventListener: (name, fn, capture) => { listeners[name] = fn; if (name==='error') assert.equal(capture,true); },
    BalanceReplay: { getSessionId: () => 'replay-a', markError: () => marks++ },
    getBalanceAppUsageTrackerState: () => ({sessionId:'usage-a'}),
    fetch: function (...args) { calls.push(args); return fetcher(...args); },
    supabaseClient: { from: () => ({ upsert: async (rows, options) => {
      assert.deepEqual(JSON.parse(JSON.stringify(options)), {onConflict:'id',ignoreDuplicates:true});
      for (const row of rows) if (!storedRows.has(row.id)) storedRows.set(row.id,JSON.parse(JSON.stringify(row)));
      if (fail) { fail=false; throw new Error('uncertain receipt'); }
      return {};
    } }) }
  };
  const document = { readyState:'loading', visibilityState:'visible', querySelectorAll:()=>[], querySelector:()=>({content:'a'.repeat(40)}),
    addEventListener: (name,fn)=>docListeners[name]=fn };
  vm.runInNewContext(source,{window,document,URL,sessionStorage,MutationObserver:class{},console:{warn(){}},
    setInterval(){},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
  return {window,listeners,docListeners,timers,storage,calls,rows:()=>[...storedRows.values()],errors:()=>[...storedRows.values()].filter(r=>r.activity_type==='app_client_error'),marks:()=>marks};
}
test('failed API response keeps original response/body and request arguments while recording endpoint/status',async()=>{
  const response={status:500, privateBody:'PRIVATE_BODY'}, options={method:'POST',body:'PRIVATE_REQUEST'};
  const h=harness({fetcher:async()=>response});
  assert.equal(await h.window.fetch('/.netlify/functions/save-workout?email=PRIVATE_EMAIL',options),response);
  assert.equal(h.calls[0][1],options);
  await h.window.flushBalanceActivity();
  const data=h.errors()[0].activity_data;
  assert.equal(data.error_kind,'http'); assert.equal(data.operation,'function:save-workout'); assert.equal(data.status,500);
  assert.equal(data.diagnostic.release,'a'.repeat(40)); assert.equal(h.marks(),1);
  assert.doesNotMatch(JSON.stringify(h.rows()),/PRIVATE_|email/);
});
test('rejections preserve the same error, ignore intentional aborts, and skip our own diagnostics requests',async()=>{
  const failure=new TypeError('PRIVATE_CLIENT_TEXT');
  const h=harness({fetcher:()=>Promise.reject(failure)});
  await assert.rejects(h.window.fetch('https://hzapaorxqboevxnumxkv.supabase.co/storage/v1/object/PRIVATE_FILE'),e=>e===failure);
  failure.name='AbortError';
  await assert.rejects(h.window.fetch('/.netlify/functions/cancel'),e=>e===failure);
  await assert.rejects(h.window.fetch('https://hzapaorxqboevxnumxkv.supabase.co/rest/v1/user_activity?select=PRIVATE'),e=>e===failure);
  await h.window.flushBalanceActivity();
  assert.equal(h.errors().length,1); assert.equal(h.errors()[0].activity_data.operation,'storage');
  assert.doesNotMatch(JSON.stringify(h.rows()),/PRIVATE/);
});
test('pending request emits a slow signal without aborting it; successful requests do not emit errors',async()=>{
  let resolve;
  const h=harness({fetcher:()=>new Promise(r=>resolve=r)});
  const promise=h.window.fetch('/.netlify/functions/generate-plan');
  [...h.timers.values()].find(t=>t.ms===15000).fn();
  const response={status:200};resolve(response);assert.equal(await promise,response);
  await h.window.flushBalanceActivity();
  assert.deepEqual(h.errors().map(r=>r.activity_data.error_kind),['slow_request']);
  assert.equal([...h.timers.values()].some(t=>t.ms===15000),false);
});
test('resources, explicit caught failures and logged Errors have grouped metadata without raw content',async()=>{
  const h=harness();
  h.listeners.error({target:{tagName:'IMG',src:'https://private.example/PRIVATE_MEDIA?key=PRIVATE'}});
  h.window.reportBalanceAppError('save_workout',new Error('PRIVATE_HEALTH'),{code:'23505',notes:'PRIVATE_NOTES'});
  h.window.console.error('PRIVATE_PREFIX',new Error('PRIVATE_LOG'),{email:'PRIVATE_EMAIL'});
  await h.window.flushBalanceActivity();
  assert.deepEqual(h.errors().map(r=>r.activity_data.error_kind),['resource','handled','logged']);
  assert.ok(h.errors().every(r=>r.activity_data.issue_key.startsWith('issue-')));
  assert.doesNotMatch(JSON.stringify(h.rows()),/PRIVATE/);
});
test('control breadcrumbs never read labels, values or text and offline state reaches the report',async()=>{
  const h=harness();h.window.navigator.onLine=false;
  const element={id:'workout-save',tagName:'BUTTON',closest:()=>null,getAttribute:name=>name==='onclick'?'finishWorkout()':'PRIVATE_LABEL',textContent:'PRIVATE_TEXT',value:'PRIVATE_VALUE'};
  h.docListeners.click({target:{closest:()=>element}});
  h.listeners.offline();h.window.reportBalanceAppError('finish_workout',new Error('PRIVATE_ERROR'));
  await h.window.flushBalanceActivity();
  const data=h.errors()[0].activity_data;
  assert.equal(data.diagnostic.online,false); assert.match(data.diagnostic.trail[0],/finishworkout/);
  assert.doesNotMatch(JSON.stringify(data),/PRIVATE/);
});
test('failed-upload queue survives refresh for the same member and keeps one row after an uncertain receipt',async()=>{
  const h=harness({uncertain:true});h.window.reportBalanceAppError('save_workout',new Error());
  await h.window.flushBalanceActivity();
  const first=h.errors()[0].id;
  await h.window.flushBalanceActivity(); assert.equal(h.errors().length,1);assert.equal(h.errors()[0].id,first);
  const stored=JSON.parse(h.storage.get('pbb_app_errors_v2'));assert.equal(stored.events.length,0);
  const offline=harness({storage:h.storage});offline.window.reportBalanceAppError('save_meal',new Error());
  const resumed=harness({storage:h.storage});await resumed.window.flushBalanceActivity();
  assert.equal(resumed.errors().length,1);assert.equal(resumed.errors()[0].activity_data.operation,'save_meal');
});
test('account switching cannot relabel pending errors and discards another members local queue',async()=>{
  const storage=new Map(), h=harness({storage});h.window.reportBalanceAppError('save_workout',new Error());
  h.window.currentUser={id:'member-b'};await h.window.flushBalanceActivity();assert.equal(h.errors().length,0);
  const original=harness({storage});original.window.reportBalanceAppError('save_meal',new Error());
  const other=harness({storage});other.window.currentUser={id:'member-b'};await other.window.flushBalanceActivity();
  assert.equal(other.errors().length,0);
});
test('repeat failures are deduplicated and a storm is bounded',async()=>{
  const h=harness();
  for(let i=0;i<60;i++) h.window.reportBalanceAppError('same_action',new Error());
  for(let i=0;i<60;i++) h.window.reportBalanceAppError('action_'+i,new Error());
  await h.window.flushBalanceActivity();await h.window.flushBalanceActivity();
  assert.equal(h.errors().length,30);
  assert.equal(h.errors().filter(r=>r.activity_data.operation==='same_action').length,1);
});

test('build stamp uses only a valid immutable revision and check mode never rewrites the page',()=>{
  const build=fs.readFileSync('scripts/build-offline-shell.cjs','utf8');
  const stamp=build.slice(build.indexOf('// Attach the immutable'),build.indexOf('const assets'));
  const run=(sha,args=[])=>{
    let wrote;
    vm.runInNewContext(stamp,{process:{argv:args,env:{COMMIT_REF:sha}},root:'.',path:{join:()=>''},fs:{readFileSync:()=>'<meta name="balance-build" content="development"/>',writeFileSync:(_,v)=>wrote=v}});
    return wrote;
  };
  assert.equal(run('1'.repeat(40)),'<meta name="balance-build" content="'+'1'.repeat(40)+'"/>');
  assert.equal(run('PRIVATE_BAD_VALUE'),undefined);
  assert.equal(run('1'.repeat(40),['--check']),undefined);
});


test('guest and admin-preview failures cannot carry into a later member session',async()=>{
  for (const flag of ['guestMode','isAdminViewing']) {
    const h=harness();h.window[flag]=true;
    h.window.reportBalanceAppError('preview_only',new Error());
    h.window[flag]=false;await h.window.flushBalanceActivity();
    assert.equal(h.errors().length,0);
  }
});
