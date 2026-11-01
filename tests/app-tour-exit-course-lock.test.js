const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Settings exposes onboarding review but no app-tour replay or walkthrough reset',()=>{
 const source=fs.readFileSync('dashboard.html','utf8'),start=source.indexOf('<div class="settings-v2-tools">'),end=source.indexOf('</details>',start),settings=source.slice(start,end);
 assert.match(settings,/openOnboardingReview/);assert.doesNotMatch(settings,/replayFeatureTour|resetWalkthroughTestState|Replay app tour/);assert.doesNotMatch(source,/window\.replayFeatureTour =/);
});
test('course access stays locked until the current authenticated account is verified, including account switches',async()=>{
 let authId='old',result=false;const window={currentUser:{id:'new'},supabaseClient:{auth:{getSession:async()=>({data:{session:{user:{id:authId}}}})},rpc:async()=>({data:result})},addEventListener(){},dispatchEvent(){}};
 const document={addEventListener(){},getElementById:()=>null};vm.runInNewContext(fs.readFileSync('js/dashboard/pbb-course-access.js','utf8'),{window,document,CustomEvent:class{}});
 await window.BalanceCourseAccess.refresh();assert.equal(window.BalanceCourseAccess.locked(),true);authId='new';await window.BalanceCourseAccess.refresh();assert.equal(window.BalanceCourseAccess.locked(),false);window.currentUser={id:'other'};assert.equal(window.BalanceCourseAccess.locked(),true);
});
test('explicit tour exit cancels activation and preview modes before ordinary cleanup, without awarding completion',()=>{
 const html=fs.readFileSync('dashboard.html','utf8'),start=html.indexOf('window.exitAppTour = function(){'),end=html.indexOf('window.endFeatureTour = function',start),calls=[];
 const c={metaPreviewTour:true,clientActivationTour:true,courseFeatureTour:{},window:{__balancePendingClientActivation:true,BalanceOnboardingProgress:{dismissFirstRunTour:()=>calls.push('dismiss'),clear:()=>calls.push('clear')},BalanceMetaPreviewSoundtrack:{stop(){}},endFeatureTour:skipped=>calls.push(skipped)}};vm.runInNewContext(html.slice(start,end),c);c.window.exitAppTour();assert.equal(c.metaPreviewTour,false);assert.equal(c.clientActivationTour,false);assert.equal(c.window.__balancePendingClientActivation,false);assert.deepEqual(calls,['dismiss','clear',true]);
 assert.match(html,/id="app-tour-exit"[^>]*onclick="exitAppTour\(\)"/);assert.doesNotMatch(html,/if \(completedMetaPreviewTour && !skipped && !completedTourGates.has\('foundations-lesson/);
});
test('tour dismissal prevents automatic reopening without marking lessons or the tour complete',()=>{
 const m=new Map(),window={currentUser:{id:'new',created_at:'2026-11-01T00:00:00Z'},localStorage:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
 vm.runInNewContext(fs.readFileSync('lib/onboarding-progress.js','utf8'),{window});window.BalanceOnboardingProgress.dismissFirstRunTour();assert.equal(window.BalanceOnboardingProgress.needsFirstRunTour(),false);assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);assert.equal(window.currentUser.user_metadata.balance_app_tour_completed_at,undefined);
});
test('course catalogue and direct lessons use authoritative course access rather than quiz progress',()=>{
 const source=fs.readFileSync('lib/learning-inline.js','utf8');for(const name of ['startLesson','startFoundationsLesson','startDailyQuiz','openLearningModule','openLearningUnit','openBalanceFoundationsCourse','startLessonGames'])assert.match(source,new RegExp('window\\.'+name+' = function\\([^)]*\\) \\{\\s*if\\(window.BalanceCourseAccess'));
 const html=fs.readFileSync('dashboard.html','utf8');assert.match(html,/REQUIRED_ONBOARDING_TOUR_TITLES.map\(findTourStep\).filter\(step=>step&&step.tab!=='learning'\)/);
});
