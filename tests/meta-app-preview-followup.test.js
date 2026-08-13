const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const refModulePath = '../netlify/functions/_lib/meta-app-preview-ref.js';
const loggerModulePath = '../netlify/functions/log-lp-event.js';

test('preview references are signed, short-lived, and retain the canonical destination', () => {
    const refs = require(refModulePath);
    const env = { META_APP_PREVIEW_REF_SECRET: 'preview-test-secret' };
    const nowMs = Date.parse('2026-08-05T00:00:00.000Z');
    const threadId = '11111111-1111-4111-8111-111111111111';
    const url = refs.buildMetaAppPreviewUrl(threadId, { nowMs, env });
    const parsedUrl = new URL(url);
    const token = parsedUrl.pathname.split('/').filter(Boolean).at(-1);

    assert.equal(parsedUrl.origin + parsedUrl.pathname.slice(0, 2), refs.META_APP_PREVIEW_SHORT_URL);
    assert.equal(parsedUrl.search, '');
    assert.ok(url.length < 90, `preview DM URL should stay compact, got ${url.length} characters`);
    assert.equal(refs.isMetaAppPreviewUrl(url), true);
    assert.equal(refs.verifyMetaAppPreviewRef(token, { nowMs, env }).threadId, threadId);
    assert.equal(refs.verifyMetaAppPreviewRef(`${token}broken`, { nowMs, env }), null);
    assert.equal(refs.verifyMetaAppPreviewRef(token, { nowMs: nowMs + refs.DEFAULT_TTL_MS + 1, env }), null);
});

