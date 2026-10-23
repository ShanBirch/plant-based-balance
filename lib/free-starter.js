/* Free starter access is confirmed by the server for the signed-in account.
 * URL flags and browser storage never grant membership or paid entitlements. */
(function (window) {
    'use strict';
    const TOKEN_KEY = 'pbb_free_starter_invite';
    const OWNER_KEY = 'pbb_free_starter_owner';
    let grant = null;
    let owner = null;
    function pending() { try { return !!window.sessionStorage.getItem(TOKEN_KEY); } catch (_) { return false; } }
    if (checking()) { window.sessionStorage.removeItem('guestMode'); window.metaAdTrialMode = false; }
    function active() { return !!grant && owner === window.currentUser?.id; }
    function checking() { return pending() || !!window.localStorage.getItem(OWNER_KEY); }
    function needsRetry(userId) { return pending() || window.localStorage.getItem(OWNER_KEY) === userId; }
    async function resolve(session) {
        grant = null;
        owner = null;
        const token = window.sessionStorage.getItem(TOKEN_KEY);
        const result = await window.fetch('/.netlify/functions/free-starter-access', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify(token ? { token } : {})
        });
        const body = await result.json();
        if (!result.ok) throw new Error(body.error || 'Free starter access could not be checked.');
        grant = body.starter;
        owner = session.user.id;
        if (token && !grant && !body.alreadyMember) throw new Error('Your free invitation could not be claimed.');
        if (body.alreadyMember) window.sessionStorage.removeItem(TOKEN_KEY);
        if (grant) {
            window.localStorage.setItem(OWNER_KEY, owner);
            window.sessionStorage.removeItem(TOKEN_KEY);
            window.metaAdTrialMode = false;
            window.sessionStorage.removeItem('guestMode');
            window.BalanceMetaAdTrial?.pauseForFreeStarter?.();
            applyCopy();
        } else {
            window.localStorage.removeItem(OWNER_KEY);
            window.BalanceMetaAdTrial?.resumeAfterStarterCheck?.();
        }
        return grant;
    }
    function reviewPending() { return active() && !grant.workoutsReady; }
    function canStartWorkout() {
        if (!reviewPending()) return true;
        window.showToast?.('Your two free workouts are awaiting Shannon’s review. You can continue your course and setup.', 'info');
        return false;
    }
    function adaptAction(action) {
        if (!active()) return action;
        const copy = Object.assign({}, action);
        if (copy.id === 'coach_checkin_intro') Object.assign(copy, {title:'What your free starter includes',body:'Your course and two home workouts are free. Weekly coaching reviews are optional and are not included.',cta:'See Starter Details',action:()=>window.showToast?.('Your course and two home workouts are free. Ongoing coaching is optional.', 'info')});
        if (copy.id === 'coach_message_intro') copy.body = 'Read Shannon’s welcome to your free starter.';
        if (copy.id === 'weekly_goals_intro') copy.body = 'Choose the few realistic actions you want to work towards this week.';
        if (copy.id === 'workout_week_intro' && reviewPending()) Object.assign(copy, {title:'Your two workouts are awaiting review',body:'Shannon will review your setup and movement restrictions before your workouts are ready. Keep going with the course.',cta:'View Starter',action:()=>window.switchAppTab?.('movement')});
        return copy;
    }
    function welcomeCopy() {
        const ink = ' style="color:#24211b!important;-webkit-text-fill-color:#24211b!important"';
        return '<h2' + ink + '>Your free Balance starter</h2><p' + ink + '>Your course, app setup and two home workouts are free. Your workouts are awaiting my review before you start. Follow the tour and course, then use To Do Next on Home.</p><p' + ink + '>Weekly coaching reviews are optional and are not included.</p>';
    }
    function applyCopy() {
        if (!active()) return;
        window.document.querySelectorAll?.('.freq-btn').forEach(button => {
            button.hidden = Number(button.dataset.freq) !== 2;
        });
        const recovery = window.document.getElementById('wizard-recovery-days');
        if (recovery) { recovery.checked = false; recovery.disabled = true; recovery.closest('label')?.setAttribute('hidden', ''); }
        const promise = window.document.querySelector('#wizard-free-starter-promise');
        if (promise) promise.innerHTML = '<span>YOUR FREE STARTER</span>Two home workouts, your course and app setup. No payment required. Ongoing coaching is optional.';
        const welcome = window.document.querySelector('#meta-ad-trial-inbox-preview .coach-welcome-bubble');
        if (welcome) welcome.innerHTML = welcomeCopy();
        const grid = window.document.getElementById('movement-grid-container');
        if (grid && !window.document.getElementById('free-starter-status')) {
            const card = window.document.createElement('p');
            card.id = 'free-starter-status';
            card.style.cssText = 'padding:16px;border:1px solid #aa8035;border-radius:14px;background:var(--surface,#fffaf0)!important;color:var(--text-main,#24211b)!important;-webkit-text-fill-color:var(--text-main,#24211b)!important;line-height:1.5';
            card.textContent = reviewPending() ? 'Your two free home workouts are awaiting Shannon’s review of your setup and movement restrictions. Your course is ready to use. No payment is required.' : 'Your two free workouts and course are ready. No payment is required.';
            grid.before(card);
        }
    }
    window.BalanceFreeStarter = { pending, checking, needsRetry, active, resolve, reviewPending, canStartWorkout, adaptAction, welcomeCopy, applyCopy, access: () => active() ? grant : null };
    window.document.addEventListener('pbbInitComplete', applyCopy);
    window.document.addEventListener('DOMContentLoaded', applyCopy);
})(window);
