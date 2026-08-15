const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/meta-ad-trial.js'), 'utf8');

function makeStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        dump: () => Object.fromEntries(values),
    };
}

function runTrial(search) {
    let now = 1_800_000_000_000;
    const elements = {
        'guest-mode-banner': { style: {} },
        'guest-mode-label': { textContent: '' },
        'meta-ad-trial-gate': { style: {} },
        'meta-ad-trial-email': { value: '', focus() { this.focused = true; } },
        'meta-ad-trial-terms': { checked: false },
        'meta-ad-trial-checkout-btn': { disabled: false, textContent: 'START FOUNDATIONS' },
        'meta-ad-trial-error': { style: {}, textContent: '' },
        'meta-ad-trial-exit-choice': { style: {} },
        'meta-ad-trial-exit-title': { textContent: '' },
        'meta-ad-trial-exit-body': { textContent: '' },
        'meta-ad-trial-resume-btn': { textContent: '' },
        'meta-ad-trial-inbox-preview': { style: {} },
        'guided-tour-overlay': { classList: { remove() {} } },
    };
    const events = [];
    const localStorage = makeStorage({ onboardingComplete: 'true', userGender: 'female' });
    const sessionStorage = makeStorage();
    class FakeDate extends Date {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    }
    const document = {
        readyState: 'complete',
        referrer: 'https://facebook.com/',
        cookie: '_fbc=test-fbc; _fbp=test-fbp',
        documentElement: { classList: { add(value) { this.value = value; }, remove(value) { if (this.value === value) this.value = ''; } } },
        getElementById: id => elements[id] || null,
        addEventListener() {},
    };
    const window = {
        location: {
            search,
            hash: '',
            pathname: '/dashboard.html',
            href: 'https://plantbased-balance.org/dashboard.html' + search,
        },
        document,
        navigator: { userAgent: 'test-phone' },
        localStorage,
        sessionStorage,
        innerWidth: 390,
        innerHeight: 844,
        crypto: { randomUUID: () => 'fixed-id' },
        fetch: async (url, options) => {
            const body = JSON.parse(options.body);
            if (url === '/.netlify/functions/log-lp-event') events.push(body);
            if (url === '/.netlify/functions/create-checkout-session') {
                events.push({ event_type: 'checkout_request', body });
                return { ok: true, json: async () => ({ sessionId: 'cs_live_preview', url: 'https://checkout.stripe.com/test-preview' }) };
            }
            return { ok: true, json: async () => ({ recorded: true }) };
        },
        setTimeout: () => 1,
        clearTimeout() {},
        setInterval: () => 2,
        clearInterval() {},
    };
    const context = {
        window,
        document,
        localStorage,
        sessionStorage,
        navigator: window.navigator,
        URLSearchParams,
        Date: FakeDate,
        Math,
        JSON,
        globalThis: window,
        setTimeout: window.setTimeout,
        clearTimeout: window.clearTimeout,
        setInterval: window.setInterval,
        clearInterval: window.clearInterval,
    };
    vm.runInNewContext(source, context, { filename: 'meta-ad-trial.js' });
    return { window, localStorage, sessionStorage, elements, events, setNow: value => { now = value; } };
}

test('paid Facebook and Instagram attribution activate without changing organic guest or member traffic', () => {
    const paid = runTrial('?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=facebook&utm_medium=paid_social&ad_id=ad-42');
    assert.equal(paid.window.metaAdTrialMode, true);
    assert.equal(paid.sessionStorage.getItem('guestMode'), 'true');
    assert.equal(paid.localStorage.getItem('onboardingComplete'), null);
    assert.equal(paid.window.BalanceMetaAdTrial.readState().attribution.ad_id, 'ad-42');
    assert.equal(paid.events[0].event_type, 'trial_started');

    const paidInstagram = runTrial('?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=instagram&utm_medium=paid_social&ad_id=ig-42');
    assert.equal(paidInstagram.window.metaAdTrialMode, true);
    assert.equal(paidInstagram.window.BalanceMetaAdTrial.readState().attribution.ad_id, 'ig-42');

    const organic = runTrial('?guest=true&utm_source=facebook&utm_medium=paid_social');
    assert.equal(organic.window.metaAdTrialMode, undefined);
    assert.equal(organic.localStorage.getItem('onboardingComplete'), 'true');

    const organicInstagram = runTrial('?guest=true&utm_source=instagram&utm_medium=organic');
    assert.equal(organicInstagram.window.metaAdTrialMode, undefined);
    assert.equal(organicInstagram.localStorage.getItem('onboardingComplete'), 'true');
});

