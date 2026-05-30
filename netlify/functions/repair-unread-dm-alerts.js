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
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function response(statusCode, body) {
    return { statusCode, body: JSON.stringify(body) };
}

function getHeader(headers, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

async function requireShannonAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: response(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: response(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== BALANCE_ADMIN_EMAIL) return { response: response(403, { error: 'Forbidden' }) };
    return { user };
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

function mergeData(existing, patch) {
    return { ...((existing && typeof existing === 'object') ? existing : {}), ...patch };
}

async function requestBlankDraftRepair(row) {
    const nowIso = new Date().toISOString();
    const data = mergeData(row.alert_data, {
        blank_draft_repair_requested_at: nowIso,
        blank_draft_repair_via: 'repair-unread-dm-alerts',
        blank_draft_repair_message_id: row.manychat_message_id || row.message_id || null,
    });

    await supabase(`coach_alerts?id=eq.${row.alert_id}&status=eq.pending`, {
        method: 'PATCH',
        body: { data },
        prefer: 'return=minimal',
    });

    const repairMessageId = row.manychat_message_id || `repair:${row.message_id || row.alert_id}`;
    const dispatch = fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            threadId: row.thread_id,
            messageText: row.message_text || row.message_preview || '',
            manychatMessageId: repairMessageId,
        }),
    });
    const result = await Promise.race([
        dispatch,
        new Promise(resolve => setTimeout(() => resolve(null), 1200)),
    ]);
    if (result && !result.ok) {
        const text = await result.text().catch(() => '');
        throw new Error(`draft repair handoff ${result.status}: ${text.slice(0, 220)}`);
    }
    return {
        id: row.alert_id,
        thread_id: row.thread_id,
        message_id: row.message_id || null,
        manychat_message_id: row.manychat_message_id || null,
        dispatched: true,
    };
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

    const adminAuth = await requireShannonAdmin(event);
    if (adminAuth.response) return adminAuth.response;
    if (coachId !== adminAuth.user?.id) return response(403, { error: 'Forbidden' });

    const threadStateCtes = `
WITH latest_outbound_message AS (
    SELECT thread_id, MAX(created_at) AS latest_outbound_message_at
    FROM public.ig_messages
    WHERE direction = 'out'
    GROUP BY thread_id
),
latest_sent_alert AS (
    SELECT
        data->>'ig_thread_id' AS thread_id,
        MAX(actioned_at) AS latest_sent_alert_at
    FROM public.coach_alerts
    WHERE alert_type IN ('ig_incoming_dm', 'fb_incoming_dm')
      AND status = 'sent'
      AND actioned_at IS NOT NULL
      AND data ? 'ig_thread_id'
    GROUP BY data->>'ig_thread_id'
),
thread_state AS (
    SELECT
        t.id AS thread_id,
        t.profile_name,
        t.ig_username,
        t.last_inbound_at,
        t.last_outbound_at,
        GREATEST(t.last_outbound_at, lom.latest_outbound_message_at, lsa.latest_sent_alert_at) AS effective_last_outbound_at
    FROM public.ig_threads t
    LEFT JOIN latest_outbound_message lom ON lom.thread_id = t.id
    LEFT JOIN latest_sent_alert lsa ON lsa.thread_id = t.id::text
    WHERE t.coach_id = '${coachId}'::uuid
      AND t.last_inbound_at IS NOT NULL
      AND t.last_inbound_at >= NOW() - INTERVAL '7 days'
      AND COALESCE(t.lead_stage, '') <> 'churned'
      AND NOT (
        COALESCE(t.custom_data, '{}'::jsonb) ? 'merged_into_thread_id'
        OR COALESCE(t.custom_data, '{}'::jsonb) ? 'merged_into_ig_thread_id'
      )
)
`;

    const staleThreadSql = `${threadStateCtes}
SELECT
    thread_id,
    last_inbound_at,
    last_outbound_at,
    effective_last_outbound_at
FROM thread_state
WHERE effective_last_outbound_at IS NOT NULL
  AND (
    last_outbound_at IS NULL
    OR last_outbound_at < effective_last_outbound_at
  )
ORDER BY effective_last_outbound_at DESC
LIMIT 50`;

    const answeredPendingSql = `${threadStateCtes}
SELECT
    ca.id AS alert_id,
    ca.data AS alert_data,
    ca.created_at,
    ca.data->>'ig_thread_id' AS thread_id,
    thread_state.last_inbound_at,
    thread_state.effective_last_outbound_at
FROM public.coach_alerts ca
JOIN thread_state ON ca.data->>'ig_thread_id' = thread_state.thread_id::text
    WHERE ca.alert_type IN ('ig_incoming_dm', 'fb_incoming_dm')
      AND ca.status = 'pending'
      AND ca.data ? 'ig_thread_id'
      AND thread_state.effective_last_outbound_at IS NOT NULL
      AND thread_state.last_inbound_at <= thread_state.effective_last_outbound_at
      AND ca.created_at <= thread_state.effective_last_outbound_at + INTERVAL '10 minutes'
ORDER BY created_at DESC`;

    const restoreCandidateSql = `${threadStateCtes},
latest_alert AS (
    SELECT DISTINCT ON ((data->>'ig_thread_id'))
        data->>'ig_thread_id' AS thread_id,
        id AS alert_id,
        status AS alert_status,
        created_at AS alert_created_at,
        suggested_message,
        data AS alert_data
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
        la.alert_data,
        ts.thread_id,
        COALESCE(NULLIF(ts.profile_name, ''), NULLIF(ts.ig_username, ''), 'Lead') AS lead_name,
        ts.last_inbound_at,
        ts.effective_last_outbound_at AS last_outbound_at
    FROM thread_state ts
    JOIN latest_alert la ON la.thread_id = ts.thread_id::text
    LEFT JOIN active_alert aa ON aa.thread_id = ts.thread_id::text
    WHERE ts.last_inbound_at IS NOT NULL
      AND (ts.effective_last_outbound_at IS NULL OR ts.last_inbound_at > ts.effective_last_outbound_at)
      AND ts.last_inbound_at >= NOW() - INTERVAL '7 days'
      AND aa.thread_id IS NULL
      AND la.alert_status IN ('dismissed', 'canceled')
      AND la.suggested_message IS NOT NULL
      AND NOT (
        la.alert_status = 'dismissed'
        AND (
            COALESCE(la.alert_data, '{}'::jsonb) ? 'dismissed_via'
            OR COALESCE(la.alert_data, '{}'::jsonb) ? 'dismiss_reason'
            OR COALESCE(la.alert_data, '{}'::jsonb) ? 'dismissed_at'
        )
      )
      AND NOT (
        la.alert_status = 'canceled'
        AND COALESCE(
            la.alert_data->>'cancel_reason',
            la.alert_data->>'schedule_cancel_reason',
            ''
        ) IN (
            'cleared_by_outbound_reply',
            'cleared_by_manual_outbound_reply',
            'cleared_by_scheduled_reply',
            'cleared_by_recorded_outbound_reply',
            'superseded_by_new_message',
            'auto_dm_stopped_by_admin'
        )
      )
      AND la.alert_created_at >= ts.last_inbound_at - INTERVAL '10 minutes'
      AND COALESCE(ts.profile_name, '') <> 'Shannon Birch'
      AND COALESCE(ts.ig_username, '') <> 'cocos_pt_studio'
    ORDER BY ts.last_inbound_at DESC
    LIMIT 50
)
SELECT *
FROM candidates
ORDER BY last_inbound_at DESC`;

    const blankDraftCandidateSql = `${threadStateCtes},
latest_inbound AS (
    SELECT DISTINCT ON (thread_id)
        id AS message_id,
        thread_id,
        text AS message_text,
        manychat_message_id,
        created_at AS message_created_at
    FROM public.ig_messages
    WHERE direction = 'in'
    ORDER BY thread_id, created_at DESC
),
blank_pending AS (
    SELECT
        ca.id AS alert_id,
        ca.data AS alert_data,
        ca.created_at AS alert_created_at,
        ca.data->>'ig_thread_id' AS thread_id,
        ca.data->>'message_preview' AS message_preview,
        li.message_id,
        li.message_text,
        li.manychat_message_id,
        li.message_created_at,
        ts.last_inbound_at,
        ts.effective_last_outbound_at
    FROM public.coach_alerts ca
    JOIN thread_state ts ON ca.data->>'ig_thread_id' = ts.thread_id::text
    JOIN latest_inbound li ON li.thread_id = ts.thread_id
    WHERE ca.alert_type IN ('ig_incoming_dm', 'fb_incoming_dm')
      AND ca.status = 'pending'
      AND ca.data ? 'ig_thread_id'
      AND ts.last_inbound_at IS NOT NULL
      AND (ts.effective_last_outbound_at IS NULL OR ts.last_inbound_at > ts.effective_last_outbound_at)
      AND COALESCE(NULLIF(BTRIM(ca.suggested_message), ''), NULLIF(BTRIM(ca.data->>'draft_text'), '')) IS NULL
      AND BTRIM(COALESCE(li.message_text, ca.data->>'message_preview', '')) <> ''
      AND (
        ca.data->>'blank_draft_repair_requested_at' IS NULL
        OR (ca.data->>'blank_draft_repair_requested_at')::timestamptz < NOW() - INTERVAL '5 minutes'
      )
      AND COALESCE(ts.profile_name, '') <> 'Shannon Birch'
      AND COALESCE(ts.ig_username, '') <> 'cocos_pt_studio'
    ORDER BY li.message_created_at DESC
    LIMIT 20
)
SELECT *
FROM blank_pending
ORDER BY message_created_at DESC`;

    try {
        const staleThreads = await execSqlJson(staleThreadSql);
        const syncedThreads = [];
        for (const row of staleThreads) {
            try {
                const updated = await supabase(`ig_threads?id=eq.${row.thread_id}`, {
                    method: 'PATCH',
                    body: {
                        last_outbound_at: row.effective_last_outbound_at,
                        updated_at: new Date().toISOString(),
                    },
                    prefer: 'return=representation',
                });
                if (updated[0]) syncedThreads.push(updated[0]);
            } catch (e) {
                console.warn('[repair-unread-dm-alerts] stale thread sync failed:', row.thread_id, e.message);
            }
        }

        const answeredPending = await execSqlJson(answeredPendingSql);
        const resolved = [];
        for (const row of answeredPending) {
            const nowIso = new Date().toISOString();
            const data = mergeData(row.alert_data, {
                cancel_reason: 'cleared_by_recorded_outbound_reply',
                canceled_at: nowIso,
                resolved_by_repair_at: nowIso,
                resolved_by_repair_via: 'outbound_message_after_inbound',
                resolved_last_outbound_at: row.effective_last_outbound_at,
            });
            try {
                const updated = await supabase(`coach_alerts?id=eq.${row.alert_id}&status=eq.pending`, {
                    method: 'PATCH',
                    body: {
                        status: 'canceled',
                        actioned_at: nowIso,
                        scheduled_for: null,
                        scheduled_at: null,
                        data,
                    },
                    prefer: 'return=representation',
                });
                if (updated[0]) {
                    resolved.push({
                        id: updated[0].id,
                        thread_id: row.thread_id,
                        last_inbound_at: row.last_inbound_at,
                        last_outbound_at: row.effective_last_outbound_at,
                    });
                }
            } catch (e) {
                console.warn('[repair-unread-dm-alerts] pending duplicate cancel failed:', row.alert_id, e.message);
            }
        }

        const restoreCandidates = await execSqlJson(restoreCandidateSql);
        const restored = [];
        for (const row of restoreCandidates) {
            const nowIso = new Date().toISOString();
            const data = mergeData(row.alert_data, {
                restored_to_unread_at: nowIso,
                restored_to_unread_via: 'unanswered_thread_repair',
                restored_from_status: row.alert_status,
                restored_reason: 'ig_thread_last_inbound_newer_than_last_outbound',
            });
            try {
                const updated = await supabase(`coach_alerts?id=eq.${row.alert_id}&status=eq.${row.alert_status}`, {
                    method: 'PATCH',
                    body: {
                        status: 'pending',
                        actioned_at: null,
                        scheduled_for: null,
                        scheduled_at: null,
                        data,
                    },
                    prefer: 'return=representation',
                });
                if (updated[0]) {
                    restored.push({
                        id: updated[0].id,
                        thread_id: row.thread_id,
                        lead_name: row.lead_name,
                        last_inbound_at: row.last_inbound_at,
                        last_outbound_at: row.last_outbound_at,
                    });
                }
            } catch (e) {
                console.warn('[repair-unread-dm-alerts] repair failed for alert:', row.alert_id, e.message);
            }
        }

        const blankDraftCandidates = await execSqlJson(blankDraftCandidateSql);
        const blankDraftRepairs = [];
        for (const row of blankDraftCandidates) {
            try {
                blankDraftRepairs.push(await requestBlankDraftRepair(row));
            } catch (e) {
                console.warn('[repair-unread-dm-alerts] blank draft repair dispatch failed:', row.alert_id, e.message);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                syncedThreadCount: syncedThreads.length,
                resolvedCount: resolved.length,
                restoredCount: restored.length,
                blankDraftRepairCount: blankDraftRepairs.length,
                syncedThreads: syncedThreads.map(t => ({ id: t.id, last_outbound_at: t.last_outbound_at })),
                resolved,
                restored,
                blankDraftRepairs,
            }),
        };
    } catch (e) {
        console.error('[repair-unread-dm-alerts] repair failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Repair failed', details: e.message }) };
    }
};
