const GRAPH_BASE = 'https://graph.instagram.com';
const API_VERSION = process.env.META_IG_API_VERSION || 'v25.0';
const TEST_KEY = '270d3ff91d2e4b0a8b1f4d507a35473c';
const EXPECTED_SENDER = 'goldcoast_ai_solutions';
const EXPECTED_RECIPIENT = 'shan_n_sunny';
const EXPECTED_RECIPIENT_ID = '2420613208444110';
const EXPECTED_SENDER_ID = '17841422424052111';
const TEST_THREAD_ID = '4baea56e-eab4-4887-a732-39b14e983d44';
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

async function supabaseQuery(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Supabase ${response.status}`);
    return payload;
}

async function readTestState(since = '') {
    const cleanSince = String(since || '').trim();
    const timeFilter = cleanSince ? `&created_at=gte.${encodeURIComponent(cleanSince)}` : '';
    const [threadRows, messages, alerts] = await Promise.all([
        supabaseQuery(`ig_threads?select=*&id=eq.${TEST_THREAD_ID}&limit=1`),
        supabaseQuery(`ig_messages?select=*&thread_id=eq.${TEST_THREAD_ID}${timeFilter}&order=created_at.asc,id.asc&limit=100`),
        supabaseQuery(`coach_alerts?select=*&data->>ig_thread_id=eq.${TEST_THREAD_ID}${timeFilter}&order=created_at.asc,id.asc&limit=100`),
    ]);
    return { thread: threadRows[0] || null, messages, alerts };
}

async function configureTestThread() {
    const state = await readTestState();
    if (!state.thread) throw new Error('Canonical GC test thread is missing');
    const original = {
        auto_send_enabled: state.thread.auto_send_enabled,
        lead_stage: state.thread.lead_stage,
        goals: state.thread.goals,
        communication_style: state.thread.communication_style,
        running_notes: state.thread.running_notes,
        injuries_limits: state.thread.injuries_limits,
        personal_context: state.thread.personal_context,
        coach_instructions: state.thread.coach_instructions,
        qualifier: state.thread.qualifier,
        custom_data: state.thread.custom_data,
    };
    const customData = state.thread.custom_data && typeof state.thread.custom_data === 'object'
        ? state.thread.custom_data
        : {};
    const graph = customData.instagram_graph && typeof customData.instagram_graph === 'object'
        ? customData.instagram_graph
        : {};
    const resetAt = new Date().toISOString();
    const updated = await supabaseQuery(`ig_threads?id=eq.${TEST_THREAD_ID}`, {
        method: 'PATCH',
        body: {
            auto_send_enabled: true,
            custom_data: {
                ...customData,
                bot_account: 'shan_n_sunny',
                instagram_graph: { ...graph, bot_account: 'shan_n_sunny' },
                internal_test_auto_reply_enabled: true,
                internal_test_meta_ad_flow: 'plant_based_control',
                internal_test_conversation_reset_at: resetAt,
                operator_queue: null,
                needs_you_required: false,
                needs_shannon_approval: false,
                client_manager_review_required: false,
            },
        },
    });
    return { original, reset_at: resetAt, thread: updated[0] || null };
}

async function restoreTestThread(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new Error('Original thread snapshot is required');
    const allowed = [
        'auto_send_enabled', 'lead_stage', 'goals', 'communication_style', 'running_notes',
        'injuries_limits', 'personal_context', 'coach_instructions', 'qualifier', 'custom_data',
    ];
    const body = Object.fromEntries(allowed.filter(key => Object.hasOwn(snapshot, key)).map(key => [key, snapshot[key]]));
    const updated = await supabaseQuery(`ig_threads?id=eq.${TEST_THREAD_ID}`, {
        method: 'PATCH',
        body,
    });
    return updated[0] || null;
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
        if (request.action === 'inspect') return json(200, await readTestState(request.since));
        if (request.action === 'configure') return json(200, await configureTestThread());
        if (request.action === 'restore') return json(200, { thread: await restoreTestThread(request.snapshot) });
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
