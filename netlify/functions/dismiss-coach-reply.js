/**
 * dismiss-coach-reply — handler for the "Forget" action on a coach draft.
 *
 * Called by the Android Control Center (CoachScheduleActivity) and can also
 * be called from the admin dashboard. Flips a pending alert to 'dismissed'
 * and optionally stores a human-readable reason in data.dismiss_reason so
 * the voice-match feedback loop can learn what kinds of drafts Shannon
 * doesn't want.
 *
 * Same capability-token auth model as send-coach-reply / schedule-coach-reply:
 * the coach_alert UUID is the unguessable cap, status flip prevents replays.
 *
 * Request body:
 *   {
 *     alertId:  string  — coach_alert UUID (capability token)
 *     reason?:  string  — optional free-text reason ("wrong tone", "already replied", etc.)
 *     source?:  string  — telemetry tag, defaults to 'dismiss'
 *   }
 *
 * Returns 200 on success, 409 if the alert is already actioned.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

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

    const alertId = (body.alertId || '').trim();
    const reason = (body.reason || '').trim().slice(0, 240);
    const source = body.source || 'dismiss';

    if (!alertId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    }

    // 1. Load alert and validate it's still actionable.
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,status,data&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        console.error('[dismiss-coach-reply] alert lookup failed:', e.message);
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

    // 2. Flip to dismissed + merge reason into data.
    const mergedData = {
        ...(alert.data || {}),
        dismissed_via: source,
    };
    if (reason) {
        mergedData.dismiss_reason = reason;
    }

    try {
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                status: 'dismissed',
                actioned_at: new Date().toISOString(),
                data: mergedData,
            },
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.error('[dismiss-coach-reply] PATCH failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to dismiss alert' }) };
    }

    console.log(`[dismiss-coach-reply] alert ${alertId} dismissed via ${source}${reason ? ' reason: ' + reason : ''}`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
        }),
    };
};
