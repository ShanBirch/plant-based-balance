/**
 * mark-manual-dm-sent
 *
 * Used when Shannon sends an Instagram/Facebook DM manually from the DMs tab.
 * It records the outbound in ig_messages, updates the linked thread timestamp,
 * clears sibling pending DM alerts for the same thread, then marks the primary
 * coach_alert as sent.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    normalizeCoachDraftText,
    fireCoachEditAnalysis,
} = require('./_lib/client-context');
const { sendInstagramSeenReceiptForThread } = require('./_lib/instagram-graph-seen');

const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
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
        const email = String(user.email || '').trim().toLowerCase();
        if (email !== BALANCE_ADMIN_EMAIL) return { ok: false, error: 'not_admin' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'admin_check_failed' };
    }
}

function cleanText(value) {
    return normalizeCoachDraftText(value || '').trim();
}

function isManyChatDmAlert(alert) {
    const data = alert?.data || {};
    return MANYCHAT_DM_ALERT_TYPES.includes(alert?.alert_type)
        || data.channel === 'instagram'
        || data.channel === 'messenger';
}

function normalizeTimingSuggestion(value) {
    if (!value || typeof value !== 'object') return null;
    const delay = Number(value.delay_ms);
    return {
        action: value.action === 'send_now' ? 'send_now' : 'schedule',
        delay_ms: Number.isFinite(delay) && delay >= 0 ? delay : null,
        label: String(value.label || '').slice(0, 40),
        reason: String(value.reason || '').slice(0, 240),
        confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : null,
        signals: value.signals && typeof value.signals === 'object' ? value.signals : {},
    };
}

async function ensureManualHistory({ alertId, threadId, message, source }) {
    if (!threadId) {
        throw new Error('missing_ig_thread_id');
    }

    const existingRows = await supabaseQuery(
        `ig_messages?select=id,created_at&alert_id=eq.${encodeURIComponent(alertId)}&direction=eq.out&limit=1`
    );
    let messageId = existingRows[0]?.id || null;

    if (!messageId) {
        const inserted = await supabaseQuery('ig_messages', {
            method: 'POST',
            body: [{
                thread_id: threadId,
                direction: 'out',
                text: message,
                source,
                alert_id: alertId,
            }],
        });
        messageId = inserted[0]?.id || null;
    }

    await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(threadId)}`, {
        method: 'PATCH',
        body: { last_outbound_at: new Date().toISOString() },
        prefer: 'return=minimal',
    });

    return { historyLogged: true, messageId };
}

async function clearSiblingManyChatAlerts({ alertId, threadId, sentAt, source }) {
    if (!threadId) return { siblingAlertsCleared: 0 };
    let siblingAlertsCleared = 0;
    try {
        const siblingRows = await supabaseQuery(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${encodeURIComponent(threadId)}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${MANYCHAT_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(sentAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_manual_outbound_reply',
                cleared_by_outbound_reply_at: sentAt,
                cleared_by_outbound_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    actioned_at: sentAt,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        }
    } catch (err) {
        console.warn('[mark-manual-dm-sent] sibling alert cleanup failed:', err.message || err);
    }
    return { siblingAlertsCleared };
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const admin = await verifyAdminToken(event);
    if (!admin.ok) return json(403, { error: admin.error });

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const alertId = String(body.alertId || '').trim();
    const message = cleanText(body.message || body.replyText || '');
    const draftTextFromBody = cleanText(body.draftText || '');
    const editReason = String(body.editReason || body.edit_reason || '').trim().slice(0, 500);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);

    if (!alertId) return json(400, { error: 'Missing alertId' });
    if (!message) return json(400, { error: 'Missing message' });
    if (message.length > 8000) return json(400, { error: 'Message too long (max 8000 chars)' });

    let alert;
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,status,suggested_message,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        alert = rows[0] || null;
    } catch (err) {
        console.error('[mark-manual-dm-sent] alert lookup failed:', err);
        return json(500, { error: 'Alert lookup failed' });
    }

    if (!alert) return json(404, { error: 'Alert not found' });
    if (!['pending', 'dismissed', 'canceled'].includes(alert.status)) {
        return json(409, { error: `Alert is already ${alert.status}` });
    }
    if (!isManyChatDmAlert(alert)) return json(400, { error: 'Alert is not an IG/FB DM alert' });

    const data = alert.data || {};
    const threadId = data.ig_thread_id || null;
    if (!threadId) return json(400, { error: 'Alert missing ig_thread_id, cannot write IG conversation history' });

    const draftText = draftTextFromBody || cleanText(data.draft_text || alert.suggested_message || '');
    const wasEdited = !!draftText && message !== draftText;
    const sentAt = new Date().toISOString();
    const source = (data.channel === 'messenger' || alert.alert_type === 'fb_incoming_dm')
        ? 'manual_messenger'
        : 'manual_instagram';

    let historyResult;
    try {
        historyResult = await ensureManualHistory({ alertId, threadId, message, source });
    } catch (err) {
        console.error('[mark-manual-dm-sent] history insert failed:', err);
        return json(502, { error: 'Could not add this to IG conversation history', details: err.message || String(err) });
    }

    const seenReceipt = await sendInstagramSeenReceiptForThread({
        threadId,
        actorId: admin.userId,
        source,
        sentAtIso: sentAt,
        loggerPrefix: 'mark-manual-dm-sent',
    });

    const mergedData = {
        ...data,
        sent_message: message,
        was_edited: wasEdited,
        sent_at: sentAt,
        sent_via: source,
        chunks_sent: 1,
        chunks_total: 1,
        sent_chunks: [message],
        sent_split_strategy: 'manual_single',
        manual_dm_marked_sent: true,
        manual_dm_marked_sent_by: admin.userId,
        manual_dm_history_logged: true,
        manual_dm_history_message_id: historyResult.messageId || null,
        instagram_seen_receipt: seenReceipt,
    };
    if (wasEdited && editReason) mergedData.edit_reason = editReason;
    if (timingSuggestion) {
        mergedData.reply_timing_suggestion = timingSuggestion;
        mergedData.reply_timing_choice = {
            action: 'send_now',
            chosen_delay_ms: 0,
            chosen_at: sentAt,
            source,
        };
    }

    try {
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: {
                status: 'sent',
                actioned_at: sentAt,
                data: mergedData,
            },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.error('[mark-manual-dm-sent] alert status update failed:', err);
        return json(500, {
            error: 'History was logged but the DM alert could not be marked sent',
            details: err.message || String(err),
            history_logged: true,
        });
    }

    const cleanup = await clearSiblingManyChatAlerts({
        alertId,
        threadId,
        sentAt,
        source,
    });

    await fireCoachEditAnalysis({
        alertId,
        draftText,
        sentMessage: message,
        source,
    });

    return json(200, {
        ok: true,
        alertId,
        wasEdited,
        history_logged: true,
        thread_id: threadId,
        message_id: historyResult.messageId || null,
        seen_receipt: seenReceipt,
        ...cleanup,
    });
};
