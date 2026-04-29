/**
 * cancel-coach-reply — handler for the "Cancel scheduled" button in the
 * admin dashboard.
 *
 * Same capability-token model as schedule-coach-reply / send-coach-reply: the
 * coach_alert UUID itself is the auth token, status flip prevents replays.
 *
 * Request body:
 *   {
 *     alertId: string  — coach_alert UUID
 *     reason?: string  — optional human-readable reason for the cancel
 *   }
 *
 * Returns 200 on success, 409 if the alert isn't currently scheduled.
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

    const alertId = body.alertId;
    const reason = (body.reason || 'manual_cancel').trim();
    if (!alertId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    }

    // Atomic claim — only succeeds if the alert is still scheduled. Avoids
    // a race against the worker's claimAlert (which flips to 'pending'
    // moments before send).
    const updated = await supabase(
        `coach_alerts?id=eq.${alertId}&status=eq.scheduled`,
        {
            method: 'PATCH',
            body: { status: 'canceled', actioned_at: new Date().toISOString() },
            prefer: 'return=representation',
        }
    );
    if (updated.length === 0) {
        // Race lost OR alert isn't scheduled. Look up to give a helpful 409.
        const rows = await supabase(`coach_alerts?select=status&id=eq.${alertId}&limit=1`);
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: 'Alert not in scheduled state',
                status: rows[0]?.status || 'unknown',
            }),
        };
    }

    // Stamp reason into data after the atomic claim. Non-fatal if it fails.
    const existingData = updated[0]?.data || {};
    try {
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                data: { ...existingData, cancel_reason: reason, canceled_at: new Date().toISOString() },
            },
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.warn('[cancel-coach-reply] data merge failed (non-fatal):', e.message);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, alertId, canceled_reason: reason }),
    };
};
