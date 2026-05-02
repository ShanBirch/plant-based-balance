/**
 * send-coach-reply — handler for the Android inline-reply action on a
 * "coach_draft_ready" notification.
 *
 * Called by the native CoachReplyReceiver (android/.../CoachReplyReceiver.java)
 * when Shannon hits "Send" on the notification shade / lockscreen. Takes the
 * drafted (possibly edited) reply text and:
 *   1. Looks up the coach_alert by id — verifies status is still 'pending'
 *      (rejects if already sent, prevents replay / double-send)
 *   2. Inserts the reply as a nudge (sender = coach, receiver = client)
 *   3. Marks the coach_alert as sent + records sent_message + was_edited
 *
 * Authorization model: the coach_alert UUID itself is the capability token.
 * It's:
 *   - Unguessable (v4 UUID)
 *   - One-use (we flip status to 'sent', so a replay gets rejected)
 *   - Only delivered to the admin's device via FCM (which requires the app's
 *     device-specific FCM token, obtained only after authenticated install)
 * This is the same security model PR #1243 uses for the batch ai-client-monitor
 * "quick send" flow — no JWT on the device, server validates via alert status.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const { normalizeCoachDraftText } = require('./_lib/client-context');

async function supabase(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try { return JSON.parse(text); } catch { return []; }
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

const IN_APP_DM_ALERT_TYPES = ['incoming_dm', 'unread_message'];

async function clearInAppHomeNotifications({ alertId, coachId, clientId, sentAt, source }) {
    if (!coachId || !clientId) return { nudgesRead: 0, siblingAlertsCleared: 0 };
    const coach = encodeURIComponent(coachId);
    const client = encodeURIComponent(clientId);
    let nudgesRead = 0;
    let siblingAlertsCleared = 0;

    try {
        const readRows = await supabase(
            `nudges?sender_id=eq.${client}&receiver_id=eq.${coach}&created_at=lte.${encodeURIComponent(sentAt)}&read_at=is.null`,
            {
                method: 'PATCH',
                body: { read_at: sentAt },
                prefer: 'return=representation',
            }
        );
        nudgesRead = Array.isArray(readRows) ? readRows.length : 0;
    } catch (e) {
        console.warn('[send-coach-reply] inbound nudge read cleanup failed:', e.message);
    }

    try {
        const siblingRows = await supabase(
            `coach_alerts?select=id,data&coach_id=eq.${coach}&client_id=eq.${client}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${IN_APP_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(sentAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_outbound_reply',
                cleared_by_outbound_reply_at: sentAt,
                cleared_by_outbound_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
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
    } catch (e) {
        console.warn('[send-coach-reply] sibling alert cleanup failed:', e.message);
    }

    return { nudgesRead, siblingAlertsCleared };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = body.alertId;
    const replyText = normalizeCoachDraftText(body.replyText || '').trim();
    const draftText = normalizeCoachDraftText(body.draftText || '').trim();
    const source = body.source || 'unknown';
    // Optional one-line note from Shannon explaining WHY he edited the
    // draft. Stamped into data.edit_reason when the reply differs from
    // the original draft. Feeds the voice-match learning corpus.
    const editReason = (body.editReason || body.edit_reason || '').trim().slice(0, 240);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);

    if (!alertId || !replyText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or replyText' }) };
    }

    // 1. Load the alert — we need coach_id, client_id, and current status
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,client_id,coach_id,status,data,alert_type&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        console.error('[send-coach-reply] alert lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }

    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }
    if (alert.status && alert.status !== 'pending') {
        // Already actioned — don't double-send. The receiver treats 4xx as a
        // hard error, so the user gets a "Send failed" notification. That's
        // appropriate: the reply already went through via another path.
        return { statusCode: 409, body: JSON.stringify({
            error: 'Alert already actioned',
            status: alert.status,
        }) };
    }

    // Channel routing — ManyChat alerts (Instagram + Facebook Messenger) go
    // through send-ig-reply, which posts to ManyChat's send-content API
    // instead of inserting a nudges row. Forward over HTTP so the two
    // outbound paths stay independently deployable; the forwarder also
    // re-validates status to stay safe when called directly during testing.
    const alertData = alert.data || {};
    if (alertData.channel === 'instagram' || alertData.channel === 'messenger') {
        try {
            const res = await fetch(`${SITE_URL}/.netlify/functions/send-ig-reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId, replyText, draftText, source, editReason, timingSuggestion }),
            });
            const text = await res.text();
            return { statusCode: res.status, body: text || JSON.stringify({ ok: res.ok }) };
        } catch (err) {
            console.error('[send-coach-reply] IG forward failed:', err.message);
            return { statusCode: 502, body: JSON.stringify({ error: 'IG forward failed', details: err.message }) };
        }
    }

    if (!alert.coach_id || !alert.client_id) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert missing coach/client ids' }) };
    }

    // 2. Insert the reply as a nudge (client-to-client DM row in the nudges table).
    //    The DB trigger `notify_nudge_recipient` fires here — since the receiver
    //    is the client (not admin), it routes a normal DM push to the client.
    try {
        await supabase('nudges', {
            method: 'POST',
            body: [{
                sender_id: alert.coach_id,
                receiver_id: alert.client_id,
                message: replyText,
            }],
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.error('[send-coach-reply] nudge insert failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to send message' }) };
    }

    // 3. Mark the alert as sent so the admin dashboard clears it + the AI
    //    "learn from past edits" logic (see instant-coach-draft.js) has a
    //    labelled example to train on.
    const wasEdited = !!draftText && replyText !== draftText;
    const sentAt = new Date().toISOString();
    const mergedData = {
        ...(alert.data || {}),
        sent_message: replyText,
        was_edited: wasEdited,
        sent_at: sentAt,
        sent_via: source,
    };
    if (wasEdited && editReason) {
        mergedData.edit_reason = editReason;
    }
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
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                status: 'sent',
                actioned_at: sentAt,
                data: mergedData,
            },
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.warn('[send-coach-reply] alert update failed (non-fatal):', e.message);
        // Reply is already delivered — don't 500 just because bookkeeping failed.
    }

    const cleanup = await clearInAppHomeNotifications({
        alertId,
        coachId: alert.coach_id,
        clientId: alert.client_id,
        sentAt,
        source,
    });

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            wasEdited,
            ...cleanup,
        }),
    };
};
