/**
 * mark-manual-checkin-sent
 *
 * Used when Shannon copies a challenge check-in into Instagram manually.
 * It records the outbound in ig_messages, updates the linked thread timestamp,
 * then marks the coach_alert as sent.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    normalizeCoachDraftText,
    fireCoachEditAnalysis,
} = require('./_lib/client-context');

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

function isChallengeCheckinAlert(alert) {
    const data = alert?.data || {};
    return alert?.alert_type === 'weekly_checkin'
        && (data.subtype === 'challenge_checkin' || data.challenge_checkin === true);
}

function cleanText(value) {
    return normalizeCoachDraftText(value || '').trim();
}

async function ensureManualHistory({ alertId, threadId, message, source }) {
    if (!threadId) {
        return { historyLogged: false, historySkipped: 'missing_ig_thread_id' };
    }

    const existingRows = await supabaseQuery(
        `ig_messages?select=id,created_at&alert_id=eq.${encodeURIComponent(alertId)}&direction=eq.out&source=eq.${encodeURIComponent(source)}&limit=1`
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

    let threadUpdated = true;
    let threadUpdateError = null;
    try {
        await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(threadId)}`, {
            method: 'PATCH',
            body: { last_outbound_at: new Date().toISOString() },
            prefer: 'return=minimal',
        });
    } catch (err) {
        threadUpdated = false;
        threadUpdateError = err.message || 'thread_update_failed';
        console.warn('[mark-manual-checkin-sent] thread timestamp update failed:', threadUpdateError);
    }

    return { historyLogged: true, messageId, threadUpdated, threadUpdateError };
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
    const editReason = String(body.editReason || '').trim().slice(0, 500);
    const source = 'manual_instagram';

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
        console.error('[mark-manual-checkin-sent] alert lookup failed:', err);
        return json(500, { error: 'Alert lookup failed' });
    }

    if (!alert) return json(404, { error: 'Alert not found' });
    if (alert.status !== 'pending') return json(409, { error: `Alert is already ${alert.status}` });
    if (!isChallengeCheckinAlert(alert)) return json(400, { error: 'Alert is not a challenge check-in' });

    const data = alert.data || {};
    const draftText = draftTextFromBody || cleanText(data.draft_text || alert.suggested_message || '');
    const wasEdited = !!draftText && message !== draftText;
    const sentAt = new Date().toISOString();
    const threadId = data.ig_thread_id || null;

    let historyResult;
    try {
        historyResult = await ensureManualHistory({ alertId, threadId, message, source });
    } catch (err) {
        console.error('[mark-manual-checkin-sent] history insert failed:', err);
        return json(502, { error: 'Could not add this to IG conversation history', details: err.message || String(err) });
    }

    const mergedData = {
        ...data,
        sent_message: message,
        was_edited: wasEdited,
        sent_at: sentAt,
        sent_via: source,
        manual_ig_marked_sent: true,
        manual_ig_marked_sent_by: admin.userId,
        manual_ig_history_logged: !!historyResult.historyLogged,
        manual_ig_history_message_id: historyResult.messageId || null,
    };
    if (historyResult.historySkipped) mergedData.manual_ig_history_skipped = historyResult.historySkipped;
    if (historyResult.threadUpdateError) mergedData.manual_ig_thread_update_error = historyResult.threadUpdateError;
    if (wasEdited && editReason) mergedData.edit_reason = editReason;

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
        console.error('[mark-manual-checkin-sent] alert status update failed:', err);
        return json(500, {
            error: 'History was logged but the check-in could not be marked sent',
            details: err.message || String(err),
            history_logged: !!historyResult.historyLogged,
        });
    }

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
        history_logged: !!historyResult.historyLogged,
        history_skipped: historyResult.historySkipped || null,
        thread_id: threadId,
        message_id: historyResult.messageId || null,
        thread_updated: historyResult.threadUpdated !== false,
    });
};
