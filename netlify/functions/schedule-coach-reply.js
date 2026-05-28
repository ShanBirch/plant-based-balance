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
const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm', 'follow_up_review'];
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const HUMAN_AGENT_MANUAL_ONLY_MESSAGE = 'Meta Human Agent 7-day replies must be sent by a human agent, so Send Later is disabled for this draft.';

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

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hoursSinceIso(value, nowMs = Date.now()) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

function isHumanAgentWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours > 24 && hours <= 24 * 7;
}

function resolveGraphRecipientId(data = {}) {
    const graph = safeObject(data.instagram_graph);
    const customData = safeObject(data.custom_data);
    const nestedGraph = safeObject(customData.instagram_graph);
    const candidates = [
        data.ig_graph_recipient_id,
        data.ig_graph_user_id,
        graph.ig_graph_user_id,
        graph.recipient_id,
        nestedGraph.ig_graph_user_id,
        nestedGraph.recipient_id,
    ];
    const subscriberId = String(data.subscriber_id || '');
    if (subscriberId.startsWith(GRAPH_SUBSCRIBER_PREFIX)) {
        candidates.push(subscriberId.slice(GRAPH_SUBSCRIBER_PREFIX.length));
    }
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function requiresHumanAgentManualSend(alert) {
    const data = safeObject(alert?.data);
    const graph = safeObject(data.instagram_graph);
    if (data.human_agent_required === true || graph.human_agent_required === true) return true;
    const isInstagramGraph = data.channel === 'instagram'
        || data.delivery_channel === 'instagram_graph'
        || String(data.subscriber_id || '').startsWith(GRAPH_SUBSCRIBER_PREFIX);
    if (!isInstagramGraph || !resolveGraphRecipientId(data)) return false;
    const lastInboundAt = data.ig_last_inbound_at
        || data.last_inbound_at
        || graph.last_inbound_at;
    return isHumanAgentWindow(lastInboundAt);
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
    const approveAutoReview = body.approveAutoReview === true || body.approve_auto_review === true;
    const approveAutoReviewFrom = String(body.approveAutoReviewFrom || body.approve_auto_review_from || source).slice(0, 80);

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
    if (requiresHumanAgentManualSend(alert)) {
        return { statusCode: 409, body: JSON.stringify({
            error: HUMAN_AGENT_MANUAL_ONLY_MESSAGE,
            code: 'human_agent_manual_send_required',
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
    if (approveAutoReview) {
        delete mergedData.auto_send_review_hold;
        mergedData.auto_send_review_approved_at = now.toISOString();
        mergedData.auto_send_review_approved_by = source;
        mergedData.auto_send_review_approved_from = approveAutoReviewFrom;
    }
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
