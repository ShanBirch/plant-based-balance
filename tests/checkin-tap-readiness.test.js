const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/dashboard/pbb-weekly-checkin-preview.js','utf8');
const part=source.slice(source.indexOf('  var openingPush = false;'),source.indexOf("  window.addEventListener('pbbCheckinPush'"));
function harness(){
 let timer,opened=0,overlay=false;
 const window={_pbbPendingCheckinPush:true,location:{search:'',href:'https://example.com/dashboard.html'},history:{state:null,replaceState(){}},switchAppTab(){}};
 const scope={window,URL,URLSearchParams,console, state:{loading:false,programStartKnown:true},
  getReviewUserId:()=>window.currentUser?.id,isGuidedTourActive:()=>false,
  syncProgramStartDate(){},maybeLoadSchedule:async()=>{},maybeLoadLiveData:async()=>{},
  hasCompletedFirstProgramWeek:()=>true,isWeeklyCheckinWindowOpen:()=>true,showToast(){},
  openWeeklyCheckinPreview:async()=>{opened++;overlay=true;},
  document:{getElementById:()=>overlay?{}:null},
  setTimeout:fn=>{timer=fn;return 1},clearTimeout:()=>{timer=null}
 };
 vm.createContext(scope);vm.runInContext(part,scope);
 return {scope,window,open:()=>scope.openCheckinFromPush(),retry:async()=>{const fn=timer;timer=null;fn();await new Promise(setImmediate)},opened:()=>opened};
}
test('tap before account/profile readiness survives without another ready event',async()=>{
 const h=harness();await h.open();assert.equal(h.opened(),0);
 h.window.currentUser={id:'member'};await h.retry();assert.equal(h.opened(),0);
 h.window.userProfile={};await h.retry();assert.equal(h.opened(),1);assert.equal(h.window._pbbPendingCheckinPush,false);
});
test('tap waits for in-flight profile promise',async()=>{
 const h=harness();h.window.currentUser={id:'member'};let resolve;
 h.window._pbbProfilePromise=new Promise(r=>resolve=r);const opening=h.open();assert.equal(h.opened(),0);
 h.window.userProfile={};resolve();await opening;assert.equal(h.opened(),1);
});
test('tap waits for existing live refresh and deduplicates concurrent events',async()=>{
 const h=harness();h.window.currentUser={id:'member'};h.window.userProfile={};h.scope.state.loading=true;
 await Promise.all([h.open(),h.open()]);assert.equal(h.opened(),0);assert.equal(h.window._pbbPendingCheckinPush,true);
 h.scope.state.loading=false;await h.retry();assert.equal(h.opened(),1);
});
