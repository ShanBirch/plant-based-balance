const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function setup() {
  const handlers={}, entries=new Map(), writes=[];
  const key=r=>typeof r==='string'?r:r.url||r.href;
  const cache={async match(req,options){const url=key(req);return entries.get(url)||(options?.ignoreSearch?entries.get(url.split('?')[0]):undefined);},async put(req,r){writes.push(key(req));entries.set(key(req),r);}};
  let fetcher=async()=>new Response('fresh');
  let activated=false;
  const self={PBB_OFFLINE_ASSETS:['./dashboard.html','./app.js'],async skipWaiting(){activated=true;},location:{origin:'https://plantbased-balance.org',href:'https://plantbased-balance.org/sw.js'},addEventListener(n,fn){handlers[n]=fn;},clients:{async matchAll(){return[];}}};
  const context={self,URL,Request,Response,Headers,AbortController,setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,20)),clearTimeout,importScripts(){},caches:{async open(){return cache;}},fetch:(...args)=>fetcher(...args)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  return {entries,writes,get activated(){return activated;},async install(){let pending;handlers.install({waitUntil(p){pending=p;}});await pending;},setFetch(fn){fetcher=fn;},async request(url,options={}){let response;const waits=[];handlers.fetch({request:new Request(url,options),respondWith(p){response=p;},waitUntil(p){waits.push(p);}});const result=await response;await Promise.all(waits);return result;}};
}
test('incomplete update cannot replace the working worker',async()=>{
  const s=setup();s.setFetch(async url=>new Response('file',{status:url.pathname==='/app.js'?503:200}));
  await assert.rejects(s.install(),/Offline shell unavailable/);
  assert.equal(s.activated,false);
  const healthy=setup();await healthy.install();assert.equal(healthy.activated,true);
});
test('offline dashboard query uses shell; scripts require exact version',async()=>{
  const s=setup();s.setFetch(async()=>{throw Error('offline');});
  s.entries.set('https://plantbased-balance.org/dashboard.html',new Response('shell'));
  s.entries.set('https://plantbased-balance.org/app.js?v=1',new Response('old'));
  assert.equal(await (await s.request('https://plantbased-balance.org/dashboard.html?native_rev=1')).text(),'shell');
  await assert.rejects(s.request('https://plantbased-balance.org/app.js?v=2'),/offline/);
});
test('HTTP errors cannot poison the saved shell',async()=>{
  const s=setup();s.entries.set('https://plantbased-balance.org/dashboard.html',new Response('working'));
  s.setFetch(async()=>new Response('outage',{status:503}));
  assert.equal(await (await s.request('https://plantbased-balance.org/dashboard.html')).text(),'working');
  assert.equal(s.writes.length,0);
});
test('hanging network falls back within deadline',async()=>{
  const s=setup();s.entries.set('https://plantbased-balance.org/dashboard.html',new Response('working'));
  s.setFetch((req,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')))));
  assert.equal(await (await s.request('https://plantbased-balance.org/dashboard.html')).text(),'working');
});
test('API, POST and admin data never enter offline cache',async()=>{
  const s=setup();
  assert.equal(await s.request('https://hzapaorxqboevxnumxkv.supabase.co/rest/v1/users'),undefined);
  assert.equal(await s.request('https://plantbased-balance.org/.netlify/functions/anything'),undefined);
  assert.equal(await s.request('https://plantbased-balance.org/app.js',{method:'POST'}),undefined);
  await s.request('https://plantbased-balance.org/admin-dashboard.html');
  await s.request('https://plantbased-balance.org/dashboard.html?view_as=someone');
  assert.equal(s.writes.length,0);
});
test('offline reads skip the network and retain user-keyed data',async()=>{
  const source=fs.readFileSync(path.join(root,'lib/supabase.js'),'utf8').split('// GUARD:')[0];
  const storage=new Map();let called=false;
  const context={window:{},navigator:{onLine:false},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console};
  vm.runInNewContext(source,context);
  context.pbbWriteOfflineCache('current_workout',['member-a'],{title:'Saved workout'});
  assert.equal((await context.pbbCachedRead('current_workout',['member-a'],async()=>{called=true;})).title,'Saved workout');
  assert.equal(called,false);
  assert.equal(context.pbbReadOfflineCache('current_workout',['member-b']),null);
});
