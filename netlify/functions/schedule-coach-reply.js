/**
 * schedule-coach-reply — handler for the "Send later" action on a
 * coach_draft_ready notification.
 *
 * Called by the Android CoachScheduleActivity (notification → "Later" tap →
 * picker activity → POST here). Stamps the chosen delay on the coach_alert
 * row so scheduled-coach-reply-worker can fire it when the time arrives.
 *
 * Auth model: same capability-token pattern as send-coach-reply — the
 * coach_alert UUID is unguessable + one-use (status flip from pending →
 * scheduled), and reaches the device only via authenticated FCM.
 *
 * Request body:
 *   {
 *     alertId:       string  — coach_alert UUID (the capability token)
 *     replyText:     string  — the (possibly edited) text to send when due
 *     draftText?:    string  — original AI draft (for was_edited bookkeeping)
 *     sendInMs:      number  — delay in milliseconds; 30s..7d clamp range
 *     source?:       string  — telemetry tag, defaults to 'send_later'
 *   }
 *
 * Returns 200 with `{ ok: true, alertId, scheduledFor }` on success.
 * Returns 409 if the alert is already actioned (sent / canceled / scheduled).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const { normalizeCoachDraftText } = require('./_lib/client-context');

// Hard floor so the worker has a fair chance of firing on time, hard ceiling
// so a typo in the picker UI can't accidentally schedule something a year out.
const MIN_DELAY_MS = 30 * 1000;          // 30 seconds
const MAX_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IN_APP_DM_ALERT_TYPES = ['incoming_dm', 'unread_message'];
const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
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

async function clearInAppPendingSiblingsAfterSchedule({ alertId, coachId, clientId, resolvedAt, source }) {
    if (!coachId || !clientId) return { nudgesRead: 0, siblingAlertsCleared: 0 };
    const coach = encodeURIComponent(coachId);
    const client = encodeURIComponent(clientId);
    let nudgesRead = 0;
    let siblingAlertsCleared = 0;

    try {
        const readRows = await supabase(
            `nudges?sender_id=eq.${client}&receiver_id=eq.${coach}&created_at=lte.${encodeURIComponent(resolvedAt)}&read_at=is.null`,
            {
                method: 'PATCH',
                body: { read_at: resolvedAt },
                prefer: 'return=representation',
            }
        );
        nudgesRead = Array.isArray(readRows) ? readRows.length : 0;
    } catch (e) {
        console.warn('[schedule-coach-reply] inbound nudge read cleanup failed:', e.message);
    }

    try {
        const siblingRows = await supabase(
            `coach_alerts?select=id,data&coach_id=eq.${coach}&client_id=eq.${client}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${IN_APP_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(resolvedAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_scheduled_reply',
                cleared_by_scheduled_reply_at: resolvedAt,
                cleared_by_scheduled_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    actioned_at: resolvedAt,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        }
    } catch (e) {
        console.warn('[schedule-coach-reply] in-app sibling alert cleanup failed:', e.message);
    }

    return { nudgesRead, siblingAlertsCleared };
}

async function clearManyChatPendingSiblingsAfterSchedule({ alertId, igThreadId, resolvedAt, source }) {
    if (!igThreadId) return { siblingAlertsCleared: 0 };
    let siblingAlertsCleared = 0;
    try {
        const siblingRows = await supabase(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${encodeURIComponent(igThreadId)}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${MANYCHAT_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(resolvedAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_scheduled_reply',
                cleared_by_scheduled_reply_at: resolvedAt,
                cleared_by_scheduled_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    actioned_at: resolvedAt,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        }
    } catch (e) {
        console.warn('[schedule-coach-reply] ManyChat sibling alert cleanup failed:', e.message);
    }
    return { siblingAlertsCleared };
}

async function clearPendingSiblingsAfterSchedule({ alert, alertId, resolvedAt, source }) {
    const alertData = alert.data || {};
    if (alertData.channel === 'instagram' || alertData.channel === 'messenger' || alertData.ig_thread_id) {
        return clearManyChatPendingSiblingsAfterSchedule({
            alertId,
            igThreadId: alertData.ig_thread_id,
            resolvedAt,
            source,
        });
    }
    return clearInAppPendingSiblingsAfterSchedule({
        alertId,
        coachId: alert.coach_id,
        clientId: alert.client_id,
        resolvedAt,
        source,
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = body.alertId;
    const replyText = normalizeCoachDraftText(body.replyText || '').trim();
    const draftText = normalizeCoachDraftText(body.draftText || '').trim();
    const source = body.source || 'send_later';
    const sendInMs = Number(body.sendInMs);
    // Optional one-line note from Shannon explaining WHY he's delaying.
    // Stamped into data.schedule_reason so the voice-match feedback
    // loop has a labelled corpus over time. Capped server-side too.
    const scheduleReason = (body.scheduleReason || body.schedule_reason || '').trim().slice(0, 240);
    // Optional reason for the EDIT itself (separate from schedule_reason).
    // Stamped into data.edit_reason when the reply differs from draft —
    // mirrors the send-coach-reply path so both fire/schedule lanes
    // produce the same labelled signal.
    const editReason = (body.editReason || body.edit_reason || '').trim().slice(0, 240);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);

    if (!alertId || !replyText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or replyText' }) };
    }
    if (!Number.isFinite(sendInMs) || sendInMs < MIN_DELAY_MS || sendInMs > MAX_DELAY_MS) {
        return { statusCode: 400, body: JSON.stringify({
            error: 'sendInMs out of range',
            min_ms: MIN_DELAY_MS,
            max_ms: MAX_DELAY_MS,
        }) };
    }

    // 1. Load alert and validate it's still actionable.
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,status,data,coach_id,client_id,suggested_message&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        console.error('[schedule-coach-reply] alert lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }
    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }
    if (alert.status && alert.status !== 'pending') {
        return { statusCode: 409, body: JSON.stringify({
            error: 'Alert already actioned',
            status: alert.status,
        }) };
    }
    // 2. Compute scheduled_for and stamp the row.
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + sendInMs);
    const wasEdited = !!draftText && replyText !== draftText;

    const mergedData = {
        ...(alert.data || {}),
        scheduled_via: source,
        scheduled_was_edited: wasEdited,
        scheduled_send_in_ms: sendInMs,
        scheduled_at: now.toISOString(),
        reply_timing_choice: {
            action: 'schedule',
            chosen_delay_ms: sendInMs,
            chosen_at: now.toISOString(),
            source,
        },
    };
    if (timingSuggestion) {
        mergedData.reply_timing_suggestion = timingSuggestion;
    }
    if (scheduleReason) {
        mergedData.schedule_reason = scheduleReason;
    }
    if (wasEdited && editReason) {
        mergedData.edit_reason = editReason;
    }

    try {
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                status: 'scheduled',
                scheduled_for: scheduledFor.toISOString(),
                scheduled_reply_text: replyText,
                scheduled_at: now.toISOString(),
                data: mergedData,
            },
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.error('[schedule-coach-reply] PATCH failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to schedule reply' }) };
    }

    const cleanup = await clearPendingSiblingsAfterSchedule({
        alert,
        alertId,
        resolvedAt: now.toISOString(),
        source,
    });

    console.log(`[schedule-coach-reply] alert ${alertId} scheduled for ${scheduledFor.toISOString()} (in ${Math.round(sendInMs / 1000)}s)`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            scheduledFor: scheduledFor.toISOString(),
            wasEdited,
            ...cleanup,
        }),
    };
};