test('a verified five-minute gate schedules one canonical IG follow-up and no outbound row', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'preview-test-secret';
    const originalFetch = global.fetch;
    const requests = [];
    const now = Date.now();
    const threadId = '22222222-2222-4222-8222-222222222222';
    const refs = require(refModulePath);
    const previewUrl = refs.buildMetaAppPreviewUrl(threadId, { nowMs: now });
    const token = new URL(previewUrl).pathname.split('/').filter(Boolean).at(-1);

    global.fetch = async (url, options = {}) => {
        requests.push({ url: String(url), options });
        let body = [];
        if (String(url).includes('/ig_threads?')) {
            body = [{
                id: threadId,
                coach_id: '33333333-3333-4333-8333-333333333333',
                linked_user_id: null,
                subscriber_id: 'ig_graph:178900000000001',
                ig_username: 'preview_lead',
                profile_name: 'Preview Lead',
                lead_stage: 'qualifying',
                last_inbound_at: new Date(now - 20 * 60 * 1000).toISOString(),
                last_outbound_at: new Date(now - 15 * 60 * 1000).toISOString(),
                custom_data: {
                    bot_account: 'shan_n_sunny',
                    instagram_graph: { ig_graph_user_id: '178900000000001', ig_account_id: '178400000000002' },
                },
            }];
        } else if (String(url).includes('/ig_messages?')) {
            body = [{
                id: '44444444-4444-4444-8444-444444444444',
                direction: 'out',
                text: `Here you go: ${previewUrl}`,
                created_at: new Date(now - 15 * 60 * 1000).toISOString(),
                alert_id: '55555555-5555-4555-8555-555555555555',
            }];
        } else if (String(url).includes('/lp_events?select=')) {
            body = [];
        } else if (String(url).includes('/coach_alerts?')) {
            body = [{ id: '66666666-6666-4666-8666-666666666666' }];
        }
        return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    };

    try {
        delete require.cache[require.resolve(loggerModulePath)];
        const logger = require(loggerModulePath);
        const response = await logger.handler({
            httpMethod: 'POST',
            body: JSON.stringify({
                event_id: 'event-preview-gate-1',
                event_type: 'trial_gate_shown',
                session_id: 'session-preview-1',
                visitor_id: 'visitor-preview-1',
                landing_page: 'meta-app-preview',
                page_variant: 'facebook_5m_foundations_v3',
                page_url: previewUrl,
                metadata: { meta_ref: token, experiment: 'facebook_5m_foundations_v3' },
            }),
        });
        assert.equal(response.statusCode, 200);

        const alertRequest = requests.find(request => request.url.includes('/coach_alerts?'));
        assert.ok(alertRequest, 'the signed gate event schedules a coach alert');
        assert.match(alertRequest.url, /on_conflict=id(?:&|$)/,
            'the scheduler must use the live primary-key constraint for atomic idempotency');
        const [alert] = JSON.parse(alertRequest.options.body);
        assert.match(alert.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        assert.equal(alert.alert_type, 'follow_up_review');
        assert.equal(alert.status, 'scheduled');
        assert.equal(alert.suggested_message, 'How did you find the Balance preview?');
        assert.equal((alert.suggested_message.match(/\?/g) || []).length, 1);
        assert.equal(alert.data.meta_app_preview_followup, true);
        assert.equal(alert.data.meta_app_preview_followup_kind, 'gate');
        assert.equal(alert.data.meta_app_preview_canonical_outbound_id, '44444444-4444-4444-8444-444444444444');
        const progressRequest = requests.find(request => request.url.includes('/growth_outcome_events?'));
        assert.ok(progressRequest, 'the signed preview stage is added to the identity-linked outcome trail');
        const [progress] = JSON.parse(progressRequest.options.body);
        assert.equal(progress.ig_thread_id, threadId);
        assert.equal(progress.event_type, 'meta_app_preview_trial_gate_shown');
        assert.equal(requests.some(request => request.url.includes('/ig_messages') && request.options.method === 'POST'), false,
            'the event handler never inserts a synthetic outbound message');
    } finally {
        global.fetch = originalFetch;
        delete require.cache[require.resolve(loggerModulePath)];
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
});

test('opening Stripe schedules a separate buyer-safe abandonment check', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'preview-test-secret';
    const originalFetch = global.fetch;
    const requests = [];
    const now = Date.now();
    const threadId = '77777777-7777-4777-8777-777777777777';
    const refs = require(refModulePath);
    const previewUrl = refs.buildMetaAppPreviewUrl(threadId, { nowMs: now });
    const token = new URL(previewUrl).pathname.split('/').filter(Boolean).at(-1);

    global.fetch = async (url, options = {}) => {
        requests.push({ url: String(url), options });
        let body = [];
        if (String(url).includes('/ig_threads?')) {
            body = [{
                id: threadId,
                coach_id: '33333333-3333-4333-8333-333333333333',
                linked_user_id: null,
                subscriber_id: 'ig_graph:178900000000007',
                ig_username: 'stripe_preview_lead',
                profile_name: 'Stripe Preview Lead',
                lead_stage: 'qualifying',
                last_inbound_at: new Date(now - 30 * 60 * 1000).toISOString(),
                custom_data: {
                    bot_account: 'shan_n_sunny',
                    instagram_graph: { ig_graph_user_id: '178900000000007', ig_account_id: '178400000000002' },
                },
            }];
        } else if (String(url).includes('/ig_messages?')) {
            body = [{
                id: '88888888-8888-4888-8888-888888888888',
                direction: 'out',
                text: `Here you go: ${previewUrl}`,
                created_at: new Date(now - 25 * 60 * 1000).toISOString(),
            }];
        } else if (String(url).includes('/coach_alerts?')) {
            body = [{ id: '99999999-9999-4999-8999-999999999999' }];
        }
        return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    };

    try {
        delete require.cache[require.resolve(loggerModulePath)];
        const logger = require(loggerModulePath);
        const result = await logger.enqueueMetaAppPreviewFollowup({
            event_id: 'event-checkout-opened-1',
            event_type: 'checkout_started',
            session_id: 'session-checkout-opened-1',
            visitor_id: 'visitor-checkout-opened-1',
            created_at: new Date(now).toISOString(),
            metadata: { meta_ref: token, stripe_session_id: 'cs_test_preview_1' },
        }, now);
        assert.equal(result.queued, true);
        const alertRequest = requests.find(request => request.url.includes('/coach_alerts?'));
        const [alert] = JSON.parse(alertRequest.options.body);
        assert.equal(alert.data.meta_app_preview_followup_kind, 'checkout_abandoned');
        assert.equal(alert.data.meta_app_preview_checkout_session_id, 'cs_test_preview_1');
        assert.equal(alert.suggested_message, "Just checking the payment page opened properly for you. If it got stuck, send me a screenshot and I'll sort it.");
        assert.equal(Date.parse(alert.scheduled_for) - now, logger.CHECKOUT_FOLLOWUP_DELAY_MS);
    } finally {
        global.fetch = originalFetch;
        delete require.cache[require.resolve(loggerModulePath)];
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
});

test('the scheduled worker rechecks preview checkout evidence before Graph delivery', () => {
    const worker = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/scheduled-coach-reply-worker.js'), 'utf8');
    assert.match(worker, /getMetaPreviewConversionAfterGate/);
    assert.match(worker, /checkout_started,trial_purchase_claimed,trial_subscription_claimed/);
    assert.match(worker, /meta_app_preview_checkout_or_purchase_started/);
    assert.match(worker, /founders_pass_purchases/);
    assert.match(worker, /meta_app_preview_purchase_completed/);
    assert.ok(worker.indexOf('const conversion = await getMetaPreviewConversionAfterGate(alert)') < worker.indexOf('const newerMessage = await cancelIfNewerInstagramConversationMessage(alert)', worker.indexOf('const conversion = await getMetaPreviewConversionAfterGate(alert)')),
        'conversion evidence is checked before the final conversation-delta send guard');
});

test('Stripe purchase completion records the linked buyer and queues a welcome', () => {
    const webhook = fs.readFileSync(path.join(__dirname, '..', 'netlify/edge-functions/stripe-webhook.js'), 'utf8');
    assert.match(webhook, /verifyMetaPreviewRef/);
    assert.match(webhook, /meta_app_preview_purchase_completed/);
    assert.match(webhook, /meta_app_preview_purchase_followup:/);
    assert.match(webhook, /Your Balance Foundations pass is sorted/);
    assert.match(webhook, /cancel_reason: "meta_app_preview_purchase_completed"/);
});

test('the admin conversion board exposes each preview and payment stage', () => {
    const snapshot = fs.readFileSync(path.join(__dirname, '..', 'netlify/functions/conversion-operator-snapshot.js'), 'utf8');
    const admin = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
    assert.match(snapshot, /preview_progress as/);
    assert.match(snapshot, /meta_app_preview_checkout_started/);
    assert.match(snapshot, /meta_app_preview_purchase_completed/);
    assert.match(snapshot, /'app_preview'/);
    assert.match(snapshot, /'payment_opened'/);
    assert.match(snapshot, /'payment_follow_up'/);
    assert.match(admin, /In app preview/);
    assert.match(admin, /At payment/);
    assert.match(admin, /Payment follow-up/);
});
