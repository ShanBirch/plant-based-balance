const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.FACEBOOK_PAGE_ID = '123';
process.env.MANYCHAT_API_TOKEN = 'test-only';
process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'test-only';
const { handler } = require('../netlify/functions/send-ig-reply');

for (const scenario of ['valid', 'expired', 'malformed-graph', 'wrong-channel']) test('ManyChat WhatsApp route: ' + scenario, async () => {
    const originalFetch = global.fetch;
    const at = new Date().toISOString();
    let alert = { id: 'alert', status: 'pending', created_at: at, client_id: null, coach_id: 'coach', alert_type: 'fb_incoming_dm',
        data: { channel: 'whatsapp', ig_thread_id: 'thread', subscriber_id: '456', draft_text: 'Thanks for explaining that.', draft_messages: ['Thanks for explaining that.'] } };
    const thread = { id: 'thread', channel: 'whatsapp', subscriber_id: '456', last_inbound_at: at,
        custom_data: {manychat_business:{workspace:'fb996573',page_id:'561122130919678'}} };
    if (scenario === 'expired') thread.last_inbound_at = new Date(Date.now() - 25 * 3600000).toISOString();
    if (scenario === 'malformed-graph') thread.subscriber_id = alert.data.subscriber_id = 'fb_graph:123:bad';
    if (scenario === 'wrong-channel') thread.channel = 'instagram';
    const calls = [];
    const messages = [];
    global.fetch = async (url, options = {}) => {
        calls.push(String(url));
        const body = options.body ? JSON.parse(options.body) : null;
        let result = [];
        if (String(url).startsWith('https://api.manychat.com/')) { assert.equal(body.subscriber_id, '456'); assert.equal(body.data.content.type, 'whatsapp'); result = { status: 'success' }; }
        else if (String(url).includes('/rest/v1/ig_threads')) result = [thread];
        else if (String(url).includes('/rest/v1/coach_alerts')) {
            if (options.method === 'PATCH') { alert = { ...alert, ...body }; result = [alert]; }
            else if (String(url).includes('id=eq.alert')) result = [alert];
        } else if (String(url).includes('/rest/v1/ig_messages')) {
            if (options.method === 'POST') {
                const message = { id: 'outbound-row', created_at: at, ...(Array.isArray(body) ? body[0] : body) };
                messages.push(message); result = [message];
            }
        } else if (!String(url).startsWith('https://database.test/')) {
            throw new Error('Unexpected external request: ' + url);
        }
        return { ok: true, status: 200, text: async () => JSON.stringify(result), json: async () => result };
    };
    try {
        const result = await handler({ httpMethod: 'POST', body: JSON.stringify({ alertId: 'alert', replyText: 'Thanks for explaining that.', draftText: 'Thanks for explaining that.', source: 'admin_dashboard', forceText: true }) });
        if (scenario !== 'valid') {
            assert.equal(result.statusCode, 409, result.body);
            assert.equal(calls.filter(url => url.startsWith('https://api.manychat.com/')).length, 0);
            return;
        }
        assert.equal(result.statusCode, 200, result.body);
        assert.equal(calls.filter(url => url.startsWith('https://api.manychat.com/')).length, 1);
        assert.equal(calls.some(url => /graph\.facebook\.com|graph\.instagram\.com/.test(new URL(url).hostname)), false);
        assert.equal(messages.length, 1);
        assert.equal(messages[0].manychat_message_id, null);
        assert.equal(messages[0].source, 'admin_dashboard');
        assert.equal(alert.status, 'sent');
        assert.equal(alert.data.delivery_transport, 'manychat');
        
        const duplicate = await handler({ httpMethod: 'POST', body: JSON.stringify({ alertId: 'alert', replyText: 'Thanks for explaining that.', source: 'admin_dashboard' }) });
        assert.equal(duplicate.statusCode, 409);
        assert.equal(calls.filter(url => url.startsWith('https://api.manychat.com/')).length, 1);
    } finally { global.fetch = originalFetch; }
});


