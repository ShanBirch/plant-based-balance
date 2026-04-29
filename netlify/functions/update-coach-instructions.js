/**
 * update-coach-instructions — saves Shannon's per-client AI guidance
 * directly from the Control activity (Android) without him having to
 * open the dashboard's Notes modal.
 *
 * Same auth model as the rest of the coach-* endpoints: alertId is the
 * capability token. We resolve coach_id + client_id off the alert (with
 * the linked-IG-thread fallback for cold leads that converted later),
 * then upsert into client_memory.
 *
 * Request:
 *   POST { alertId: string, coachInstructions: string }
 *
 * Response:
 *   { ok: true, savedAt }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const MAX_LEN = 2000;

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
        throw new Error(`Supabase ${path} -> ${res.status} ${text}`);
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
    const raw = (body.coachInstructions || '').trim();
    if (!alertId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    if (raw.length > MAX_LEN) {
        return { statusCode: 400, body: JSON.stringify({ error: `Too long (max ${MAX_LEN} chars)` }) };
    }

    // 1. Resolve coach_id + client_id off the alert.
    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=client_id,coach_id,data&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }
    if (!alert) return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };

    const coachId = alert.coach_id;
    let clientId = alert.client_id;
    const data = alert.data || {};
    const igThreadId = data.ig_thread_id || null;

    // Fallback: linked IG thread for cold-lead-converted-later alerts.
    if (!clientId && igThreadId) {
        try {
            const tRows = await supabase(
                `ig_threads?select=linked_user_id&id=eq.${igThreadId}&limit=1`
            );
            if (tRows[0] && tRows[0].linked_user_id) clientId = tRows[0].linked_user_id;
        } catch (e) { /* non-fatal */ }
    }

    if (!coachId || !clientId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'Cannot save coach instructions without coach + client. Cold lead?',
            }),
        };
    }

    // 2. Upsert into client_memory. raw="" means clear the field.
    const value = raw.length === 0 ? null : raw;
    try {
        await supabase(
            `client_memory?on_conflict=coach_id,client_id`,
            {
                method: 'POST',
                body: [{
                    coach_id: coachId,
                    client_id: clientId,
                    coach_instructions: value,
                }],
                prefer: 'resolution=merge-duplicates,return=minimal',
            }
        );
    } catch (e) {
        console.error('[update-coach-instructions] upsert failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Save failed', details: e.message }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, savedAt: new Date().toISOString() }),
    };
};
