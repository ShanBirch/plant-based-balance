const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/dashboard/pbb-coaching-support.js','utf8');
function harness(error=false, draft=true) {
 const fields=Object.fromEntries(['morning','after','gentle','direct'].map(k=>['support-onboarding-'+k,{checked:k==='gentle'}]));
 const storage=new Map();const calls=[];const status={textContent:''};
 const context={window:{currentUser:{id:'member'},supabaseClient:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{morning_training:true,after_session:false,tone:'direct'}})})})}),rpc:async(name,args)=>{if(name==="my_outreach_support_eligibility")return {data:true};calls.push({name,args});return error?{error:new Error('offline')}:{data:{morning_training:args.p_morning,after_session:args.p_after_session,tone:args.p_tone,consent_source:args.p_source,revision:1}};}}},
 document:{readyState:'complete',addEventListener:()=>{},querySelectorAll:()=>[],getElementById:id=>fields[id],querySelector:()=>({querySelector:()=>status,querySelectorAll:()=>[]})},
 sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(source,context);if(draft)context.window.BalanceCoachingSupport.markDraftRestored(); return {api:context.window.BalanceCoachingSupport,fields,storage,calls,status};
}
test('all four contact combinations save independently; direct tone never grants contact',async()=>{
 for(const morning of [false,true]) for(const after of [false,true]) {
  const h=harness();h.fields['support-onboarding-morning'].checked=morning;h.fields['support-onboarding-after'].checked=after;h.fields['support-onboarding-direct'].checked=true;
  assert.equal(await h.api.save('support-onboarding','app_onboarding'),true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{p_morning:morning,p_after_session:after,p_tone:'direct',p_source:'app_onboarding'});
 }
});
test('failed account save cannot claim success or mirror consent locally',async()=>{
 const h=harness(true);assert.equal(await h.api.save('support-onboarding','app_onboarding'),false);
 assert.equal(h.storage.size,0);assert.match(h.status.textContent,/not saved/);
});
test('settings cannot overwrite unknown cross-device choices after a failed load',async()=>{
 const h=harness();assert.equal(await h.api.save('support-onboarding','app_settings'),false);assert.equal(h.calls.length,0);
});
test('restarted onboarding reads account consent while a restored draft retains edits',async()=>{
 const h=harness(false,false);assert.equal(await h.api.prepareOnboarding(),true);assert.equal(h.fields['support-onboarding-morning'].checked,true);assert.equal(h.fields['support-onboarding-direct'].checked,true);
 const draft=harness();draft.fields['support-onboarding-after'].checked=true;await draft.api.prepareOnboarding();assert.equal(draft.fields['support-onboarding-after'].checked,true);assert.equal(draft.fields['support-onboarding-morning'].checked,false);
});
test('support follows days for all equipment and drafts mount before restoring fields',()=>{
 const wizard=fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js','utf8');
 assert.match(wizard,/const skippedWizardSlides = \[2, 8,/);
 assert.match(wizard,/function restoreWizardCheckpoint\(\) \{\s+window.BalanceCoachingSupport\?\.mount\(\)/);
 assert.match(wizard,/currentWizardStep === 5[\s\S]*?save\('support-onboarding','app_onboarding'\)/);
 assert.match(wizard,/currentWizardStep === 6\) \{\s+currentWizardStep = 5;/);
 assert.doesNotMatch(wizard,/equipment !== 'gym'[\s\S]{0,150}currentWizardStep = 6/);
});
test('real wizard navigation waits for consent persistence and returns to support',async()=>{
 const src=fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js','utf8');
 const next=src.slice(src.indexOf('async function wizardNext()'),src.indexOf('function wizardPrev()'));
 const prev=src.slice(src.indexOf('function wizardPrev()'),src.indexOf('// ========== CHARACTER CUSTOMIZATION FUNCTIONS'));
 const button={disabled:false};let succeed=false;
 const c={currentWizardStep:5,finalWizardStep:19,selectedGender:'male',document:{getElementById:()=>button},window:{BalanceCoachingSupport:{save:async()=>succeed}},isWizardSlideSkipped:()=>false,updateWizardUI:()=>{}};
 vm.createContext(c);vm.runInContext(next+prev,c);
 await c.wizardNext();assert.equal(c.currentWizardStep,5);assert.equal(button.disabled,false);
 succeed=true;await c.wizardNext();assert.equal(c.currentWizardStep,6);
 c.wizardPrev();assert.equal(c.currentWizardStep,5);
});
test('live client context exposes selected support without inferring older-member consent',()=>{
 const {buildCourseClientContext}=require('../netlify/functions/_lib/course-client-context');
 const missing=buildCourseClientContext({support_cohort:true});assert.match(missing,/no verified saved app preference/);
 assert.doesNotMatch(buildCourseClientContext({}),/APP SUPPORT CHOICES/);
 const chosen=buildCourseClientContext({support_cohort:true,support:[{morning_training:false,after_session:true,tone:'direct',revision:3,consent_at:'2026-11-01'}]});
 assert.match(chosen,/morning on saved training days=false; after an actual logged session=true/);
 assert.match(chosen,/revision=3/);assert.match(chosen,/Tone is not contact consent/);
});
test('new paid continuation retains coaching guidance while existing members retain their own agreement',()=>{
 const {buildCourseClientContext}=require('../netlify/functions/_lib/course-client-context');
 const paid=buildCourseClientContext({support_cohort:true,account:[{subscription_status:'active',subscription_plan:'organic_coaching_continuation_weekly'}],starter:[{experience:'coached_month_v1'}]});
 assert.match(paid,/LIVE ORGANIC COACHING CONTINUATION/);assert.doesNotMatch(paid,/Balance Learn is a ten-week/);
 const old=buildCourseClientContext({support_cohort:false,starter:[{experience:'coached_month_v1'}]});assert.doesNotMatch(old,/14\.70|APP SUPPORT CHOICES/);assert.match(old,/original programme/);
});
