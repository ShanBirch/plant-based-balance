const GRAPH_BASE = 'https://graph.instagram.com';
const API_VERSION = process.env.META_IG_API_VERSION || 'v25.0';
const TEST_KEY = '0a3bab772c6c4503b37fb4146ac6d232';
const EXPECTED_SENDER = 'cocos_pt_studio';
const EXPECTED_RECIPIENT = 'shan_n_sunny';

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
            );
            if (participant?.id) return { conversation, recipient: participant };
        }
        after = payload?.paging?.cursors?.after || '';
        if (!after) break;
    }
    throw new Error('Canonical shan_n_sunny conversation was not found from Coco');
}

exports.handler = async (event) => {
    if (event.headers?.['x-coco-test-key'] !== TEST_KEY) return json(403, { error: 'forbidden' });
    const token = String(process.env.META_IG_COCOS_ACCESS_TOKEN || '').trim();
    if (!token) return json(500, { error: 'Coco token unavailable' });
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
        const sentAt = new Date().toISOString();
        const delivery = await graphRequest(`${me.id}/messages`, token, {
            method: 'POST',
            body: { recipient: { id: recipient.id }, message: { text: message } },
        });
        return json(200, {
            sender: { id: me.id, username: me.username },
            recipient: { id: recipient.id, username: recipient.username },
            conversation_id: conversation.id,
            message,
            requested_at: sentAt,
            graph_delivery: delivery,
        });
    } catch (error) {
        return json(500, { error: error.message });
    }
};
