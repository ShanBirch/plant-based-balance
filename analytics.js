// Balance first-party attribution and funnel analytics.
(function () {
    'use strict';

    if (window.__balanceAnalyticsLoaded) return;
    window.__balanceAnalyticsLoaded = true;
    const firstPartyOnly = document.currentScript?.dataset?.firstPartyOnly === 'true';
    const memory = {};
    function read(key, kind = 'localStorage') {
        try { return (kind === 'localStorage' ? localStorage : sessionStorage).getItem(key); }
        catch (_) { return memory[kind + key] || null; }
    }
    function write(key, value, kind = 'localStorage') {
        memory[kind + key] = value;
        try { (kind === 'localStorage' ? localStorage : sessionStorage).setItem(key, value); } catch (_) {}
    }

    const ATTRIBUTION_KEYS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'campaign_id', 'adset_id', 'ad_id', 'creative_id',
        'placement', 'site_source_name', 'meta_ad_name', 'meta_ref'
    ];
    const FIRST_TOUCH_KEY = 'balance_first_touch';
    const LAST_TOUCH_KEY = 'balance_last_touch';
    const VISITOR_KEY = 'balance_visitor_id';
    const SESSION_KEY = 'balance_analytics_session_id';
    const EVENT_ENDPOINT = '/.netlify/functions/log-lp-event';
    const startedAt = Date.now();

    function safeParse(value, fallback) {
        try { return JSON.parse(value) || fallback; } catch (_) { return fallback; }
    }

    function randomId(prefix) {
        const value = window.crypto && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return `${prefix}-${value}`;
    }

    function persistentId(key, prefix, kind) {
        let value = read(key, kind);
        if (!value) {
            value = randomId(prefix);
            write(key, value, kind);
        }
        return value;
    }

    const visitorId = persistentId(VISITOR_KEY, 'visitor', 'localStorage');
    const sessionId = persistentId(SESSION_KEY, 'session', 'sessionStorage');
    const params = new URLSearchParams(window.location.search);
    if (params.get('analytics_test') === '1') write('balance_analytics_test', '1', 'sessionStorage');
    const testMode = read('balance_analytics_test', 'sessionStorage') === '1';
    if (testMode) window.__balanceOnboardingAnalyticsTest = true;
    const incoming = {};
    ATTRIBUTION_KEYS.forEach((key) => {
        const value = params.get(key);
        if (value) incoming[key] = value.slice(0, 500);
    });
    // Referrers identify a source, not whether an ad was paid for.
    try {
        const referrer = new URL(document.referrer);
        const siteHosts = ['plantbased-balance.org', 'balanceneurosciencefitness.com', 'future-balance.netlify.app'];
        if (!incoming.utm_source && !siteHosts.includes(referrer.hostname.replace(/^www\./, '')) && referrer.hostname !== new URL(window.location.href).hostname) {
            incoming.utm_source = /(^|\.)instagram\.com$/.test(referrer.hostname) ? 'instagram'
                : /(^|\.)facebook\.com$/.test(referrer.hostname) ? 'facebook' : referrer.hostname;
            incoming.utm_medium = incoming.utm_medium || 'referral';
        }
    } catch (_) {}

    // Paid Meta DMs use a short public path instead of exposing a long tracking
    // query. The compact base-36 suffix carries the unique numeric Meta ad ID;
    // campaign, ad-set and creative details remain joinable from that ID.
    const shortMetaRoute = window.location.pathname.match(/^\/(founders|fitness)\/([0-9a-z]+)\/?$/i);
    if (shortMetaRoute && !incoming.ad_id) {
        try {
            let decoded = 0n;
            for (const char of shortMetaRoute[2].toLowerCase()) {
                const digit = parseInt(char, 36);
                if (!Number.isInteger(digit) || digit < 0 || digit > 35) throw new Error('invalid short Meta reference');
                decoded = decoded * 36n + BigInt(digit);
            }
            incoming.ad_id = decoded.toString();
            incoming.utm_source = incoming.utm_source || 'instagram';
            incoming.utm_medium = incoming.utm_medium || 'dm';
            incoming.utm_campaign = incoming.utm_campaign || (shortMetaRoute[1].toLowerCase() === 'fitness'
                ? 'founders_pass_broad_pain'
                : 'founders_pass_plant_based');
            incoming.utm_content = incoming.utm_content || 'dm_handoff';
        } catch (_) {}
    }

    const now = new Date().toISOString();
    const firstTouch = safeParse(read(FIRST_TOUCH_KEY), {});
    const previousLastTouch = safeParse(read(LAST_TOUCH_KEY), {});
    if (Object.keys(incoming).length) {
        const touch = {
            ...incoming,
            landing_url: window.location.href,
            captured_at: now,
        };
        if (!Object.keys(firstTouch).length) write(FIRST_TOUCH_KEY, JSON.stringify(touch));
        write(LAST_TOUCH_KEY, JSON.stringify(touch));
        // A new source must not inherit an old paid campaign or ad ID.
        write('utm_data', JSON.stringify(touch), 'sessionStorage');
    } else if (!read('utm_data', 'sessionStorage') && Object.keys(previousLastTouch).length) {
        write('utm_data', JSON.stringify(previousLastTouch), 'sessionStorage');
    }

    function getAttribution() {
        const first = safeParse(read(FIRST_TOUCH_KEY), {});
        const last = safeParse(read(LAST_TOUCH_KEY), {});
        const session = safeParse(read('utm_data', 'sessionStorage'), {});
        return {
            ...last,
            ...session,
            first_touch: first,
            last_touch: last,
            visitor_id: visitorId,
            session_id: sessionId,
        };
    }

    window.getUTMData = getAttribution;
    window.getAttributionData = getAttribution;
    window.getFBParams = function () {
        const getCookie = (name) => {
            const parts = `; ${document.cookie}`.split(`; ${name}=`);
            return parts.length === 2 ? parts.pop().split(';').shift() : null;
        };
        return { fbc: getCookie('_fbc'), fbp: getCookie('_fbp') };
    };

    function pageVariant() {
        return document.body?.dataset?.landingVariant
            || document.documentElement.dataset.landingVariant
            || 'general';
    }

    function landingPage() {
        return document.body?.dataset?.landingPage
            || document.documentElement.dataset.landingPage
            || window.location.pathname.replace(/^\//, '')
            || 'home';
    }

    function cleanMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') return {};
        const clean = {};
        Object.entries(metadata).slice(0, 30).forEach(([key, value]) => {
            if (value === undefined || value === null) return;
            clean[String(key).slice(0, 80)] = typeof value === 'string' ? value.slice(0, 500) : value;
        });
        return clean;
    }

    function eventPayload(eventType, metadata) {
        const attribution = getAttribution();
        const fb = window.getFBParams();
        const details = cleanMetadata(metadata);
        return {
            event_id: randomId('event'),
            event_type: eventType,
            session_id: sessionId,
            visitor_id: visitorId,
            landing_page: landingPage(),
            page_variant: pageVariant(),
            page_url: window.location.href,
            viewport_w: window.innerWidth,
            viewport_h: window.innerHeight,
            target: details.target || null,
            target_text: details.target_text || null,
            scroll_depth: Number.isFinite(Number(details.scroll_depth)) ? Number(details.scroll_depth) : null,
            duration_ms: Number.isFinite(Number(details.duration_ms)) ? Number(details.duration_ms) : null,
            utm_source: attribution.utm_source || null,
            utm_medium: attribution.utm_medium || null,
            utm_campaign: attribution.utm_campaign || null,
            utm_term: attribution.utm_term || null,
            utm_content: attribution.utm_content || null,
            fbclid: attribution.fbclid || null,
            fbc: fb.fbc,
            fbp: fb.fbp,
            referrer: document.referrer || null,
            user_agent: navigator.userAgent,
            metadata: cleanMetadata({
                tracking_version: 'public_funnel_v2',
                test_mode: testMode,
                traffic_type: /bot|crawler|spider|GoogleOther|Headless/i.test(navigator.userAgent) ? 'bot' : 'browser',
                campaign_id: attribution.campaign_id || null,
                adset_id: attribution.adset_id || null,
                ad_id: attribution.ad_id || null,
                creative_id: attribution.creative_id || null,
                placement: attribution.placement || null,
                site_source_name: attribution.site_source_name || null,
                meta_ad_name: attribution.meta_ad_name || null,
                meta_ref: attribution.meta_ref || null,
                ...details,
            }),
        };
    }

    function sendEvent(eventType, metadata, useBeacon) {
        const payload = eventPayload(eventType, metadata);
        try {
            const queued = useBeacon && navigator.sendBeacon && navigator.sendBeacon(EVENT_ENDPOINT, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
            if (!queued) {
                fetch(EVENT_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true,
                }).catch(() => {});
            }
        } catch (_) {}

        if (!firstPartyOnly && !testMode && typeof window.gtag === 'function') {
            window.gtag('event', eventType, {
                page_variant: payload.page_variant,
                landing_page: payload.landing_page,
                ...payload.metadata,
            });
        }
        return payload.event_id;
    }

    window.trackBalanceEvent = (eventType, metadata) => sendEvent(eventType, metadata, false);

    const GA_MEASUREMENT_ID = 'G-X4MJFTSBC3';
    if (!firstPartyOnly && !testMode && !document.querySelector(`script[src*="${GA_MEASUREMENT_ID}"]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
    }

    function startPageTracking() {
        sendEvent('page_view', { title: document.title }, false);

        const sentScrollDepths = new Set();
        const checkScroll = () => {
            const documentHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
            const depth = Math.min(100, Math.round((window.scrollY / documentHeight) * 100));
            [25, 50, 75, 90].forEach((milestone) => {
                if (depth >= milestone && !sentScrollDepths.has(milestone)) {
                    sentScrollDepths.add(milestone);
                    sendEvent('scroll', { scroll_depth: milestone }, false);
                }
            });
        };
        window.addEventListener('scroll', checkScroll, { passive: true });

        document.addEventListener('click', (event) => {
            const target = event.target.closest?.('a,button,[data-track]');
            if (!target) return;
            const eventName = target.dataset.track || (target.classList.contains('checkout-btn') ? 'checkout_click' : 'click');
            const href = target.dataset.trackHref || target.getAttribute('href');
            let destination = null;
            try { if (href) destination = new URL(href, window.location.href); } catch (_) {}
            const store = destination?.hostname === 'apps.apple.com' ? 'ios' : destination?.hostname === 'play.google.com' ? 'android' : null;
            const details = {
                target: target.id || target.getAttribute('href') || target.className || target.tagName,
                target_text: (target.innerText || target.getAttribute('aria-label') || '').trim().slice(0, 200),
                destination: destination ? destination.origin + destination.pathname : undefined,
                link_group: target.dataset.bioLink || undefined,
                platform: store || undefined,
            };
            sendEvent(eventName, details, true);
            // Store handoff is a click, never proof of a completed installation.
            if (store && eventName !== 'app_download_click') sendEvent('app_download_click', details, true);
        }, true); // Capture before download handlers stop propagation or leave the page.

        let sentDuration = false;
        const sendDuration = () => {
            if (sentDuration) return;
            sentDuration = true;
            sendEvent('time_on_page', { duration_ms: Date.now() - startedAt }, true);
        };
        window.addEventListener('pagehide', sendDuration);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') sendDuration();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPageTracking, { once: true });
    } else {
        startPageTracking();
    }
})();
