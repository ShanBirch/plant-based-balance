/**
 * send-direct-ig-message
 *
 * Dashboard composer route for Shannon-initiated Instagram/Messenger messages.
 * Sends through ManyChat, writes every delivered bubble into ig_messages, updates
 * ig_threads.last_outbound_at, and clears any pending DM cards for the thread.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    fireCoachEditAnalysis,
} = require('./_lib/client-context');

const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN;
const MANYCHAT_SEND_URL = process.env.MANYCHAT_SEND_URL || 'https://api.manychat.com/fb/sending/sendContent';
const MANYCHAT_MESSAGE_TAG = process.env.MANYCHAT_MESSAGE_TAG || '';
const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];
const CHUNK_GAP_MIN_MS = 2600;
const CHUNK_GAP_JITTER_MS = 1400;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pickChunkGap() {
    return CHUNK_GAP_MIN_MS + Math.floor(Math.random() * CHUNK_GAP_JITTER_MS);
}

async function verifyAdminToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, error: 'missing_admin_token' };
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, error: 'supabase_not_configured' };

    try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!userRes.ok) return { ok: false, error: 'invalid_admin_token' };
        const user = await userRes.json();
        if (!user?.id) return { ok: false, error: 'invalid_admin_user' };

        const rows = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
        if (!rows.length) return { ok: false, error: 'not_admin' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'admin_check_failed' };
    }
}

async function postToManyChat({ subscriberId, text, channel }) {
    if (!MANYCHAT_API_TOKEN) throw new Error('MANYCHAT_API_TOKEN not configured');

    const content = {
        messages: [{ type: 'text', text }],
    };
    if (channel === 'instagram') content.type = 'instagram';

    const body = {
        subscriber_id: subscriberId,
        data: {
            version: 'v2',
            content,
        },
    };
    if (MANYCHAT_MESSAGE_TAG) body.message_tag = MANYCHAT_MESSAGE_TAG;

    const res = await fetch(MANYCHAT_SEND_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
        throw new Error(`ManyChat ${res.status}: ${responseText.slice(0, 400)}`);
    }
    try {
        return responseText ? JSON.parse(responseText) : {};
    } catch {
        return { raw: responseText };
    }
}

async function loadPendingThreadAlerts(threadId) {
    if (!threadId) return [];
    try {
        return await supabaseQuery(
            `coach_alerts?select=id,alert_type,status,suggested_message,data,created_at&data->>ig_thread_id=eq.${encodeURIComponent(threadId)}&status=eq.pending&alert_type=in.(${MANYCHAT_DM_ALERT_TYPES.join(',')})&order=created_at.desc&limit=25`
        );
    } catch (err) {
        console.warn('[send-direct-ig-message] pending alert lookup failed:', err.message || err);
        return [];
    }
}

async function clearPendingThreadAlerts({ pendingAlerts, primaryAlert, message, chunks, sentAt, source }) {
    let primaryAlertId = null;
    let siblingAlertsCleared = 0;
    if (!Array.isArray(pendingAlerts) || pendingAlerts.length === 0) {
        return { primaryAlertId, siblingAlertsCleared };
    }

    const primary = primaryAlert || pendingAlerts[0];
    const siblings = pendingAlerts.filter(a => a.id !== primary.id);
    const draftText = normalizeCoachDraftText(primary.data?.draft_text || primary.suggested_message || '').trim();
    const wasEdited = !!draftText && message !== draftText;
    const primaryData = {
        ...(primary.data || {}),
        sent_message: message,
        sent_at: sentAt,
        sent_via: source,
        was_edited: wasEdited,
        chunks_sent: chunks.length,
        chunks_total: chunks.length,
        sent_chunks: chunks,
        sent_split_strategy: chunks.length > 1 ? 'direct_paragraph_safe_v1' : 'single',
        cleared_by_direct_composer: true,
    };
    if (!draftText) primaryData.manual_reply_without_draft = true;

    try {
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(primary.id)}`, {
            method: 'PATCH',
            body: { status: 'sent', actioned_at: sentAt, data: primaryData },
            prefer: 'return=minimal',
        });
        primaryAlertId = primary.id;
        await fireCoachEditAnalysis({
            alertId: primary.id,
            draftText,
            sentMessage: message,
            source,
        });
    } catch (err) {
        console.warn('[send-direct-ig-message] primary alert update failed:', err.message || err);
    }

    for (const sibling of siblings) {
        const siblingData = {
            ...(sibling.data || {}),
            cancel_reason: 'cleared_by_direct_outbound_reply',
            cleared_by_outbound_reply_at: sentAt,
            cleared_by_outbound_reply_source: source,
            cleared_by_primary_alert_id: primaryAlertId,
        };
        try {
            await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: { status: 'canceled', actioned_at: sentAt, data: siblingData },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        } catch (err) {
            console.warn('[send-direct-ig-message] sibling alert cleanup failed:', err.message || err);
        }
    }

    return { primaryAlertId, siblingAlertsCleared };
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });
    if (!MANYCHAT_API_TOKEN) return json(500, { error: 'MANYCHAT_API_TOKEN not configured' });

    const admin = await verifyAdminToken(event);
    if (!admin.ok) return json(403, { error: admin.error });

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const threadId = String(body.threadId || body.igThreadId || '').trim();
    const message = normalizeCoachDraftText(body.message || body.replyText || '').trim();
    if (!threadId) return json(400, { error: 'Missing threadId' });
    if (!message) return json(400, { error: 'Missing message' });
    if (message.length > 8000) return json(400, { error: 'Message too long (max 8000 chars)' });

    let thread;
    try {
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,lead_stage,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
        );
        thread = rows[0] || null;
    } catch (err) {
        console.error('[send-direct-ig-message] thread lookup failed:', err);
        return json(500, { error: 'Thread lookup failed' });
    }
    if (!thread) return json(404, { error: 'IG thread not found' });
    if (!thread.subscriber_id) return json(400, { error: 'Thread is missing subscriber_id' });
    if (/^meta_ig:/i.test(thread.subscriber_id)) {
        return json(409, {
            error: 'This IG thread is Graph-only, not a ManyChat subscriber. Send it in Instagram, then log it from the DM card if needed.',
        });
    }

    const channel = thread.channel === 'messenger' ? 'messenger' : 'instagram';
    const source = channel === 'messenger' ? 'admin_dashboard_direct_messenger' : 'admin_dashboard_direct_instagram';
    const pendingAlerts = await loadPendingThreadAlerts(thread.id);
    const primaryAlert = pendingAlerts[0] || null;
    const chunks = splitCoachDraftIntoDmBubbles([message]);
    if (!chunks.length) return json(400, { error: 'Message is empty' });

    const sentResults = [];
    let firstError = null;
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await sleep(pickChunkGap());
        try {
            const response = await postToManyChat({ subscriberId: thread.subscriber_id, text: chunks[i], channel });
            sentResults.push({ ok: true, text: chunks[i], response });
        } catch (err) {
            firstError = err.message || String(err);
            sentResults.push({ ok: false, text: chunks[i], error: firstError });
            break;
        }
    }

    const sentChunks = sentResults.filter(r => r.ok);
    const sentAt = new Date().toISOString();
    const messageIds = [];

    for (const result of sentChunks) {
        try {
            const rows = await supabaseQuery('ig_messages', {
                method: 'POST',
                body: [{
                    thread_id: thread.id,
                    direction: 'out',
                    text: result.text,
                    source,
                    alert_id: primaryAlert?.id || null,
                }],
            });
            if (rows[0]?.id) messageIds.push(rows[0].id);
        } catch (err) {
            console.warn('[send-direct-ig-message] history insert failed:', err.message || err);
        }
    }

    if (sentChunks.length > 0) {
        try {
            await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
                method: 'PATCH',
                body: { last_outbound_at: sentAt },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-direct-ig-message] thread timestamp update failed:', err.message || err);
        }
    }

    if (firstError) {
        return json(502, {
            error: 'ManyChat send failed',
            details: firstError,
            chunks_sent: sentChunks.length,
            chunks_total: chunks.length,
            history_logged: messageIds.length > 0,
        });
    }

    const cleanup = await clearPendingThreadAlerts({
        pendingAlerts,
        primaryAlert,
        message,
        chunks,
        sentAt,
        source,
    });

    return json(200, {
        ok: true,
        thread_id: thread.id,
        channel,
        chunks_sent: sentChunks.length,
        chunks_total: chunks.length,
        sent_chunks: sentChunks.map(r => r.text),
        message_ids: messageIds,
        history_logged: messageIds.length === sentChunks.length,
        ...cleanup,
    });
};