test('finishing the guided tour opens the fixed six-week Stripe gate', async () => {
    const trial = runTrial('?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=facebook&utm_medium=paid_social&fbclid=test-click');
    const api = trial.window.BalanceMetaAdTrial;
    api.onOnboardingStarted();
    const savedProfile = JSON.stringify({ name: 'Preview Buyer', primaryGoal: 'Build strength', trainingDays: 3 });
    const savedFoodPreferences = JSON.stringify({ dietary_preference: 'vegan', meals_per_day: 4 });
    const savedResult = JSON.stringify({ recommendedPlan: 'balanced', experience: 'beginner' });
    trial.localStorage.setItem('userProfile', savedProfile);
    trial.localStorage.setItem('user_food_preferences', savedFoodPreferences);
    trial.sessionStorage.setItem('userResult', savedResult);
    api.onOnboardingComplete();
    let state = api.readState();
    assert.equal(state.previewStartedAt, null);
    assert.equal(state.deadlineAt, null);
    assert.ok(trial.events.some(event => event.event_type === 'onboarding_completed'));
    assert.ok(!trial.events.some(event => event.event_type === 'trial_preview_started'));

    api.onWalkthroughComplete();
    state = api.readState();
    assert.equal(state.deadlineAt, null);
    assert.ok(trial.events.some(event => event.event_type === 'trial_walkthrough_completed'));
    assert.ok(trial.events.some(event => event.event_type === 'trial_preview_started'));

    assert.equal(trial.elements['meta-ad-trial-gate'].style.display, 'flex');
    assert.ok(trial.events.some(event => event.event_type === 'trial_gate_shown'));

    trial.elements['meta-ad-trial-email'].value = 'buyer@example.com';
    trial.elements['meta-ad-trial-terms'].checked = true;
    assert.equal(await api.beginCheckout(), true);
    const checkout = trial.events.find(event => event.event_type === 'checkout_request');
    assert.equal(checkout.body.priceId, 'balance_meta_foundations_pass');
    assert.equal(checkout.body.pageVariant, 'facebook_5m_foundations_v3');
    assert.equal(checkout.body.checkoutSource, 'meta_ad_trial');
    assert.equal(checkout.body.utm_data.visitor_id, 'visitor-fixed-id');
    assert.equal(checkout.body.utm_data.session_id, 'session-fixed-id');
    assert.equal(checkout.body.compliance.accepted.terms, true);
    assert.equal(trial.sessionStorage.getItem(api.PAYMENT_SESSION_KEY), 'cs_live_preview');
    assert.equal(trial.sessionStorage.getItem(api.PAYMENT_PLAN_KEY), 'balance_foundations_six_week');
    assert.equal(trial.sessionStorage.getItem(api.CLAIM_KEY), null);
    assert.equal(trial.localStorage.getItem('userProfile'), savedProfile);
    assert.equal(trial.localStorage.getItem('user_food_preferences'), savedFoodPreferences);
    assert.equal(trial.sessionStorage.getItem('userResult'), savedResult);
    assert.equal(trial.window.location.href, 'https://checkout.stripe.com/test-preview');
});

test('paid Meta onboarding and tour exits stay locked behind continue-or-pay choices', () => {
    const trial = runTrial('?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=instagram&utm_medium=paid_social');
    const api = trial.window.BalanceMetaAdTrial;

    assert.equal(api.showExitChoice('onboarding'), true);
    assert.equal(trial.elements['meta-ad-trial-exit-choice'].style.display, 'flex');
    assert.equal(trial.elements['meta-ad-trial-resume-btn'].textContent, 'CONTINUE SETUP');
    assert.equal(api.readState().interruptedStage, 'onboarding');
    assert.equal(api.readState().deadlineAt, null);

    assert.equal(api.showExitChoice('tour'), true);
    assert.equal(trial.elements['meta-ad-trial-resume-btn'].textContent, 'RESTART APP TOUR');
    assert.equal(api.readState().interruptedStage, 'tour');
    assert.equal(api.readState().deadlineAt, null);

    assert.equal(api.openCheckoutGate(), true);
    assert.equal(trial.elements['meta-ad-trial-exit-choice'].style.display, 'none');
    assert.equal(trial.elements['meta-ad-trial-gate'].style.display, 'flex');
    assert.equal(api.readState().interruptedStage, 'checkout');
});

