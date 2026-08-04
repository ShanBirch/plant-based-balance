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
        documentElement: { classList: { add(value) { this.value = value; } } },
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
        fetch: async (_url, options) => {
            events.push(JSON.parse(options.body));
            return { ok: true };
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

test('paid Facebook attribution activates onboarding without changing organic guest traffic', () => {
    const paid = runTrial('?guest=true&meta_trial=facebook_5m_v1&utm_source=facebook&utm_medium=paid_social&ad_id=ad-42');
    assert.equal(paid.window.metaAdTrialMode, true);
    assert.equal(paid.sessionStorage.getItem('guestMode'), 'true');
    assert.equal(paid.localStorage.getItem('onboardingComplete'), null);
    assert.equal(paid.window.BalanceMetaAdTrial.readState().attribution.ad_id, 'ad-42');
    assert.equal(paid.events[0].event_type, 'trial_started');

    const organic = runTrial('?guest=true&utm_source=facebook&utm_medium=paid_social');
    assert.equal(organic.window.metaAdTrialMode, undefined);
    assert.equal(organic.localStorage.getItem('onboardingComplete'), 'true');
});

test('the five-minute clock starts after onboarding and ends in a non-dismissible signup gate', () => {
    const trial = runTrial('?guest=true&meta_trial=facebook_5m_v1&utm_source=facebook&utm_medium=paid_social&fbclid=test-click');
    const api = trial.window.BalanceMetaAdTrial;
    api.onOnboardingStarted();
    api.onOnboardingComplete();
    let state = api.readState();
    assert.equal(state.deadlineAt - state.previewStartedAt, 300_000);
    assert.ok(trial.events.some(event => event.event_type === 'onboarding_completed'));
    assert.ok(trial.events.some(event => event.event_type === 'trial_preview_started'));

    trial.setNow(state.deadlineAt + 1);
    assert.equal(api.showGate(), true);
    assert.equal(trial.elements['meta-ad-trial-gate'].style.display, 'flex');
    assert.ok(trial.events.some(event => event.event_type === 'trial_gate_shown'));

    api.beginSignup();
    assert.equal(trial.sessionStorage.getItem(api.CLAIM_KEY), 'true');
    assert.equal(trial.sessionStorage.getItem('guestMode'), null);
    assert.equal(trial.window.location.href, '/login.html?action=signup&source=meta_ad_trial');
});

test('a claimed member revisiting the ad cannot have onboarding data cleared', () => {
    const query = '?guest=true&meta_trial=facebook_5m_v1&utm_source=facebook&utm_medium=paid_social';
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
    const logger = fs.readFileSync(path.join(root, 'netlify/functions/log-lp-event.js'), 'utf8');
    const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/fitgotchi/app/MainActivity.java'), 'utf8');
    const ios = fs.readFileSync(path.join(root, 'ios/App/App/BalanceShortcutHandoff.swift'), 'utf8');

    assert.match(dashboard, /paid-facebook-five-minute-preview-v1/);
    assert.ok((dashboard.match(/Five minutes to explore/g) || []).length >= 2);
    assert.match(dashboard, /id="meta-ad-trial-gate"/);
    assert.match(auth, /requestedMetaAdTrial/);
    assert.match(onboarding, /BalanceMetaAdTrial\.onOnboardingComplete\(\)/);
    assert.match(onboarding, /BalanceMetaAdTrial\.hasPendingClaim\(\)/);
    assert.match(login, /applyMetaAdTrialHandoffCopy/);
    assert.match(landing, /id="open-installed"[^>]+hidden/);
    assert.match(landing, /native_handoff/);
    assert.match(logger, /'trial_gate_shown'/);
    assert.match(android, /getPendingMetaTrialQuery/);
    assert.match(ios, /enum BalanceMetaTrialHandoff/);
});
