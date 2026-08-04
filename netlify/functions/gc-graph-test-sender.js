const GRAPH_BASE = 'https://graph.instagram.com';
const API_VERSION = process.env.META_IG_API_VERSION || 'v25.0';
const TEST_KEY = '270d3ff91d2e4b0a8b1f4d507a35473c';
const EXPECTED_SENDER = 'goldcoast_ai_solutions';
const EXPECTED_RECIPIENT = 'shan_n_sunny';
const EXPECTED_RECIPIENT_ID = '2420613208444110';
const EXPECTED_SENDER_ID = '17841422424052111';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const { resolveMetaIgAccessToken } = require('./_lib/meta-ig-accounts');

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(body),
    };
}

async function graphRequest(path, token, { method = 'GET', params = {}, body } = {}) {
    const url = new URL(`${GRAPH_BASE}/${API_VERSION}/${path}`);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `Instagram Graph ${response.status}`);
    return payload;
}

function rows(edge) {
    return Array.isArray(edge?.data) ? edge.data : Array.isArray(edge) ? edge : [];
}

async function supabaseQuery(path) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Supabase ${response.status}`);
    return payload;
}

async function resolveCanonicalConversation(accountId, token) {
    let after = '';
    for (let page = 0; page < 10; page += 1) {
        const payload = await graphRequest(`${accountId}/conversations`, token, {
            params: {
                platform: 'instagram',
                fields: 'id,updated_time,participants,messages.limit(12){id,created_time,from,to,message,attachments}',
                limit: 50,
                after,
            },
        });
        for (const conversation of rows(payload)) {
            const participant = rows(conversation.participants).find(item =>
                String(item?.username || '').toLowerCase() === EXPECTED_RECIPIENT
                && String(item?.id || '') === EXPECTED_RECIPIENT_ID
            );
            if (participant) return { conversation, recipient: participant };
        }
        after = payload?.paging?.cursors?.after || '';
        if (!after) break;
    }
    throw new Error('Canonical shan_n_sunny conversation was not found from GC AI Solutions');
}

exports.handler = async (event) => {
    if (event.headers?.['x-gc-test-key'] !== TEST_KEY) return json(403, { error: 'forbidden' });
    const { token } = await resolveMetaIgAccessToken(EXPECTED_SENDER_ID, supabaseQuery);
    if (!token) return json(500, { error: 'GC AI Solutions token unavailable' });
    try {
        const me = await graphRequest('me', token, { params: { fields: 'id,username,name' } });
        if (String(me?.username || '').toLowerCase() !== EXPECTED_SENDER) {
            return json(409, { error: 'Unexpected sender identity', sender: me?.username || null });
        }
        const { conversation, recipient } = await resolveCanonicalConversation(me.id, token);
        if (event.httpMethod === 'GET') {
            return json(200, {
                sender: { id: me.id, username: me.username },
                recipient: { id: recipient.id, username: recipient.username },
                conversation_id: conversation.id,
                updated_time: conversation.updated_time,
                messages: rows(conversation.messages).map(message => ({
                    id: message.id,
                    created_time: message.created_time,
                    from: message.from,
                    to: message.to,
                    message: message.message,
                    attachments: message.attachments,
                })),
            });
        }
        if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' });
        const request = JSON.parse(event.body || '{}');
        const message = String(request.message || '').replace(/\s+/g, ' ').trim();
        if (!message || message.length > 500) return json(400, { error: 'message_required' });
        const delivery = await graphRequest(`${me.id}/messages`, token, {
            method: 'POST',
            body: { recipient: { id: EXPECTED_RECIPIENT_ID }, message: { text: message } },
        });
        return json(200, {
            sender: { id: me.id, username: me.username },
            recipient: { id: recipient.id, username: recipient.username },
            conversation_id: conversation.id,
            message,
            requested_at: new Date().toISOString(),
            graph_delivery: delivery,
        });
    } catch (error) {
        return json(500, { error: error.message });
    }
};
