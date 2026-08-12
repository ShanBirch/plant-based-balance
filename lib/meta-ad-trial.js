/* Balance paid-Meta five-minute preview.
 *
 * Activation is deliberately narrow: the entry must carry the durable
 * experiment key plus verified Facebook/Instagram paid-social attribution. Organic
 * guest sessions keep their existing behaviour.
 */
(function (root, factory) {
    const api = factory(root || {});
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BalanceMetaAdTrial = api;
})(typeof window !== 'undefined' ? window : globalThis, function (window) {
    'use strict';

    const VARIANT = 'facebook_5m_foundations_v3';
    const LEGACY_VARIANTS = ['facebook_5m_paid_v2', 'facebook_5m_v1'];
    const DURATION_MS = 5 * 60 * 1000;
    const META_FOUNDATIONS_PRICE_ID = 'balance_meta_foundations_pass';
    const META_FOUNDATIONS_PRICE_AUD = 89;
    const STATE_KEY = 'pbb_meta_ad_trial_state_v1';
    const CLAIM_KEY = 'pbb_meta_ad_trial_claim_pending_v1';
    const PAYMENT_SESSION_KEY = 'pbb_meta_ad_trial_checkout_session_v1';
    const PAYMENT_PLAN_KEY = 'pbb_meta_ad_trial_checkout_plan_v1';
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
        if (![VARIANT].concat(LEGACY_VARIANTS).includes(params.get('meta_trial'))) return false;
        const source = String(params.get('utm_source') || '').trim().toLowerCase();
        const medium = String(params.get('utm_medium') || '').trim().toLowerCase();
        const hasMetaSource = ['facebook', 'fb', 'instagram', 'ig', 'meta'].includes(source);
        const hasPaidMedium = ['paid_social', 'paidsocial', 'cpc'].includes(medium);
        return hasMetaSource && (hasPaidMedium || !!params.get('fbclid'));
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
        if (!state || ![VARIANT].concat(LEGACY_VARIANTS).includes(state.variant)) return null;
        if (LEGACY_VARIANTS.includes(state.variant) && !state.claimedAt) {
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
        session.removeItem(PAYMENT_PLAN_KEY);
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
            walkthroughCompletedAt: isNew ? null : existing.walkthroughCompletedAt || null,
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
        if (!state.onboardingCompletedAt) {
            state.onboardingCompletedAt = Date.now();
            track('onboarding_completed', { trial_stage: 'onboarding' });
        }
        if (state.interruptedStage === 'onboarding') state.interruptedStage = null;
        writeState(state);
        updateBanner();
        return true;
    }

    function onWalkthroughComplete(options) {
        const state = readState();
        if (!state || state.claimedAt) return false;
        const now = Date.now();
        if (!state.walkthroughCompletedAt) {
            state.walkthroughCompletedAt = now;
            track('trial_walkthrough_completed', {
                trial_stage: 'walkthrough',
                skipped: !!(options && options.skipped)
            });
        }
        if (!state.previewStartedAt) {
            state.previewStartedAt = now;
            state.deadlineAt = now + DURATION_MS;
            track('trial_preview_started', { duration_seconds: DURATION_MS / 1000 });
        }
        state.interruptedStage = null;
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
            label.textContent = state && state.onboardingCompletedAt
                ? 'Your five-minute preview starts after this walkthrough'
                : 'Your five-minute preview starts after setup';
            return;
        }
        label.textContent = 'Free Balance preview: ' + formatRemaining(state.deadlineAt - Date.now()) + ' left';
    }

    function formatPreviewPostDate(value) {
        const parsed = Date.parse(value || '');
        if (!Number.isFinite(parsed)) return 'Balance community';
        try {
            return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(parsed));
        } catch (_) {
            return 'Balance community';
        }
    }

    function hideExitChoice() {
        if (!window.document) return;
        const exitChoice = window.document.getElementById('meta-ad-trial-exit-choice');
        if (exitChoice) exitChoice.style.display = 'none';
    }

    function showExitChoice(stage) {
        if (!window.document || !isActive()) return false;
        const normalizedStage = stage === 'tour' ? 'tour' : 'onboarding';
        const state = readState();
        const exitChoice = window.document.getElementById('meta-ad-trial-exit-choice');
        if (!state || !exitChoice) return false;

        state.interruptedStage = normalizedStage;
        writeState(state);
        const title = window.document.getElementById('meta-ad-trial-exit-title');
        const body = window.document.getElementById('meta-ad-trial-exit-body');
        const resumeButton = window.document.getElementById('meta-ad-trial-resume-btn');
        if (title) title.textContent = normalizedStage === 'tour' ? 'Keep looking around?' : 'Finish setting up your plan?';
        if (body) body.textContent = normalizedStage === 'tour'
            ? 'Restart the guided app tour, or unlock the complete six-week program now.'
            : 'Continue your setup so Balance can finish your starter week, or unlock the complete six-week program now.';
        if (resumeButton) resumeButton.textContent = normalizedStage === 'tour' ? 'RESTART APP TOUR' : 'CONTINUE SETUP';
        exitChoice.style.display = 'flex';
        window.document.documentElement.classList.add('pbb-meta-trial-gated');
        track('trial_flow_interrupted', { trial_stage: normalizedStage });
        return true;
    }

    function resumeInterruptedFlow() {
        if (!isActive()) return false;
        const state = readState();
        const stage = state && state.interruptedStage === 'tour' ? 'tour' : 'onboarding';
        if (state) {
            state.interruptedStage = null;
            writeState(state);
        }
        hideExitChoice();
        if (window.document) window.document.documentElement.classList.remove('pbb-meta-trial-gated');
        track('trial_flow_resumed', { trial_stage: stage });
        if (stage === 'tour') {
            const local = storage('localStorage');
            if (local) local.removeItem('featureTourComplete');
            window.setTimeout(function () {
                if (typeof window.startFeatureTour === 'function') {
                    window.startFeatureTour(false, { metaPreview: true });
                }
            }, 0);
            return true;
        }
        if (typeof window.resumeMetaAdTrialOnboarding === 'function') {
            window.resumeMetaAdTrialOnboarding();
            return true;
        }
        if (typeof window.checkAndTriggerOnboarding === 'function') {
            window.checkAndTriggerOnboarding();
            return true;
        }
        return false;
    }

    function showInboxPreview() {
        if (!window.document || !isActive()) return false;
        const preview = window.document.getElementById('meta-ad-trial-inbox-preview');
        if (!preview) return false;
        preview.style.display = 'flex';
        track('trial_inbox_preview_viewed', { trial_stage: 'walkthrough' });
        return true;
    }

    function hideInboxPreview() {
        if (!window.document) return;
        const preview = window.document.getElementById('meta-ad-trial-inbox-preview');
        if (preview) preview.style.display = 'none';
    }

    function renderPreviewFeed(posts) {
        if (!window.document || !Array.isArray(posts)) return false;
        const container = window.document.getElementById('friends-photo-feed');
        if (!container) return false;
        container.querySelectorAll('[data-meta-preview-post="true"]').forEach(function (node) { node.remove(); });

        posts.slice(0, 4).forEach(function (post) {
            const card = window.document.createElement('article');
            card.className = 'feed-post-card meta-preview-feed-post';
            card.setAttribute('data-meta-preview-post', 'true');
            card.style.cssText = 'margin:0 15px 14px;background:#fff;border:1px solid #eadfca;border-radius:18px;overflow:hidden;box-shadow:0 7px 24px rgba(48,34,18,.08);';

            const header = window.document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:13px 14px 11px;';
            const mark = window.document.createElement('div');
            mark.textContent = 'B';
            mark.setAttribute('aria-hidden', 'true');
            mark.style.cssText = 'width:34px;height:34px;border:1px solid #b2872f;border-radius:50%;display:grid;place-items:center;color:#8b6519;font:700 15px Georgia,serif;background:#fffaf0;';
            const byline = window.document.createElement('div');
            const author = window.document.createElement('strong');
            author.textContent = post.author || 'Coach Shan';
            author.style.cssText = 'display:block;color:#21172b;font-size:.9rem;';
            const date = window.document.createElement('span');
            date.textContent = formatPreviewPostDate(post.created_at);
            date.style.cssText = 'display:block;color:#7b7280;font-size:.72rem;margin-top:2px;';
            byline.appendChild(author);
            byline.appendChild(date);
            header.appendChild(mark);
            header.appendChild(byline);
            card.appendChild(header);

            if (post.media_url) {
                const image = window.document.createElement('img');
                image.src = post.media_url;
                image.alt = post.caption ? 'Coach Shan community post: ' + post.caption.slice(0, 80) : 'Coach Shan community post';
                image.loading = 'lazy';
                image.style.cssText = 'display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f5efe4;';
                image.addEventListener('error', function () { image.remove(); }, { once: true });
                card.appendChild(image);
            }

            if (post.caption) {
                const caption = window.document.createElement('p');
                caption.textContent = post.caption;
                caption.style.cssText = 'margin:0;padding:13px 14px 15px;color:#30263a;font-size:.9rem;line-height:1.48;';
                card.appendChild(caption);
            }
            container.prepend(card);
        });
        return posts.length > 0;
    }

    async function loadPreviewFeed() {
        if (!isActive() || !window.fetch) return false;
        try {
            const response = await window.fetch('/.netlify/functions/meta-preview-feed', {
                method: 'GET', headers: { Accept: 'application/json' }
            });
            if (!response.ok) return false;
            const payload = await response.json();
            return renderPreviewFeed(Array.isArray(payload.posts) ? payload.posts : []);
        } catch (_) {
            return false;
        }
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
        const local = storage('localStorage');
        const analyticsSession = storage('sessionStorage');
        const visitorId = persistentId(VISITOR_KEY, 'visitor', local);
        const analyticsSessionId = persistentId(SESSION_KEY, 'session', analyticsSession);
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
                    priceId: META_FOUNDATIONS_PRICE_ID,
                    isTrial: false,
                    trialDays: 0,
                    email: email,
                    bump: false,
                    utm_data: Object.assign({}, state.attribution || {}, {
                        visitor_id: visitorId,
                        session_id: analyticsSessionId
                    }),
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
            if (session) session.setItem(PAYMENT_PLAN_KEY, 'balance_foundations_six_week');
            track('checkout_started', { plan: 'balance_foundations_six_week', amount_aud: META_FOUNDATIONS_PRICE_AUD, stripe_session_id: result.sessionId });
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
            track('checkout_error', { plan: 'balance_foundations_six_week', message: error && error.message || 'request_failed' });
            setError(error && error.message || 'Stripe checkout is unavailable. Please try again.');
            if (button) { button.disabled = false; button.textContent = 'START FOUNDATIONS'; }
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
        hideExitChoice();
        hideInboxPreview();
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
        if (force || state.interruptedStage) {
            state.interruptedStage = 'checkout';
            writeState(state);
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
            const ready = function () {
                updateBanner();
                scheduleGate();
                if (state && ['onboarding', 'tour'].includes(state.interruptedStage)) {
                    showExitChoice(state.interruptedStage);
                } else if (state && state.interruptedStage === 'checkout') {
                    showGate(true);
                }
            };
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
        META_FOUNDATIONS_PRICE_ID: META_FOUNDATIONS_PRICE_ID,
        META_FOUNDATIONS_PRICE_AUD: META_FOUNDATIONS_PRICE_AUD,
        STATE_KEY: STATE_KEY,
        CLAIM_KEY: CLAIM_KEY,
        PAYMENT_SESSION_KEY: PAYMENT_SESSION_KEY,
        PAYMENT_PLAN_KEY: PAYMENT_PLAN_KEY,
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
        onWalkthroughComplete: onWalkthroughComplete,
        showExitChoice: showExitChoice,
        resumeInterruptedFlow: resumeInterruptedFlow,
        showInboxPreview: showInboxPreview,
        hideInboxPreview: hideInboxPreview,
        loadPreviewFeed: loadPreviewFeed,
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
