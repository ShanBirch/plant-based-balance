/**
 * repair-unread-dm-alerts
 *
 * Restores IG/Messenger DM alerts when the thread itself says Shannon still
 * owes a reply but the latest alert was accidentally dismissed/canceled.
 * Ground truth for lead inbox state is ig_threads.last_inbound_at >
 * ig_threads.last_outbound_at; coach_alerts are the actionable draft cards.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

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
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function execSqlJson(sql) {
    const result = await supabase('rpc/exec_sql_json', {
        method: 'POST',
        body: { sql },
    });
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.rows)) return result.rows;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.result)) return result.result;
    if (typeof result === 'string') {
        try {
            const parsed = JSON.parse(result);
            if (Array.isArray(parsed)) return parsed;
            if (Array.isArray(parsed?.rows)) return parsed.rows;
            if (Array.isArray(parsed?.data)) return parsed.data;
            if (Array.isArray(parsed?.result)) return parsed.result;
        } catch { /* ignore */ }
    }
    return [];
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

    const coachId = String(body.coachId || '').trim();
    if (!isUuid(coachId)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid coachId' }) };
    }

    try {
        const admins = await supabase(`admin_users?select=user_id&user_id=eq.${coachId}&limit=1`);
        if (!admins.length) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Not an admin' }) };
        }
    } catch (e) {
        console.error('[repair-unread-dm-alerts] admin check failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Admin check failed' }) };
    }

    const sql = `
WITH latest_alert AS (
    SELECT DISTINCT ON ((data->>'ig_thread_id'))
        data->>'ig_thread_id' AS thread_id,
        id AS alert_id,
        status AS alert_status,
        created_at AS alert_created_at,
        suggested_message
    FROM public.coach_alerts
    WHERE alert_type IN ('ig_incoming_dm', 'fb_incoming_dm')
      AND data ? 'ig_thread_id'
    ORDER BY (data->>'ig_thread_id'), created_at DESC
),
active_alert AS (
    SELECT DISTINCT data->>'ig_thread_id' AS thread_id
    FROM public.coach_alerts
    WHERE alert_type IN ('ig_incoming_dm', 'fb_incoming_dm')
      AND status IN ('pending', 'scheduled')
      AND data ? 'ig_thread_id'
),
candidates AS (
    SELECT
        la.alert_id,
        la.alert_status,
        t.id AS thread_id,
        COALESCE(NULLIF(t.profile_name, ''), NULLIF(t.ig_username, ''), 'Lead') AS lead_name,
        t.last_inbound_at,
        t.last_outbound_at
    FROM public.ig_threads t
    JOIN latest_alert la ON la.thread_id = t.id::text
    LEFT JOIN active_alert aa ON aa.thread_id = t.id::text
    WHERE t.coach_id = '${coachId}'::uuid
      AND t.last_inbound_at IS NOT NULL
      AND (t.last_outbound_at IS NULL OR t.last_inbound_at > t.last_outbound_at)
      AND t.last_inbound_at >= NOW() - INTERVAL '7 days'
      AND COALESCE(t.lead_stage, '') <> 'churned'
      AND aa.thread_id IS NULL
      AND la.alert_status IN ('dismissed', 'canceled')
      AND la.suggested_message IS NOT NULL
      AND la.alert_created_at >= t.last_inbound_at - INTERVAL '10 minutes'
      AND COALESCE(t.profile_name, '') <> 'Shannon Birch'
      AND COALESCE(t.ig_username, '') <> 'cocos_pt_studio'
    ORDER BY t.last_inbound_at DESC
    LIMIT 50
),
repaired AS (
    UPDATE public.coach_alerts ca
    SET
        status = 'pending',
        actioned_at = NULL,
        scheduled_for = NULL,
        scheduled_at = NULL,
        data = COALESCE(ca.data, '{}'::jsonb) || jsonb_build_object(
            'restored_to_unread_at', NOW(),
            'restored_to_unread_via', 'unanswered_thread_repair',
            'restored_from_status', candidates.alert_status,
            'restored_reason', 'ig_thread_last_inbound_newer_than_last_outbound'
        )
    FROM candidates
    WHERE ca.id = candidates.alert_id
    RETURNING
        ca.id,
        candidates.thread_id,
        candidates.lead_name,
        candidates.last_inbound_at,
        candidates.last_outbound_at
)
SELECT *
FROM repaired
ORDER BY last_inbound_at DESC`;

    try {
        const restored = await execSqlJson(sql);
        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                restoredCount: restored.length,
                restored,
            }),
        };
    } catch (e) {
        console.error('[repair-unread-dm-alerts] repair failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Repair failed', details: e.message }) };
    }
};
