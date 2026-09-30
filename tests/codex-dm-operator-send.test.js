const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
const { COACH_ID } = require('../netlify/functions/_lib/codex-dm-operator');
const senders = ['send-coach-reply', 'send-ig-reply', 'send-whatsapp-reply'];
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
            const result = String(url).includes('coach_alerts') ? [alert] : [];
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
