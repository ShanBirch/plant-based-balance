const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const setupSource = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const dashboard = read('dashboard.html');
function storage() { const map = new Map(); return { getItem:k=>map.get(k)||null, setItem:(k,v)=>map.set(k,String(v)), removeItem:k=>map.delete(k) }; }
function boot(localStorage, id='member-a') {
    const window = {localStorage,currentUser:{id}};
    vm.runInNewContext(read('lib/onboarding-progress.js'), {window});
    return window;
}
function extract(source, name) {
    const start = source.indexOf('function '+name+'(');
    const next = /\n\s*function /.exec(source.slice(start+1));
    const end = next ? start+1+next.index : source.length;
    return source.slice(start,end);
}
test('cold reopen resumes the exact checkpoint with empty sessionStorage, isolated per account', () => {
    const local = storage(), first = boot(local);
    first.BalanceOnboardingProgress.save('setup', {wizard:{step:1,chatIndex:6,answers:{age:34}}});
    const reopened = boot(local);
    assert.equal(reopened.BalanceOnboardingProgress.read().wizard.chatIndex,6);
    assert.equal(boot(local,'member-b').BalanceOnboardingProgress.read(),null);
    reopened.BalanceOnboardingProgress.save('tour',{tour:{step:'Your reps go here'}});
    assert.equal(boot(local).BalanceOnboardingProgress.read().tour.step,'Your reps go here');
    reopened.BalanceOnboardingProgress.save('checkout',{});
    assert.equal(boot(local).BalanceOnboardingProgress.read().stage,'checkout');
    reopened.BalanceOnboardingProgress.clear();
    assert.equal(boot(local).BalanceOnboardingProgress.read(),null);
});
test('a fresh trial and admin view cannot reuse another journey', () => {
    const w=boot(storage()); let activatedAt=10;
    w.BalanceMetaAdTrial={readState:()=>({activatedAt})};
    w.BalanceOnboardingProgress.save('tour',{tour:{step:'Example'}});
    activatedAt=20; assert.equal(w.BalanceOnboardingProgress.read(),null);
    w.isAdminViewing=true; w.BalanceOnboardingProgress.save('setup',{});
    assert.equal(w.BalanceOnboardingProgress.read(),null);
});
test('corrupt and unavailable storage do not crash startup', () => {
    const local=storage(); local.setItem('pbb_onboarding_progress_v1:member-a','{');
    assert.equal(boot(local).BalanceOnboardingProgress.read(),null);
    const w=boot({getItem(){throw Error('blocked')},setItem(){throw Error('full')},removeItem(){}});
    assert.doesNotThrow(()=>w.BalanceOnboardingProgress.save('setup',{}));
});
test('wizard draft restores submitted answers, unfinished input, schedule and preferences', () => {
    const window=boot(storage());
    const fields=[{id:'wizard-chat-input',value:'A stronger routine',type:'text',closest:()=>true}];
    const ctx={window,document:{getElementById:id=>id==='onboarding-wizard'?{classList:{contains:()=>true},querySelectorAll:()=>fields}:fields.find(f=>f.id===id),addEventListener(){}},
        currentWizardStep:4,totalWizardSteps:19,wizardChatStarted:true,wizardChatComplete:false,wizardChatStepIndex:6,wizardChatAnswers:{age:34},wizardChatFreeformAnswers:{},selectedGender:'male',wizardTrainingFrequency:3,wizardSplitPreference:'full',wizardWorkoutCalendar:{monday:'Full body'},wizardWorkoutTimes:{monday:'09:00'},WIZARD_CHAT_STEPS:new Array(13),rebuildWizardChatMessagesUntil(){}};
    for (const name of ['wizardSelectedDays','wizardCuisinePreferences','wizardFavoriteFoods','wizardFoodAllergies','wizardDietaryRequirements','wizardLearningInterests','wizardLikedExercises','wizardAvoidedExercises']) ctx[name]=new Set(['saved']);
    window.addEventListener=()=>{};
    vm.createContext(ctx);
    vm.runInContext(extract(setupSource,'saveWizardCheckpoint')+extract(setupSource,'restoreWizardCheckpoint'),ctx);
    ctx.saveWizardCheckpoint();
    ctx.currentWizardStep=1;ctx.wizardChatStepIndex=0;ctx.wizardChatAnswers={};fields[0].value='';
    assert.equal(ctx.restoreWizardCheckpoint(),true);
    assert.equal(ctx.currentWizardStep,4);assert.equal(ctx.wizardChatStepIndex,6);
    assert.equal(ctx.wizardChatAnswers.age,34);assert.equal(fields[0].value,'A stronger routine');
    assert.equal(ctx.wizardWorkoutCalendar.monday,'Full body');
    window.BalanceOnboardingProgress.save('checkout',{});ctx.saveWizardCheckpoint();
    assert.equal(window.BalanceOnboardingProgress.read().stage,'checkout');
});
test('boot resumes before completion shortcuts and after the startup Home switch', async () => {
    const start=setupSource.indexOf('async function checkAndTriggerOnboarding(');
    const end=setupSource.indexOf('\nfunction initOnboardingWizard(',start);
    for(const stage of ['setup','tour','checkout']) {
        const window=boot(storage());window.metaAdTrialMode=true;
        window.BalanceOnboardingProgress.save(stage,{wizard:{step:4}});
        const events={};const calls=[];
        window.location={search:''};window.addEventListener=(name,fn)=>events[name]=fn;
        window.BalanceMetaAdTrial={readState:()=>null,hasPendingClaim:()=>false,openCheckoutGate:()=>calls.push('checkout')};
        const ctx={window,localStorage:window.localStorage,console,initOnboardingWizard:()=>calls.push('setup'),startWizardMetaPreviewTour:(n,o)=>calls.push(o.resume?'tour-resume':'tour-restart')};
        vm.runInNewContext(setupSource.slice(start,end),ctx);
        await ctx.checkAndTriggerOnboarding();
        if(stage==='tour'){assert.deepEqual(calls,[]);events.pbbInitComplete();assert.deepEqual(calls,['tour-resume']);}
        else assert.deepEqual(calls,[stage]);
    }
});
test('tour checkpoint preserves the current stable step, gates and exercise position on hide', () => {
    const w=boot(storage());w.__balanceGuidedTourActive=true;w.__balanceGuidedTourShowingIntro=false;
    const ctx={window:w,document:{addEventListener(){}},sessionStorage:storage(),metaPreviewTour:true,clientActivationTour:false,idx:1,activeSteps:[{title:'First'},{title:'Your reps go here'}],completedTourGates:new Set(['done']),completedPromptedActions:new Set([0]),workoutBrowseCheckpoint:{index:3,seen:[0,1,2,3]}};
    w.addEventListener=()=>{};
    vm.runInNewContext(extract(dashboard,'saveTourCheckpoint'),ctx);
    ctx.saveTourCheckpoint();
    const tour=w.BalanceOnboardingProgress.read().tour;
    assert.equal(tour.step,'Your reps go here');assert.equal(tour.workout.index,3);assert.equal(JSON.stringify(tour.prompted),'["First"]');
    assert.match(dashboard,/if \(resumeIndex >= 0\) \{\s+showStep\(resumeIndex\)/);
    assert.match(dashboard,/savedTour\.foundationsComplete/);
});
test('Unlock has no sign-in fallback, and unfinished journeys never use the fast Home paint', () => {
    const button=dashboard.match(/<button[^>]*onclick="[^"]*openCheckoutGate[^>]*>Unlock Balance<\/button>/)[0];
    assert.doesNotMatch(button,/login\.html|metaAdTrialMode/);
    assert.match(read('js/dashboard/dashboard-script-3-1_get_user_data.js'),/!window.metaAdTrialMode && !window.BalanceOnboardingProgress\?\.read\(\)/);
    assert.match(dashboard,/body:has\(#guided-tour-overlay.active\) #guest-mode-banner \{ z-index:400200/);
    assert.match(setupSource,/if \(window.__balanceStartupHomeReady\) resumeTour\(\)/);
    assert.match(setupSource,/if \(wizardChatNeedsResume\)[\s\S]*?askWizardChatQuestion\(\{ instant:true, revisit:true \}\)/);
});