test('the Inbox proof is local to the verified paid Meta preview', () => {
    const paid = runTrial('?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=facebook&utm_medium=paid_social');
    assert.equal(paid.window.BalanceMetaAdTrial.showInboxPreview(), true);
    assert.equal(paid.elements['meta-ad-trial-inbox-preview'].style.display, 'flex');

    const organic = runTrial('?guest=true&utm_source=instagram&utm_medium=organic');
    assert.equal(organic.window.BalanceMetaAdTrial.showInboxPreview(), false);
    assert.equal(organic.elements['meta-ad-trial-inbox-preview'].style.display, undefined);
});

test('a claimed member revisiting the ad cannot have onboarding data cleared', () => {
    const query = '?guest=true&meta_trial=facebook_5m_foundations_v3&utm_source=facebook&utm_medium=paid_social';
    const trial = runTrial(query);
    const api = trial.window.BalanceMetaAdTrial;
    api.markClaimed('member-1');
    trial.localStorage.setItem('onboardingComplete', 'true');

    assert.equal(api.activate(query, 'web_link'), false);
    assert.equal(trial.localStorage.getItem('onboardingComplete'), 'true');
    assert.equal(api.readState().claimedUserId, 'member-1');
});

test('dashboard, signup, native handoffs, measurement, and both discovery systems are wired', () => {
    const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const auth = fs.readFileSync(path.join(root, 'lib/auth-guard.js'), 'utf8');
    const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
    const login = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
    const landing = fs.readFileSync(path.join(root, 'meta-app-preview.html'), 'utf8');
    const foundersLanding = fs.readFileSync(path.join(root, 'plant-based-fitness.html'), 'utf8');
    const success = fs.readFileSync(path.join(root, 'success.html'), 'utf8');
    const checkoutSession = fs.readFileSync(path.join(root, 'netlify/edge-functions/create-checkout-session.js'), 'utf8');
    const claim = fs.readFileSync(path.join(root, 'netlify/edge-functions/claim-meta-trial-subscription.js'), 'utf8');
    const foundersClaim = fs.readFileSync(path.join(root, 'netlify/edge-functions/claim-founders-pass.js'), 'utf8');
    const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    const logger = fs.readFileSync(path.join(root, 'netlify/functions/log-lp-event.js'), 'utf8');
    const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/fitgotchi/app/MainActivity.java'), 'utf8');
    const ios = fs.readFileSync(path.join(root, 'ios/App/App/BalanceShortcutHandoff.swift'), 'utf8');

    assert.match(dashboard, /paid-facebook-stripe-unlock-v1/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=185-exercise-thumbnails-light-launch/);
    assert.match(dashboard, /title:'What to do today'.*metaPreview:true/);
    assert.match(dashboard, /title:'Your workouts for the week'.*metaPreview:true/);
    assert.match(dashboard, /title:'Open your workout'.*metaPreview:true/);
    assert.match(dashboard, /title:'Track every set and rep'.*metaPreview:true/);
    assert.match(dashboard, /title:'Track food with the camera'.*metaPreview:true/);
    assert.match(dashboard, /title:'Your actual meal plan'.*metaPreview:true/);
    assert.match(dashboard, /title:'Your six-week course'.*metaPreview:true/);
    assert.match(dashboard, /title:'The Balance community'.*metaPreview:true/);
    assert.match(dashboard, /title:'Post when you need support'.*metaPreview:true/);
    assert.match(dashboard, /title:'Your message from Shannon'.*metaPreview:true/);
    assert.match(dashboard, /title:'Set your Weekly Goals'.*metaPreviewSignoff:true/);
    assert.match(dashboard, /showExitChoice\('tour'\)/);
    assert.match(onboarding, /closingMetaAdTrial[\s\S]*?showExitChoice\('onboarding'\)[\s\S]*?return;/);
    assert.match(onboarding, /window\.resumeMetaAdTrialOnboarding = function/);
    assert.match(dashboard, /id="meta-ad-trial-gate"/);
    assert.match(auth, /requestedMetaAdTrial/);
    assert.match(onboarding, /BalanceMetaAdTrial\.onOnboardingComplete\(\)/);
    assert.match(onboarding, /function startWizardMetaPreviewTour/);
    assert.match(onboarding, /setTimeout\(\(\) => startWizardMetaPreviewTour\(\), 80\)/);
    assert.match(onboarding, /start\(false, \{ metaPreview: true \}\)/);
    assert.match(onboarding, /const scopedQuizProfile = readSessionProfileForActiveUser\(\)/);
    assert.match(onboarding, /window\.ensureMetaPreviewMealPlan = ensureMetaPreviewMealPlan/);
    assert.match(onboarding, /data-meal-plan-photo="true"/);
    assert.match(onboarding, /BalanceMetaAdTrial\.hasPendingClaim\(\)/);
    assert.match(onboarding, /await claimMetaPreviewWorkoutCalendar\(userId\);/);
    assert.match(onboarding, /await claimMetaPreviewMealPlan\(userId\);/);
    assert.match(onboarding, /Preview workout calendar was not confirmed in the account/);
    assert.match(onboarding, /Preview meal plan was not confirmed in the account/);
    assert.match(onboarding, /workout_calendar_times: calendarTimes/);
    assert.match(login, /applyMetaAdTrialHandoffCopy/);
    assert.match(login, /claimPendingMetaTrialPurchase/);
    assert.match(login, /preservePaidPreview/);
    assert.match(login, /pbb_onboarding_owner_user_id/);
    assert.match(login, /claim-founders-pass/);
    assert.match(login, /meta_ad_trial_paid/);
    assert.match(success, /Taking you straight back to Balance now/);
    assert.match(success, /source=meta_ad_trial_paid/);
    assert.match(success, /if \(isFoundersPass && !isMetaAdTrialPurchase\)/);
    assert.match(checkoutSession, /checkoutSource === "meta_ad_trial"/);
    assert.match(checkoutSession, /session\.url/);
    assert.match(claim, /META_TRIAL_PLAN = "app_community_monthly"/);
    assert.match(claim, /checkoutEmail !== userEmail/);
    assert.match(claim, /subscription_status: status/);
    assert.match(netlify, /claim-meta-trial-subscription/);
    assert.match(landing, /window\.location\.replace\('\/founders\?' \+ incoming\.toString\(\)\)/);
    assert.match(landing, /incoming\.set\('meta_preview', '1'\)/);
    assert.match(landing, /incoming\.set\('utm_source', 'facebook'\)/);
    assert.match(landing, /incoming\.set\('utm_medium', 'paid_social'\)/);
    assert.match(landing, /facebook_5m_foundations_v3/);
    assert.match(landing, /balance-founders-og-cream-gold\.png\?v=20260804/);
    assert.match(foundersLanding, /paidMetaSources = \['facebook', 'fb', 'instagram', 'ig', 'meta'\]/);
    assert.match(foundersLanding, /createTreeWalker\(document\.body, NodeFilter\.SHOW_TEXT\)/);
    assert.match(foundersLanding, /paidMetaMedia = \['paid_social', 'paid', 'cpc'\]/);
    assert.match(foundersLanding, /params\.set\('guest', 'true'\)/);
    assert.match(foundersLanding, /params\.set\('meta_trial', 'facebook_5m_foundations_v3'\)/);
    assert.match(foundersLanding, /id="foundations-hero-action"/);
    assert.match(foundersLanding, /Download Balance for iPhone/);
    assert.match(foundersLanding, /Download Balance for Android/);
    assert.match(foundersLanding, /Already installed\? Open my free preview/);
    assert.match(foundersLanding, /com\.fitgotchi\.app:\/\/meta-trial\?/);
    assert.match(foundersLanding, /Download the Balance app, complete your setup, then take the full guided tour/);
    assert.match(foundersLanding, /pbb_meta_trial=/);
    assert.match(foundersLanding, /referrer=/);
    assert.match(foundersLanding, /You will not need to return to this website or Instagram/);
    assert.doesNotMatch(foundersLanding, /return to this website page/);
    assert.doesNotMatch(foundersLanding, /var appUrl = '\/dashboard\.html\?/);
    assert.match(foundersLanding, /data-plan="founders-pass"/);
    assert.match(foundersLanding, /replace\(\/AU\\\$89\\\.99\/g, 'AU\$89'\)/);
    assert.match(dashboard, /AU\$89 once\. No auto-renewal\./);
    assert.match(foundersClaim, /FOUNDERS_PLAN = "balance_foundations_six_week"/);
    assert.match(logger, /'trial_gate_shown'/);
    assert.match(logger, /'trial_walkthrough_completed'/);
    assert.match(logger, /'trial_subscription_claimed'/);
    assert.match(logger, /'trial_purchase_claimed'/);
    assert.match(android, /getPendingMetaTrialQuery/);
    assert.match(android, /InstallReferrerClient/);
    assert.match(android, /INSTALL_REFERRER_PAYLOAD_KEY = "pbb_meta_trial"/);
    assert.match(login, /function startFoundationsPreview\(\)/);
    assert.match(login, /Open my free preview/);
    assert.match(ios, /enum BalanceMetaTrialHandoff/);
});
