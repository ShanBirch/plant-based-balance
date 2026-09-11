const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'(');const end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
function classes(initial=[]){const set=new Set(initial);return {contains:n=>set.has(n),toggle(n,on){on?set.add(n):set.delete(n)}};}
function style(){const data=new Map();return {setProperty:(n,v,p='')=>data.set(n,[v,p]),getPropertyValue:n=>data.get(n)?.[0]||'',getPropertyPriority:n=>data.get(n)?.[1]||'',removeProperty:n=>data.delete(n)};}
function setup(height=844,visual=500,offset=0){
 const field={id:'wizard-chat-input',tagName:'INPUT'};
 const wizard={style:style(),classList:classes(['wizard-chat-mode']),contains:el=>el===field};
 let scrolls=0;const restores=[];
 const context={document:{getElementById:()=>wizard,activeElement:field,documentElement:{clientHeight:height,classList:classes()},body:{style:style(),classList:classes()}},window:{innerHeight:height,scrollX:0,scrollY:127,scrollTo:(...args)=>restores.push(args),visualViewport:{height:visual,offsetTop:offset}},scrollWizardChatToPromptStart:()=>scrolls++};
 vm.createContext(context);
 vm.runInContext('let wizardBodyScrollSnapshot=null;'+extract('setOnboardingScrollLock')+extract('setWizardChatKeyboardMode')+extract('syncWizardViewportMetrics'),context);
 return {context,wizard,field,restores,scrolls:()=>scrolls};
}
test('keyboard shrinks only the card, not the opaque curtain, including tiny landscape',()=>{
 for(const [height,visual,offset] of [[844,440,180],[667,340,80],[568,270,120],[390,155,50]]){
  const {context,wizard}=setup(height,visual,offset);context.syncWizardViewportMetrics();
  assert.equal(wizard.style.getPropertyValue('--pbb-wizard-viewport-height'),visual+'px');
  assert.equal(wizard.style.getPropertyValue('--pbb-wizard-cover-height'),height+'px');
  assert.equal(wizard.style.getPropertyValue('--pbb-wizard-viewport-top'),offset+'px');
 }
});
test('repeated keyboard pan/resize does not reset a manually scrolled question',()=>{
 const s=setup();for(let i=0;i<25;i++)s.context.syncWizardViewportMetrics();assert.equal(s.scrolls(),1);
 s.context.document.activeElement=null;s.context.window.visualViewport.height=844;s.context.syncWizardViewportMetrics();
 assert.equal(s.wizard.classList.contains('wizard-chat-keyboard'),false);
 s.context.document.activeElement=s.field;s.context.syncWizardViewportMetrics();assert.equal(s.scrolls(),2);
});
test('scroll lock is idempotent and restores the underlying page and inline styles on exit/reopen',()=>{
 const {context,restores}=setup();const body=context.document.body;body.style.setProperty('width','95%');
 for(let i=0;i<2;i++){
 context.setOnboardingScrollLock(true);context.setOnboardingScrollLock(true);
 assert.equal(body.style.getPropertyValue('position'),'fixed');assert.equal(body.style.getPropertyValue('top'),'-127px');
 context.setOnboardingScrollLock(false);assert.equal(body.style.getPropertyValue('position'),'');assert.equal(body.style.getPropertyValue('width'),'95%');
 }assert.deepEqual(restores,[[0,127],[0,127]]);
});
test('no visualViewport still gives a full usable frame',()=>{
 const {context,wizard}=setup(568);context.window.visualViewport=null;context.syncWizardViewportMetrics();
 assert.equal(wizard.style.getPropertyValue('--pbb-wizard-viewport-height'),'568px');
 assert.equal(wizard.style.getPropertyValue('--pbb-wizard-viewport-top'),'0px');
});
test('tour clearance follows the actual banner, including wrapped labels',()=>{
 const html=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
 const start=html.indexOf('  function getTourSafeTop('),end=html.indexOf('\n  function ',start+1);
 for(const bottom of [0,80,128,172]){
 const context={document:{getElementById:()=>({getBoundingClientRect:()=>({bottom}),getClientRects:()=>bottom?[1]:[]})},window:{getComputedStyle:()=>({visibility:'visible'})}};
 vm.createContext(context);vm.runInContext(html.slice(start,end),context);assert.equal(context.getTourSafeTop(),Math.max(44,bottom?bottom+12:0));
 }
 assert.match(html,/tour-workout-safe-area[\s\S]*?height:calc\(100dvh - var\(--pbb-tour-workout-top/);
 assert.match(html,/Math\.max\(r\.top - pad, safeTop\)/);
});
test('Safari requests a thumbnail seek as soon as metadata exists, without play()',()=>{
 const videoSource=fs.readFileSync(path.join(root,'js/dashboard/dashboard-script-7-video_logic.js'),'utf8');
 const from=videoSource.indexOf('function getExerciseThumbnailSeekTime'),to=videoSource.indexOf('function revealInlineExerciseThumbnail');
 const events={};let time=0,ready=0;
 const video={dataset:{},duration:8,readyState:1,addEventListener:(name,fn)=>events[name]=fn,removeEventListener:()=>{},get currentTime(){return time},set currentTime(value){time=value}};
 const context={Date,Math,setTimeout:()=>1,clearTimeout:()=>{}};vm.createContext(context);vm.runInContext(videoSource.slice(from,to),context);
 context.seekExerciseVideoThumbnailFrame(video,()=>ready++,()=>assert.fail('must not fail'));
 assert.equal(time,0.35);video.readyState=2;events.seeked();assert.equal(ready,1);
 assert.match(source,/\$\{videoUrl\}#t=0\.1/);
});
