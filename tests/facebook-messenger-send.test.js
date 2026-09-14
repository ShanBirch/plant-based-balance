const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
process.env.FACEBOOK_PAGE_ID = '123';
process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'test-only';
const { handler } = require('../netlify/functions/send-ig-reply');

test('the production sender delivers and records a Messenger reply without ManyChat', async () => {
    const originalFetch = global.fetch;
    const at = new Date().toISOString();
    let alert = { id: 'alert', status: 'pending', created_at: at, client_id: null, coach_id: 'coach', alert_type: 'fb_incoming_dm',
        data: { channel: 'messenger', ig_thread_id: 'thread', subscriber_id: 'fb_graph:123:456', draft_text: 'Thanks for explaining that.', draft_messages: ['Thanks for explaining that.'] } };
    const thread = { id: 'thread', channel: 'messenger', subscriber_id: 'fb_graph:123:456', last_inbound_at: at,
        custom_data: { facebook_messenger: { page_id: '123', psid: '456' } } };
    const calls = [];
    const messages = [];
    global.fetch = async (url, options = {}) => {
        calls.push(String(url));
        const body = options.body ? JSON.parse(options.body) : null;
        let result = [];
        if (String(url).startsWith('https://graph.facebook.com/')) result = { recipient_id: '456', message_id: 'out1' };
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
        assert.equal(result.statusCode, 200, result.body);
        assert.equal(calls.filter(url => url.startsWith('https://graph.facebook.com/')).length, 1);
        assert.equal(calls.some(url => /manychat\.com|graph\.instagram\.com/.test(new URL(url).hostname)), false);
        assert.equal(messages.length, 1);
        assert.equal(messages[0].manychat_message_id, 'fb_graph:123:out1');
        assert.equal(messages[0].source, 'facebook_messenger_send');
        assert.equal(alert.status, 'sent');
        assert.equal(alert.data.delivery_transport, 'facebook_messenger');
        assert.deepEqual(alert.data.sent_graph_message_ids, ['out1']);
        const duplicate = await handler({ httpMethod: 'POST', body: JSON.stringify({ alertId: 'alert', replyText: 'Thanks for explaining that.', source: 'admin_dashboard' }) });
        assert.equal(duplicate.statusCode, 409);
        assert.equal(calls.filter(url => url.startsWith('https://graph.facebook.com/')).length, 1);
    } finally { global.fetch = originalFetch; }
});
