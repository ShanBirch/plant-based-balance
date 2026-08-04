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
    const token = parsedUrl.searchParams.get('meta_ref');

    assert.equal(parsedUrl.origin + parsedUrl.pathname, refs.META_APP_PREVIEW_URL);
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
    const token = new URL(previewUrl).searchParams.get('meta_ref');

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
        const [alert] = JSON.parse(alertRequest.options.body);
        assert.equal(alert.alert_type, 'follow_up_review');
        assert.equal(alert.status, 'scheduled');
        assert.equal(alert.suggested_message, "Hey, how'd you find the app?");
        assert.equal((alert.suggested_message.match(/\?/g) || []).length, 1);
        assert.equal(alert.data.meta_app_preview_followup, true);
        assert.equal(alert.data.meta_app_preview_canonical_outbound_id, '44444444-4444-4444-8444-444444444444');
        assert.equal(requests.some(request => request.url.includes('/ig_messages') && request.options.method === 'POST'), false,
            'the event handler never inserts a synthetic outbound message');
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
    assert.ok(worker.indexOf('const conversion = await getMetaPreviewConversionAfterGate(alert)') < worker.indexOf('const newerMessage = await getNewerInstagramConversationMessage(alert)'),
        'conversion evidence is checked before the final conversation-delta send guard');
});
