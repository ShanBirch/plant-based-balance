(function () {
    'use strict';
    let loadedUser = null;
    let saved = null;
    let settingsReady = false;
    let onboardingOwner = null, onboardingDraftOwner = null, onboardingLoad = null;
    let onboardingFailed = false;
    let eligibilityOwner = null, eligible = false;
    function isEligible() { return !!window.currentUser?.id && eligibilityOwner===window.currentUser.id && eligible; }
    async function checkEligibility() {
        const uid=window.currentUser?.id;
        if(!uid || !window.supabaseClient) return false;
        if(eligibilityOwner===uid) return eligible;
        const section=document.getElementById('settings-coaching-support-section');
        if(section) section.hidden=true;
        eligible=false;
        try {
            const result=await window.supabaseClient.rpc('my_outreach_support_eligibility');
            if(result.error || window.currentUser?.id!==uid) return false;
            eligible=result.data===true; eligibilityOwner=uid;
            if(section) section.hidden=!eligible;
            return eligible;
        } catch(e) { return false; }
    }
    function panel(prefix) {
        return `<div class="coaching-support-panel" data-support-panel="${prefix}">
          <p class="support-eyebrow">YOUR COACHING, YOUR CHOICE</p>
          <h3>How would you like me to support you?</h3>
          <p>Choose optional coaching messages from Shannon in your linked Instagram chat as you settle in. We'll confirm the link first if needed. Extra messages may taper; your weekly check-ins stay in place.</p>
          <label class="support-choice"><span><strong>A morning message</strong><small>On your saved training days. no need to choose them again.</small></span><input id="${prefix}-morning" type="checkbox" role="switch" aria-label="Morning message on saved training days"></label>
          <label class="support-choice"><span><strong>An after-session check-in</strong><small>A little support after a workout you log.</small></span><input id="${prefix}-after" type="checkbox" role="switch" aria-label="After-session check-in"></label>
          <fieldset><legend>What tone feels right?</legend><label><input id="${prefix}-gentle" type="radio" name="${prefix}-tone" value="gentle" checked> Gentle &amp; encouraging</label><label><input id="${prefix}-direct" type="radio" name="${prefix}-tone" value="direct"> Firmer &amp; direct</label></fieldset>
          <p class="support-note">Always respectful, never guilt or shame. Tone doesn't turn messages on. Leave both switches off for weekly check-ins only. You can change this anytime in Settings → Coaching support.</p>
          <p class="support-status" role="status" aria-live="polite"></p>
        </div>`;
    }
    function read(prefix) {
        return { morning_training:!!document.getElementById(prefix+'-morning')?.checked,
            after_session:!!document.getElementById(prefix+'-after')?.checked,
            tone:document.getElementById(prefix+'-direct')?.checked ? 'direct' : 'gentle' };
    }
    function fill(prefix, value) {
        const v = value || {};
        ['morning','after'].forEach((key,i) => { const el=document.getElementById(prefix+'-'+key); if(el) el.checked=!!v[i?'after_session':'morning_training']; });
        const tone=document.getElementById(prefix+'-'+(v.tone==='direct'?'direct':'gentle')); if(tone) tone.checked=true;
    }
    function mount() {
        document.querySelectorAll('[data-support-mount]').forEach(el => { if(!el.children.length) el.innerHTML=panel(el.dataset.supportMount); });
    }
    async function load(prefix) {
        if(!await checkEligibility()) throw new Error('Not in the verified new outreach cohort.');
        mount();
        const uid=window.currentUser?.id;
        if(!uid || !window.supabaseClient) return;
        if(loadedUser!==uid) {
            const result=await window.supabaseClient.from('coaching_support_preferences').select('*').eq('user_id',uid).maybeSingle();
            if(result.error) throw result.error;
            if(window.currentUser?.id!==uid) throw new Error('Account changed. Reopen your support choices.');
            saved=result.data; loadedUser=uid;
        }
        fill(prefix,saved);
    }
    async function prepareOnboarding() {
        if(!await checkEligibility()) return false;
        mount();
        const uid=window.currentUser?.id;
        if(!uid) return false;
        if(onboardingOwner===uid && onboardingLoad) return onboardingLoad;
        onboardingOwner=uid;
        if(onboardingDraftOwner===uid) return onboardingLoad=Promise.resolve(true);
        const root=document.querySelector('[data-support-panel="support-onboarding"]');
        const inputs=Array.from(root?.querySelectorAll('input')||[]);
        inputs.forEach(el=>el.disabled=true);
        onboardingLoad=(async()=>{
            let ready=false;
            try { loadedUser=null; await load('support-onboarding'); ready=true; return true; }
            catch(e) { onboardingFailed=true; onboardingOwner=null; const status=root?.querySelector('.support-status'); if(status) status.textContent='Could not load your saved choices. Tap Next to try again.'; return false; }
            finally { inputs.forEach(el=>el.disabled=!ready); }
        })();
        return onboardingLoad;
    }
    async function save(prefix, source) {
        const root=document.querySelector(`[data-support-panel="${prefix}"]`);
        const status=root?.querySelector('.support-status');
        if(status) status.textContent='Saving your choices…';
        try {
            if(!await checkEligibility()) throw new Error('This support system is only for the verified new outreach cohort.');
            if (source==='app_settings' && !settingsReady) throw new Error('Load your current choices before saving.');
            if (source==='app_onboarding') {
                const retrying=onboardingFailed;
                if (!await prepareOnboarding()) return false;
                if (retrying) { onboardingFailed=false; if(status) status.textContent='Your saved choices are loaded. Review them, then tap Next.'; return false; }
            }
            if(!window.currentUser?.id || !window.supabaseClient) throw new Error('Please sign in to save your support choices.');
            const uid=window.currentUser.id;
            const value=read(prefix);
            const result=await window.supabaseClient.rpc('save_coaching_support_preferences',{
                p_morning:value.morning_training,p_after_session:value.after_session,p_tone:value.tone,p_source:source
            });
            if(result.error) throw result.error;
            if(window.currentUser?.id!==uid) throw new Error('Account changed. Reopen your support choices.');
            saved=result.data; loadedUser=window.currentUser.id;
            // Mirror only after the authoritative account save succeeds.
            let profile={}; try { profile=JSON.parse(sessionStorage.getItem('userProfile')||'{}'); } catch(e) {}
            profile.coaching_support_preferences=saved;
            try { sessionStorage.setItem('userProfile',JSON.stringify(profile)); } catch(e) { /* Account consent is already persisted. */ }
            if(status) status.textContent='Your support choices are saved.';
            return true;
        } catch(error) {
            if(status) status.textContent='Your choices were not saved. Please check your connection and try again.';
            return false;
        }
    }
    async function openSettings() {
        const card=document.getElementById('settings-coaching-support-editor');
        card.hidden=!card.hidden;
        if(!card.hidden) {
            settingsReady=false;
            loadedUser=null; // Always read current consent, including changes from another device.
            card.querySelector('button').disabled=true;
            try { await load('support-settings'); }
            catch(e) { card.querySelector('.support-status').textContent='Could not load your choices. Close and reopen to try again.'; card.querySelector('button').disabled=true; return; }
            settingsReady=true; card.querySelector('button').disabled=false;
        }
    }
    window.BalanceCoachingSupport={mount,load,save,read,openSettings,prepareOnboarding,checkEligibility,isEligible,markDraftRestored:()=>{onboardingDraftOwner=window.currentUser?.id;}};
    window.addEventListener('pbbInitComplete',checkEligibility);
    document.addEventListener('pbbInitComplete',checkEligibility);
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
