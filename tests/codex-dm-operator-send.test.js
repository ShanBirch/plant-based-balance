const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
const { COACH_ID } = require('../netlify/functions/_lib/codex-dm-operator');
const senders = ['send-coach-reply', 'send-ig-reply', 'send-whatsapp-reply'];
function projectedAlert(url, alert) {
    const select = new URL(url).searchParams.get('select');
    assert.ok(select, 'The alert fixture must honor an explicit database projection');
    return select === '*' ? { ...alert } : Object.fromEntries(select.split(',')
        .filter(field => Object.hasOwn(alert, field)).map(field => [field, alert[field]]));
}
for (const name of senders) {
    test(name + ' rejects the legacy automatic sender before any write or transport', async () => {
        const previous = global.fetch;
        const calls = [];
        const alert = { id: 'alert', coach_id: COACH_ID, status: 'pending', alert_type: 'ig_incoming_dm',
            data: { channel: name === 'send-whatsapp-reply' ? 'whatsapp' : 'instagram',
                delivery_channel: name === 'send-whatsapp-reply' ? 'whatsapp_cloud' : undefined,
                ig_thread_id: 'f6872123-6e46-452c-85ec-9a15e2d6746' } };
        global.fetch = async (url, options = {}) => {
            calls.push({ url: String(url), method: options.method || 'GET' });
            assert.ok(String(url).startsWith('https://database.test/'), 'No external delivery is allowed');
            assert.equal(options.method || 'GET', 'GET', 'No database mutation is allowed');
            const result = String(url).includes('coach_alerts') ? [projectedAlert(url, alert)] : [];
            return { ok: true, status: 200, text: async () => JSON.stringify(result), json: async () => result };
        };
        try {
            const { handler } = require('../netlify/functions/' + name);
            const result = await handler({ httpMethod: 'POST', body: JSON.stringify({
                alertId: 'alert', replyText: 'Old automatic reply', source: 'auto_send', forceText: true,
            }) });
            assert.equal(result.statusCode, 409, result.body);
            assert.match(result.body, /operator/);
            assert.ok(calls.length > 0);
        } finally { global.fetch = previous; }
    });
}

test('WhatsApp projected ownership blocks automation while human sources still reach the window guard', async () => {
    const previous = global.fetch;
    const calls = [];
    const alert = { id: 'alert', coach_id: COACH_ID, status: 'pending', alert_type: 'fb_incoming_dm',
        data: { delivery_channel: 'whatsapp_cloud', whatsapp_customer_service_window_ends_at: '2020-01-01T00:00:00Z' } };
    global.fetch = async (url, options = {}) => {
        assert.ok(String(url).startsWith('https://database.test/'), 'No external delivery is allowed');
        assert.equal(options.method || 'GET', 'GET', 'No database mutation is allowed');
        const projected = projectedAlert(String(url), alert);
        calls.push(projected);
        return { ok: true, status: 200, text: async () => JSON.stringify([projected]) };
    };
    try {
        const { handler } = require('../netlify/functions/send-whatsapp-reply');
        for (const source of ['auto_send', 'scheduled_worker', 'balance_lead_client_manager_cron', 'unknown']) {
            const result = await handler({httpMethod:'POST',body:JSON.stringify({alertId:'alert',replyText:'Synthetic fixture',source})});
            assert.equal(result.statusCode,409);
            assert.equal(JSON.parse(result.body).code,'codex_conversation_operator_owns_reply');
        }
        for (const source of ['admin_dashboard', 'admin_dashboard_schedule', 'android_inline_reply_worker', 'manual_instagram', undefined]) {
            const result = await handler({httpMethod:'POST',body:JSON.stringify({alertId:'alert',replyText:'Synthetic fixture',source})});
            assert.equal(result.statusCode,409);
            assert.equal(JSON.parse(result.body).code,'whatsapp_customer_window_expired');
        }
        assert.ok(calls.every(row => row.coach_id === COACH_ID), 'The handler must load ownership from the real projected row');
    } finally { global.fetch = previous; }
});
