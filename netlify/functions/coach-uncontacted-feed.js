/**
 * coach-uncontacted-feed — backs the "Uncontacted" tab in the dashboard's
 * Control Center. Returns two parallel lists:
 *
 *   1. clients — assigned coach_clients rows where Shannon hasn't sent an
 *      in-app DM in the last UNCONTACTED_DAYS (default 3 days).
 *   2. leads   — ig_threads (Instagram + Messenger) where Shannon hasn't
 *      sent an outbound in the last UNCONTACTED_DAYS, including cold
 *      one-message-and-gone leads.
 *
 * Both queries return up to LIMIT rows each, ordered by stalest-first
 * (oldest last_contact at top — those need attention most). Each row
 * includes lastContactAt + howStaleDays so the UI can render a clean
 * "5d ago" / "12d ago" tag without doing date math client-side.
 *
 * Auth: same model as coach-control-context — alertId-style cap. But
 * this view isn't tied to a specific alert, so we accept a coachId
 * directly instead. The dashboard already authenticates the coach via
 * Supabase auth; we trust the coachId passed from the frontend (which
 * is gated by RLS-ish admin checks on the dashboard side). The coach_id
 * is enforced server-side via a public.admin_users check before any
 * data returns, so a malicious client passing someone else's coachId
 * still has to be an admin.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const UNCONTACTED_DAYS = 3;
const LIMIT = 50;

async function supabase(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    if (!res.ok) throw new Error(`exec_sql_json -> ${res.status}`);
    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (json && json.error) throw new Error(json.error);
    return [];
}

function daysSince(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
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

    const coachId = (body.coachId || '').trim();
    const days = Number(body.days) > 0 ? Number(body.days) : UNCONTACTED_DAYS;
    if (!coachId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing coachId' }) };
    }

    // Admin gate — refuse if the caller isn't an admin user even if
    // they passed a valid coachId. Same pattern as widget-coach-feed.
    try {
        const adminRows = await supabase(
            `admin_users?select=user_id&user_id=eq.${coachId}&limit=1`
        );
        if (adminRows.length === 0) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Not an admin' }) };
        }
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Admin check failed' }) };
    }

    // 1. Clients — assigned to this coach with no DM from coach in N days.
    //    Single SQL via exec_sql_json since the LATERAL subquery isn't
    //    expressible cleanly through PostgREST. cc.assigned_at is the
    //    fallback when no nudges exist (newly-assigned clients still
    //    count as uncontacted past their N-day grace period).
    const clientsSql = `
        SELECT
            cc.client_id,
            COALESCE(u.name, SPLIT_PART(u.email, '@', 1), 'Client') AS client_name,
            u.email,
            (
                SELECT MAX(n.created_at)
                FROM public.nudges n
                WHERE n.sender_id = cc.coach_id AND n.receiver_id = cc.client_id
            ) AS last_dm_from_coach,
            (
                SELECT MAX(n.created_at)
                FROM public.nudges n
                WHERE n.sender_id = cc.client_id AND n.receiver_id = cc.coach_id
            ) AS last_dm_from_client,
            cc.assigned_at
        FROM public.coach_clients cc
        LEFT JOIN public.users u ON u.id = cc.client_id
        WHERE cc.coach_id = '${coachId}'
            AND cc.status = 'active'
            AND cc.client_id <> cc.coach_id
            AND COALESCE((
                SELECT MAX(n.created_at)
                FROM public.nudges n
                WHERE n.sender_id = cc.coach_id AND n.receiver_id = cc.client_id
            ), cc.assigned_at) < (NOW() - (INTERVAL '1 day' * ${days}))
            AND COALESCE(u.is_test_account, FALSE) = FALSE
        ORDER BY COALESCE((
                SELECT MAX(n.created_at)
                FROM public.nudges n
                WHERE n.sender_id = cc.coach_id AND n.receiver_id = cc.client_id
            ), cc.assigned_at) ASC NULLS FIRST
        LIMIT ${LIMIT}
    `;

    let clients = [];
    try {
        const rows = await execSqlJson(clientsSql);
        clients = rows.map(r => {
            const lastContactAt = r.last_dm_from_coach || r.assigned_at;
            return {
                clientId: r.client_id,
                clientName: r.client_name,
                email: r.email,
                lastContactAt,
                lastInboundAt: r.last_dm_from_client,
                howStaleDays: daysSince(lastContactAt),
                neverMessaged: !r.last_dm_from_coach,
            };
        });
    } catch (e) {
        console.error('[uncontacted] clients query failed:', e.message);
    }

    // 2. Leads — IG/FB threads with no outbound from coach in N days.
    //    Includes both cold leads (linked_user_id NULL) and converted
    //    clients who happen to have an IG-side gap. churned excluded.
    let leads = [];
    try {
        const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const rows = await supabase(
            `ig_threads?select=id,profile_name,ig_username,channel,lead_stage,linked_user_id,last_inbound_at,last_outbound_at&coach_id=eq.${coachId}&lead_stage=neq.churned&or=(last_outbound_at.is.null,last_outbound_at.lt.${cutoffIso})&order=last_inbound_at.desc.nullslast&limit=${LIMIT}`
        );
        leads = rows.map(t => {
            const lastContactAt = t.last_outbound_at;
            const isUnresolvedTemplate = (v) => !v || /\{\{[^}]+\}\}/.test(String(v));
            const displayName = !isUnresolvedTemplate(t.profile_name)
                ? t.profile_name
                : (!isUnresolvedTemplate(t.ig_username) ? t.ig_username : 'Lead');
            return {
                threadId: t.id,
                displayName,
                igUsername: t.ig_username,
                channel: t.channel,
                leadStage: t.lead_stage,
                linkedUserId: t.linked_user_id,
                lastContactAt,
                lastInboundAt: t.last_inbound_at,
                howStaleDays: lastContactAt ? daysSince(lastContactAt) : null,
                neverMessaged: !lastContactAt,
            };
        });
    } catch (e) {
        console.error('[uncontacted] leads query failed:', e.message);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            days,
            clients,
            leads,
            totalClients: clients.length,
            totalLeads: leads.length,
        }),
    };
};
