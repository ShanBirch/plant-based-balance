/* Balance paid-Facebook five-minute preview.
 *
 * Activation is deliberately narrow: the entry must carry the durable
 * experiment key plus verified Facebook paid-social attribution. Organic
 * guest sessions keep their existing behaviour.
 */
(function (root, factory) {
    const api = factory(root || {});
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BalanceMetaAdTrial = api;
})(typeof window !== 'undefined' ? window : globalThis, function (window) {
    'use strict';

    const VARIANT = 'facebook_5m_paid_v2';
    const LEGACY_VARIANT = 'facebook_5m_v1';
    const DURATION_MS = 5 * 60 * 1000;
    const STATE_KEY = 'pbb_meta_ad_trial_state_v1';
    const CLAIM_KEY = 'pbb_meta_ad_trial_claim_pending_v1';
    const PAYMENT_SESSION_KEY = 'pbb_meta_ad_trial_checkout_session_v1';
    const CHECKOUT_EMAIL_KEY = 'pbb_meta_ad_trial_checkout_email_v1';
    const COMPLIANCE_SESSION_KEY = 'balance_compliance_session_id';
    const FIRST_TOUCH_KEY = 'balance_first_touch';
    const LAST_TOUCH_KEY = 'balance_last_touch';
    const VISITOR_KEY = 'balance_visitor_id';
    const SESSION_KEY = 'balance_analytics_session_id';
    const EVENT_ENDPOINT = '/.netlify/functions/log-lp-event';
    const ATTRIBUTION_KEYS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'creative_id',
        'placement', 'site_source_name', 'meta_ad_name', 'meta_ref'
    ];
    let gateTimer = null;
    let countdownTimer = null;

    function storage(name) {
        try { return window[name] || null; } catch (_) { return null; }
    }

    function safeParse(value, fallback) {
        try { return JSON.parse(value) || fallback; } catch (_) { return fallback; }
    }

    function randomId(prefix) {
        let value = '';
        try {
            value = window.crypto && window.crypto.randomUUID
                ? window.crypto.randomUUID()
                : '';
        } catch (_) {}
        if (!value) value = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        return prefix + '-' + value;
    }

    function persistentId(key, prefix, targetStorage) {
        if (!targetStorage) return randomId(prefix);
        let value = targetStorage.getItem(key);
        if (!value) {
            value = randomId(prefix);
            targetStorage.setItem(key, value);
        }
        return value;
    }

    function normalizeParams(input) {
        if (input instanceof URLSearchParams) return input;
        return new URLSearchParams(String(input || '').replace(/^\?/, ''));
    }

    function isVerifiedEntry(input) {
        const params = normalizeParams(input);
        if (![VARIANT, LEGACY_VARIANT].includes(params.get('meta_trial'))) return false;
        const source = String(params.get('utm_source') || '').trim().toLowerCase();
        const medium = String(params.get('utm_medium') || '').trim().toLowerCase();
        const hasFacebookSource = ['facebook', 'fb', 'meta'].includes(source);
        const hasPaidMedium = ['paid_social', 'paidsocial', 'cpc'].includes(medium);
        return hasFacebookSource && (hasPaidMedium || !!params.get('fbclid'));
    }

    function extractAttribution(params) {
        const attribution = {};
        ATTRIBUTION_KEYS.forEach(function (key) {
            const value = params.get(key);
            if (value) attribution[key] = String(value).slice(0, 500);
        });
        return attribution;
    }

    function readState() {
        const local = storage('localStorage');
        if (!local) return null;
        const state = safeParse(local.getItem(STATE_KEY), null);
        if (!state || ![VARIANT, LEGACY_VARIANT].includes(state.variant)) return null;
        if (state.variant === LEGACY_VARIANT && !state.claimedAt) {
            state.variant = VARIANT;
            local.setItem(STATE_KEY, JSON.stringify(state));
        }
        return state;
    }

    function writeState(state) {
        const local = storage('localStorage');
        if (local) local.setItem(STATE_KEY, JSON.stringify(state));
        return state;
    }

    function preserveAttribution(attribution) {
        const local = storage('localStorage');
        const session = storage('sessionStorage');
        if (!local || !session || !Object.keys(attribution).length) return;
        const touch = Object.assign({}, attribution, {
            landing_url: window.location ? window.location.href : '',
            captured_at: new Date().toISOString()
        });
        const first = safeParse(local.getItem(FIRST_TOUCH_KEY), {});
        if (!Object.keys(first).length) local.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
        local.setItem(LAST_TOUCH_KEY, JSON.stringify(touch));
        session.setItem('utm_data', JSON.stringify(touch));
    }

    function resetOnboardingForNewTrial() {
        const local = storage('localStorage');
        const session = storage('sessionStorage');
        if (!local || !session) return;
        [
            'onboardingComplete', 'plantbased_onboarding_complete', 'onboardingCompletedAt',
            'featureTourComplete', 'userProfile', 'userGender', 'userCycleData',
            'user_food_preferences', 'dietaryPreference', 'pbb_fitgotchi_visibility',
            'pbb_fitgotchi_needs_character_setup'
        ].forEach(function (key) { local.removeItem(key); });
        session.removeItem('userProfile');
        session.removeItem('userResult');
        session.removeItem(CLAIM_KEY);
        session.removeItem(PAYMENT_SESSION_KEY);
        session.removeItem(CHECKOUT_EMAIL_KEY);
    }

    function activate(input, sourceLabel) {
        const params = normalizeParams(input);
        if (!isVerifiedEntry(params)) return false;
        const existing = readState();
        // Someone who already claimed this preview may be a signed-in member.
        // Never clear their local onboarding data if they tap the ad again.
        if (existing && existing.claimedAt) return false;
        const attribution = Object.assign({}, existing && existing.attribution || {}, extractAttribution(params));
        const isNew = !existing;
        if (isNew) resetOnboardingForNewTrial();
        const state = writeState({
            variant: VARIANT,
            source: sourceLabel || 'web',
            activatedAt: isNew ? Date.now() : existing.activatedAt,
            onboardingCompletedAt: isNew ? null : existing.onboardingCompletedAt || null,
            previewStartedAt: isNew ? null : existing.previewStartedAt || null,
            deadlineAt: isNew ? null : existing.deadlineAt || null,
            gateShownAt: isNew ? null : existing.gateShownAt || null,
            claimedAt: null,
            attribution: attribution
        });
        preserveAttribution(attribution);
        const session = storage('sessionStorage');
        if (session) session.setItem('guestMode', 'true');
        window.metaAdTrialMode = true;
        if (isNew) track('trial_started', { source: sourceLabel || 'web' });
        return !!state;
    }

    function activateFromNativeQuery(query) {
        return activate(query, 'native_deep_link');
    }

    function isActive() {
        const state = readState();
        if (!state || state.claimedAt) return false;
        const session = storage('sessionStorage');
        return !!(window.metaAdTrialMode || (session && session.getItem('guestMode') === 'true'));
    }

    function track(eventType, metadata) {
        const state = readState();
        if (!state) return null;
        const local = storage('localStorage');
        const session = storage('sessionStorage');
        const attribution = state.attribution || {};
        const visitorId = persistentId(VISITOR_KEY, 'visitor', local);
        const sessionId = persistentId(SESSION_KEY, 'session', session);
        const eventId = randomId('event');
        const details = Object.assign({ experiment: VARIANT }, metadata || {});
        const payload = {
            event_id: eventId,
            event_type: eventType,
            session_id: sessionId,
            visitor_id: visitorId,
            landing_page: 'meta-app-preview',
            page_variant: VARIANT,
            page_url: window.location ? window.location.href : '',
            viewport_w: window.innerWidth || null,
            viewport_h: window.innerHeight || null,
            utm_source: attribution.utm_source || null,
            utm_medium: attribution.utm_medium || null,
            utm_campaign: attribution.utm_campaign || null,
            utm_term: attribution.utm_term || null,
            utm_content: attribution.utm_content || null,
            fbclid: attribution.fbclid || null,
            referrer: window.document ? window.document.referrer || null : null,
            user_agent: window.navigator ? window.navigator.userAgent || '' : '',
            metadata: Object.assign({}, attribution, details)
        };
        try {
            window.fetch(EVENT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(function () {});
        } catch (_) {}
        return eventId;
    }

    function onOnboardingStarted() {
        const state = readState();
        if (!state || state.onboardingStartedAt) return;
        state.onboardingStartedAt = Date.now();
        writeState(state);
        track('onboarding_started', { trial_stage: 'onboarding' });
    }

    function onOnboardingComplete() {
        const state = readState();
        if (!state || state.claimedAt) return false;
        const now = Date.now();
        if (!state.onboardingCompletedAt) {
            state.onboardingCompletedAt = now;
            track('onboarding_completed', { trial_stage: 'onboarding' });
        }
        if (!state.previewStartedAt) {
            state.previewStartedAt = now;
            state.deadlineAt = now + DURATION_MS;
            track('trial_preview_started', { duration_seconds: DURATION_MS / 1000 });
        }
        writeState(state);
        scheduleGate();
        return true;
    }

    function formatRemaining(milliseconds) {
        const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
        return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }

    function updateBanner() {
        if (!window.document || !isActive()) return;
        const state = readState();
        const banner = window.document.getElementById('guest-mode-banner');
        const label = window.document.getElementById('guest-mode-label');
        if (!banner || !label) return;
        banner.style.display = 'block';
        if (!state || !state.deadlineAt) {
            label.textContent = 'Your Facebook preview starts after onboarding';
            return;
        }
        label.textContent = 'Free Balance preview: ' + formatRemaining(state.deadlineAt - Date.now()) + ' left';
    }

    function checkoutCompliance(email) {
        const session = storage('sessionStorage');
        let complianceSessionId = session && session.getItem(COMPLIANCE_SESSION_KEY);
        if (!complianceSessionId) {
            complianceSessionId = randomId('meta-checkout');
            if (session) session.setItem(COMPLIANCE_SESSION_KEY, complianceSessionId);
        }
        const state = readState() || {};
        let profile = {};
        try { profile = safeParse((session && session.getItem('userProfile')) || '{}', {}); } catch (_) {}
        return {
            event_type: 'checkout_session_created',
            source_page: window.location ? window.location.pathname : '/dashboard.html',
            email: email,
            name: profile.name || '',
            plan_key: 'app-monthly',
            accepted: { terms: true, privacy: true, client_agreement: true, refund_policy: true },
            marketing_consent: Boolean(profile.marketing_consent || profile.email_marketing_consent),
            health_data_consent: true,
            document_versions: {
                terms: '2026-05-19', privacy: '2026-05-19',
                client_agreement: '2026-05-19', refund_policy: '2026-05-19'
            },
            profile: profile,
            screening: { safety_notes: profile.health_screening_notes || '' },
            metadata: {
                compliance_session_id: complianceSessionId,
                experiment: VARIANT,
                attribution: state.attribution || {}
            },
            idempotency_key: complianceSessionId + ':checkout_session_created:app-monthly'
        };
    }

    function cookieValue(name) {
        if (!window.document) return '';
        const prefix = name + '=';
        const value = String(window.document.cookie || '').split(';').map(function (part) { return part.trim(); })
            .find(function (part) { return part.indexOf(prefix) === 0; });
        return value ? decodeURIComponent(value.slice(prefix.length)) : '';
    }

    async function beginCheckout() {
        const emailInput = window.document && window.document.getElementById('meta-ad-trial-email');
        const termsInput = window.document && window.document.getElementById('meta-ad-trial-terms');
        const button = window.document && window.document.getElementById('meta-ad-trial-checkout-btn');
        const errorBox = window.document && window.document.getElementById('meta-ad-trial-error');
        const email = String(emailInput && emailInput.value || '').trim().toLowerCase();
        const setError = function (message) {
            if (errorBox) { errorBox.textContent = message || ''; errorBox.style.display = message ? 'block' : 'none'; }
        };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Enter the email you want to use for Balance.');
            if (emailInput) emailInput.focus();
            return false;
        }
        if (!termsInput || !termsInput.checked) {
            setError('Please accept the terms to continue.');
            return false;
        }
        setError('');
        if (button) { button.disabled = true; button.textContent = 'OPENING STRIPE...'; }
        const session = storage('sessionStorage');
        if (session) session.setItem(CHECKOUT_EMAIL_KEY, email);
        const state = readState() || {};
        const compliance = checkoutCompliance(email);
        try {
            try {
                await window.fetch('/.netlify/functions/record-compliance-event', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(compliance), keepalive: true
                });
            } catch (_) {}
            const response = await window.fetch('/.netlify/functions/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: 'balance_app_community_monthly',
                    isTrial: false,
                    trialDays: 0,
                    email: email,
                    bump: false,
                    utm_data: state.attribution || {},
                    fbc: cookieValue('_fbc'),
                    fbp: cookieValue('_fbp'),
                    returnPath: '/dashboard.html',
                    pageVariant: VARIANT,
                    checkoutSource: 'meta_ad_trial',
                    compliance: compliance
                })
            });
            const result = await response.json().catch(function () { return {}; });
            if (!response.ok || result.error || !result.sessionId) {
                throw new Error(result.error && result.error.message || 'Stripe checkout is unavailable. Please try again.');
            }
            if (session) session.setItem(PAYMENT_SESSION_KEY, result.sessionId);
            track('checkout_started', { plan: 'app_community_monthly', amount_aud: 19.99, stripe_session_id: result.sessionId });
            if (result.url && window.location) {
                window.location.href = result.url;
                return true;
            }
            if (window.stripe && typeof window.stripe.redirectToCheckout === 'function') {
                await window.stripe.redirectToCheckout({ sessionId: result.sessionId });
                return true;
            }
            throw new Error('Stripe checkout could not open. Please try again.');
        } catch (error) {
            track('checkout_error', { plan: 'app_community_monthly', message: error && error.message || 'request_failed' });
            setError(error && error.message || 'Stripe checkout is unavailable. Please try again.');
            if (button) { button.disabled = false; button.textContent = 'UNLOCK BALANCE'; }
            return false;
        }
    }

    function signupUrl() {
        return '/login.html?action=signup&source=meta_ad_trial';
    }

    function beginSignup() {
        const session = storage('sessionStorage');
        if (session) {
            session.setItem(CLAIM_KEY, 'true');
            session.removeItem('guestMode');
        }
        track('trial_signup_click', { trial_stage: 'gate' });
        if (window.location) window.location.href = signupUrl();
    }

    function showGate(force) {
        if (!window.document || !isActive()) return false;
        const state = readState();
        if (!state || (!force && (!state.deadlineAt || Date.now() < state.deadlineAt))) return false;
        const gate = window.document.getElementById('meta-ad-trial-gate');
        if (!gate) return false;
        gate.style.display = 'flex';
        const emailInput = window.document.getElementById('meta-ad-trial-email');
        const session = storage('sessionStorage');
        if (emailInput && !emailInput.value && session) {
            let profile = {};
            try { profile = safeParse(session.getItem('userProfile') || '{}', {}); } catch (_) {}
            emailInput.value = session.getItem(CHECKOUT_EMAIL_KEY) || session.getItem('userEmail') || profile.email || '';
        }
        window.document.documentElement.classList.add('pbb-meta-trial-gated');
        const tour = window.document.getElementById('guided-tour-overlay');
        if (tour) tour.classList.remove('active');
        if (!state.gateShownAt) {
            state.gateShownAt = Date.now();
            writeState(state);
            track('trial_gate_shown', { elapsed_seconds: force ? null : DURATION_MS / 1000, trigger: force ? 'manual_unlock' : 'timer_expired' });
        }
        return true;
    }

    function scheduleGate() {
        if (!isActive()) return;
        const state = readState();
        if (!state || !state.deadlineAt) {
            updateBanner();
            return;
        }
        if (gateTimer) window.clearTimeout(gateTimer);
        if (countdownTimer) window.clearInterval(countdownTimer);
        const remaining = state.deadlineAt - Date.now();
        if (remaining <= 0) {
            showGate();
            updateBanner();
            return;
        }
        updateBanner();
        countdownTimer = window.setInterval(function () {
            updateBanner();
            if (Date.now() >= state.deadlineAt) {
                window.clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }, 1000);
        gateTimer = window.setTimeout(showGate, remaining + 25);
    }

    function markSignupHandoff() {
        const params = window.location ? new URLSearchParams(window.location.search) : new URLSearchParams();
        if (!['meta_ad_trial', 'meta_ad_trial_paid'].includes(params.get('source'))) return false;
        const session = storage('sessionStorage');
        if (session) {
            session.setItem(CLAIM_KEY, 'true');
            session.removeItem('guestMode');
        }
        track('trial_signup_view', { trial_stage: 'signup' });
        return true;
    }

    function hasPendingClaim() {
        const session = storage('sessionStorage');
        return !!(session && session.getItem(CLAIM_KEY) === 'true' && readState());
    }

    function markClaimed(userId) {
        const state = readState();
        if (!state) return;
        state.claimedAt = Date.now();
        state.claimedUserId = userId || null;
        writeState(state);
        const session = storage('sessionStorage');
        if (session) {
            session.removeItem(CLAIM_KEY);
            session.removeItem('guestMode');
        }
        window.metaAdTrialMode = false;
        track('signup', { source: 'meta_ad_trial', user_id: userId || null });
    }

    function init() {
        let nativeQuery = window._pendingBalanceMetaTrialQuery || '';
        try {
            if (!nativeQuery && window.NativePermissions && typeof window.NativePermissions.getPendingMetaTrialQuery === 'function') {
                nativeQuery = window.NativePermissions.getPendingMetaTrialQuery() || '';
            }
        } catch (_) {}
        if (nativeQuery) activateFromNativeQuery(nativeQuery);

        const params = window.location ? new URLSearchParams(window.location.search) : new URLSearchParams();
        if (isVerifiedEntry(params)) activate(params, 'web_link');
        const state = readState();
        const session = storage('sessionStorage');
        const isDashboard = !!(window.location && /\/dashboard\.html$/.test(window.location.pathname || ''));
        const hasOAuthSessionHash = !!(window.location && /(?:^#|&)access_token=/.test(window.location.hash || ''));
        const isClaiming = !!(session && session.getItem(CLAIM_KEY) === 'true') || hasOAuthSessionHash;
        if (state && !state.claimedAt && !isClaiming && session && (session.getItem('guestMode') === 'true' || isDashboard)) {
            session.setItem('guestMode', 'true');
            window.metaAdTrialMode = true;
        }
        if (window.document) {
            const ready = function () { updateBanner(); scheduleGate(); };
            if (window.document.readyState === 'loading') {
                window.document.addEventListener('DOMContentLoaded', ready, { once: true });
            } else {
                ready();
            }
        }
    }

    const api = {
        VARIANT: VARIANT,
        DURATION_MS: DURATION_MS,
        STATE_KEY: STATE_KEY,
        CLAIM_KEY: CLAIM_KEY,
        PAYMENT_SESSION_KEY: PAYMENT_SESSION_KEY,
        CHECKOUT_EMAIL_KEY: CHECKOUT_EMAIL_KEY,
        isVerifiedEntry: isVerifiedEntry,
        extractAttribution: extractAttribution,
        readState: readState,
        activate: activate,
        activateFromNativeQuery: activateFromNativeQuery,
        isActive: isActive,
        track: track,
        onOnboardingStarted: onOnboardingStarted,
        onOnboardingComplete: onOnboardingComplete,
        scheduleGate: scheduleGate,
        showGate: showGate,
        openCheckoutGate: function () { return showGate(true); },
        beginCheckout: beginCheckout,
        beginSignup: beginSignup,
        signupUrl: signupUrl,
        markSignupHandoff: markSignupHandoff,
        hasPendingClaim: hasPendingClaim,
        markClaimed: markClaimed,
        init: init
    };

    if (window && window.location) init();
    return api;
});
