const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function section(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j)}
const next=read('js/dashboard/pbb-next-obvious-steps.js');
test('guided welcome opens the collapsed course overview before choosing Week 1',()=>{
 const course={id:'balance-foundations',type:'foundations',isUnlocked:true,progress:{weekProgress:[{number:1}]}},calls=[];
 const c={window:{__balanceGuidedTourActive:true},learningState:{},getCourseById:()=>course,consumeCourseWelcomeRequirement(){},markCourseStarted(){},trackCourseEvent(){},pushLearningHistoryState(){},renderCourseDetail:()=>calls.push('overview'),renderFoundationsWeekPage:()=>calls.push('week')};
 vm.runInNewContext(section(read('lib/learning-inline.js'),'    window.startCourseFromWelcome = function','    window.toggleFoundationsWeek ='),c);
 c.window.startCourseFromWelcome(course.id);assert.deepEqual(calls,['overview']);assert.equal(c.learningState.expandedFoundationsWeekNumber,null);
 c.window.__balanceGuidedTourActive=false;c.window.startCourseFromWelcome(course.id);assert.deepEqual(calls,['overview','week']);
});
test('background progress updates preserve the welcome until the member starts or closes it',()=>{
 let welcome={},renders=0;
 const c={window:{},learningState:{userProgress:{},currentView:'courseDetail',activeCourseId:'balance-foundations'},document:{getElementById:id=>id==='course-welcome'?welcome:null},getCourseById:()=>({}),renderCourseDetail:()=>renders++};
 vm.runInNewContext(section(read('lib/learning-inline.js'),'    window.refreshLearningCourseHome = function()','    window.startCourseTopic ='),c);
 for(let i=0;i<5;i++)c.window.refreshLearningCourseHome();assert.equal(renders,0);
 welcome=null;c.window.refreshLearningCourseHome();assert.equal(renders,1);
});
function opener(overrides={}){
 const calls=[];const c={Promise,setTimeout,clearTimeout,window:{__balanceGuidedTourActive:true,_ensureLearningProgressLoaded:async()=>{},prepareBalanceFoundationsStartForTour:()=>calls.push('overview'),showToast:()=>calls.push('retry')},document:{getElementById:()=>({getClientRects:()=>[{}]})},ensureLearningSystemLoaded:async()=>true,switchTab:()=>true,isVisibleSelector:()=>true,markOnboardingStepSeen:()=>calls.push('seen'),setOnboardingStepComplete:()=>calls.push('incomplete'),...overrides};
 vm.runInNewContext(section(next,'  function openFoundationsTarget()','  function getNextCourseId()'),c);return {c,calls};
}
test('slow tab initialization finishes before opening Start and completing the Home card',async()=>{
 const {c,calls}=opener();let finish;c.window._learningInitPromise=new Promise(r=>finish=r);
 const pending=c.openFoundationsTarget();assert.equal(c.openFoundationsTarget(),pending);await Promise.resolve();assert.deepEqual(calls,[]);
 finish();assert.equal(await pending,true);assert.deepEqual(calls,['overview','seen']);
});
test('failed loads retain the Home course card and a later tap can recover',async()=>{
 const {c,calls}=opener({ensureLearningSystemLoaded:async()=>false});assert.equal(await c.openFoundationsTarget(),false);assert.deepEqual(calls,['incomplete','retry']);
 c.ensureLearningSystemLoaded=async()=>true;assert.equal(await c.openFoundationsTarget(),true);assert.deepEqual(calls.slice(-2),['overview','seen']);
});
test('a hidden or missing start button does not complete the Home card',async()=>{
 const {c,calls}=opener({document:{getElementById:()=>({getClientRects:()=>[]})}});assert.equal(await c.openFoundationsTarget(),false);assert.ok(!calls.includes('seen'));
});
test('repeated Course tab initialization shares one pending render and resets after failure',async()=>{
 let finish,count=0;const c={window:{},initializeLearningView:()=>{count++;return new Promise(r=>finish=r)}};
 vm.runInNewContext(section(read('lib/learning-inline.js'),'    function initLearning()','    async function initializeLearningView()'),c);
 const p=c.initLearning();assert.equal(c.initLearning(),p);assert.equal(count,1);finish();await p;assert.equal(c.window._learningInitPromise,null);
 c.initializeLearningView=()=>Promise.reject(Error('failed'));await assert.rejects(c.initLearning());assert.equal(c.window._learningInitPromise,null);
});
