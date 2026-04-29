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

// Hard floor so the worker has a fair chance of firing on time, hard ceiling
// so a typo in the picker UI can't accidentally schedule something a year out.
const MIN_DELAY_MS = 30 * 1000;          // 30 seconds
const MAX_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    const replyText = (body.replyText || '').trim();
    const draftText = (body.draftText || '').trim();
    const source = body.source || 'send_later';
    const sendInMs = Number(body.sendInMs);
    // Optional one-line note from Shannon explaining WHY he's delaying.
    // Stamped into data.schedule_reason so the voice-match feedback
    // loop has a labelled corpus over time. Capped server-side too.
    const scheduleReason = (body.scheduleReason || body.schedule_reason || '').trim().slice(0, 240);

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
    };
    if (scheduleReason) {
        mergedData.schedule_reason = scheduleReason;
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

    console.log(`[schedule-coach-reply] alert ${alertId} scheduled for ${scheduledFor.toISOString()} (in ${Math.round(sendInMs / 1000)}s)`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            scheduledFor: scheduledFor.toISOString(),
            wasEdited,
        }),
    };
};
