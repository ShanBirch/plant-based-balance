/* First-party onboarding progress. Never collect answers or forward to ad pixels. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && root.document) root.BalanceOnboardingFunnel = api;
})(typeof window === 'undefined' ? null : window, function (root) {
    'use strict';
    const VERSION = 'onboarding_funnel_v1';
    const PHASES = ['entry', 'setup', 'question', 'screen', 'tour', 'task', 'payment', 'course'];
    const STATUSES = ['viewed', 'completed', 'skipped', 'blocked', 'left'];
    const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'campaign_id', 'adset_id', 'ad_id', 'creative_id'];
    const token = value => String(value || '').toLowerCase().replace(/[^a-z0-9_.:-]+/g, '_').slice(0, 80);
    function attribution(value) {
        const result = {};
        ATTRIBUTION_KEYS.forEach(key => {
            if (typeof value?.[key] === 'string') result[key] = value[key].slice(0, 128);
        });
        return result;
    }
    function normalize(input) {
        if (!input || !PHASES.includes(input.phase) || !STATUSES.includes(input.status)) return null;
        const step = token(input.step);
        if (!step || !/^[a-z0-9-]{8,80}$/i.test(input.event_id || '') || !/^[a-z0-9-]{8,80}$/i.test(input.visitor_id || '') || !/^[a-z0-9-]{8,64}$/i.test(input.session_id || '')) return null;
        return {
            event_id: input.event_id, visitor_id: input.visitor_id, session_id: input.session_id,
            replay_session_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.replay_session_id || '') ? input.replay_session_id : null,
            phase: input.phase, step, status: input.status,
            course_id: input.phase === 'course' ? token(input.course_id) : '',
            lesson_id: input.phase === 'course' ? token(input.lesson_id) : '',
            flow: ['member', 'preview', 'transferred'].includes(input.flow) ? input.flow : 'member',
            mode: token(input.mode || 'setup'),
            step_number: Math.min(100, Math.max(0, Number(input.step_number) || 0)),
            duration_ms: Math.min(3600000, Math.max(0, Number(input.duration_ms) || 0)),
            test_mode: input.test_mode === true,
            meta_ref: typeof input.meta_ref === 'string' ? input.meta_ref.slice(0, 700) : '',
            occurred_at: Number.isFinite(Date.parse(input.occurred_at)) ? new Date(input.occurred_at).toISOString() : new Date().toISOString(),
            first_touch: attribution(input.first_touch), last_touch: attribution(input.last_touch)
        };
    }

    const memory = {};
    const active = new Map();
    const recent = new Map();
    let lastViewed = null;
    let replayContext = null;
    function read(key, kind) {
        try { return root[kind || 'localStorage'].getItem(key); } catch (_) { return memory[key] || null; }
    }
    function write(key, value, kind) {
        memory[key] = value;
        try { root[kind || 'localStorage'].setItem(key, value); } catch (_) {}
    }
    function parse(value) { try { return JSON.parse(value || '{}') || {}; } catch (_) { return {}; } }
    function id(prefix) {
        return prefix + '-' + (root.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2));
    }
    function storedId(key, prefix, kind) {
        let value = read(key, kind);
        if (!value) { value = id(prefix); write(key, value, kind); }
        return value;
    }
    async function deliver(payload, owner) {
        try {
            if (owner && String(root.currentUser?.id || root.currentUser?.user_id || '') !== owner) return;
            const headers = { 'Content-Type': 'application/json' };
            const client = root.supabaseClient;
            if (client?.auth?.getSession && !root.guestMode) {
                const result = await client.auth.getSession();
                if (owner && result?.data?.session?.user?.id !== owner) return;
                if (result?.data?.session?.access_token) headers.Authorization = 'Bearer ' + result.data.session.access_token;
            }
            const response = await root.fetch('/.netlify/functions/onboarding-progress', {
                method: 'POST', headers, body: JSON.stringify(payload), keepalive: true
            });
            if (!response.ok) throw new Error('event_not_saved');
        } catch (_) {
            // A bounded retry uses the same event ID, so a lost response cannot double count.
            if (!payload.retried) root.setTimeout(() => deliver(Object.assign({}, payload, { retried: true }), owner), 3000);
        }
    }
    function track(phase, step, status, details) {
        if (!root || root.isAdminViewing) return;
        try {
            details = details || {};
            const mode = token(details.mode || 'setup');
            const key = phase + ':' + mode + ':' + token(step);
            const entryPreview = /(?:^|[?&])(?:account_first|meta_preview)=1(?:&|$)/.test(root.location?.search || '');
            const flow = active.get(key)?.flow || (root.__pbbTransferredSetupPending ? 'transferred' : root.metaAdTrialMode || entryPreview ? 'preview' : 'member');
            const now = Date.now();
            if (status === 'viewed' && active.has(key)) return;
            if (status !== 'viewed' && now - (recent.get(key + ':' + status) || 0) < 1000) return;
            recent.set(key + ':' + status, now);
            if (status === 'viewed') {
                // Re-rendering the same question does not create another view. Back navigation does.
                for (const [otherKey, item] of active) {
                    if (phase !== 'setup' && item.phase === phase && token(item.details.mode || 'setup') === mode) active.delete(otherKey);
                }
                lastViewed = { phase, step, details };
                active.set(key, { phase, step, details, flow, at: now });
            }
            const start = active.get(key);
            const first = parse(read('balance_first_touch'));
            const last = parse(read('balance_last_touch'));
            const trial = root.BalanceMetaAdTrial?.readState?.();
            const currentAttribution = Object.assign({}, last, root.metaAdTrialMode ? trial?.attribution : {});
            const profile = root.currentUserProfile || root.userProfile || {};
            const payload = normalize({
                event_id: id('event'),
                visitor_id: storedId('balance_visitor_id', 'visitor'),
                session_id: storedId('balance_analytics_session_id', 'session', 'sessionStorage'),
                phase, step, status, mode, step_number: details.step_number,
                course_id: details.course_id, lesson_id: details.lesson_id,
                duration_ms: status !== 'viewed' && start ? now - start.at : 0,
                flow,
                test_mode: root.__balanceOnboardingAnalyticsTest === true || profile.is_test_account === true,
                occurred_at: new Date(now).toISOString(), meta_ref: currentAttribution.meta_ref || first.meta_ref || '',
                first_touch: Object.keys(first).length ? first : currentAttribution, last_touch: currentAttribution
            });
            if (status !== 'viewed') active.delete(key);
            if (status === 'completed' && lastViewed?.phase === phase && lastViewed?.step === step) lastViewed = null;
            if (payload) {
                const owner = String(root.currentUser?.id || root.currentUser?.user_id || '');
                if (owner && !root.guestMode) replayContext = { owner, value: { phase, step: payload.step, status, step_number: payload.step_number } };
                const replay = root.BalanceReplay;
                if (!replay?.markOnboarding) deliver(payload, owner);
                else {
                    // Replay startup is optional and bounded; it never delays
                    // navigation or prevents the independent funnel event.
                    let timer;
                    Promise.race([
                        Promise.resolve().then(() => replay.markOnboarding(payload)),
                        new Promise(resolve => { timer = root.setTimeout(() => resolve(null), 1500); })
                    ]).catch(() => null).then(sessionId => {
                        root.clearTimeout?.(timer);
                        payload.replay_session_id = sessionId || null;
                        deliver(payload, owner);
                    });
                }
            }
        } catch (_) { /* Measurement must never interrupt setup. */ }
    }
    if (root?.addEventListener) root.addEventListener('pagehide', () => {
        if (lastViewed) track(lastViewed.phase, lastViewed.step, 'left', lastViewed.details);
    });
    if (root?.location) {
        try {
            const params = new URLSearchParams(root.location.search);
            const incoming = {};
            ATTRIBUTION_KEYS.concat(['meta_ref']).forEach(key => { if (params.get(key)) incoming[key] = params.get(key); });
            if (Object.keys(incoming).length) {
                if (!Object.keys(parse(read('balance_first_touch'))).length) write('balance_first_touch', JSON.stringify(incoming));
                write('balance_last_touch', JSON.stringify(incoming));
            }
            if (params.get('meta_preview') === '1' || /\/meta-app-preview\.html$/.test(root.location.pathname) || /^\/p\//.test(root.location.pathname)) track('entry', 'ad_handoff_opened', 'viewed');
            if (/\/login\.html$/.test(root.location.pathname) && params.get('account_first') === '1') track('entry', 'account_page', 'viewed');
        } catch (_) {}
    }
    function course(eventName, data = {}) {
        const name = token(eventName);
        if (!/^(course_|foundations_|locked_course_)/.test(name)) return;
        const lesson = token(data.lesson_id || data.topic_id);
        const week = Number(data.week_number || data.starting_week) || 0;
        const step = name + (lesson ? ':' + lesson : week ? ':week_' + week : '');
        const status = /_completed$/.test(name) ? 'completed' : /locked_tapped$/.test(name) ? 'blocked' : 'viewed';
        track('course', step, status, { mode: data.course_id, course_id: data.course_id, lesson_id: lesson, step_number: week });
    }
    return { VERSION, normalize, track, course, getReplayContext: owner => replayContext?.owner === owner ? replayContext.value : null };
});
