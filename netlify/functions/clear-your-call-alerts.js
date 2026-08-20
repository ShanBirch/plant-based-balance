const SUPABASE_URL = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const MAX_ALERTS_PER_CLEAR = 300;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(body),
    };
}

function bearerToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    return String(auth).replace(/^Bearer\s+/i, '').trim();
}

async function verifyAdminToken(event) {
    const token = bearerToken(event);
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return String(user?.email || '').trim().toLowerCase() === BALANCE_ADMIN_EMAIL ? user : null;
}

async function supabaseRequest(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 240)}`);
    return text ? JSON.parse(text) : null;
}

function normalizeIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(id => String(id || '').trim()).filter(id => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, MAX_ALERTS_PER_CLEAR);
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, reason: 'method_not_allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { ok: false, reason: 'server_configuration_error' });

    try {
        const admin = await verifyAdminToken(event);
        if (!admin) return json(401, { ok: false, reason: 'admin_auth_required' });
        let body = {};
        try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(400, { ok: false, reason: 'invalid_json' }); }
        const ids = normalizeIds(body.ids);
        if (!ids.length) return json(400, { ok: false, reason: 'no_alert_ids' });

        const encodedIds = ids.map(encodeURIComponent).join(',');
        const current = await supabaseRequest(`coach_alerts?select=id,coach_id,status,data&id=in.(${encodedIds})&status=eq.pending`);
        const ownedRows = (current || [])
            .filter(row => !row.coach_id || String(row.coach_id) === String(admin.id))
        if (!ownedRows.length) return json(409, { ok: false, reason: 'alerts_not_pending', requested: ids.length, cleared: 0 });

        const actionedAt = new Date().toISOString();
        const results = [];
        for (let index = 0; index < ownedRows.length; index += 20) {
            const chunk = ownedRows.slice(index, index + 20);
            results.push(...await Promise.all(chunk.map(row => supabaseRequest(
                `coach_alerts?id=eq.${encodeURIComponent(row.id)}&status=eq.pending`, {
                    method: 'PATCH',
                    headers: { Prefer: 'return=representation' },
                    body: JSON.stringify({
                        status: 'dismissed',
                        actioned_at: actionedAt,
                        data: {
                            ...(row.data && typeof row.data === 'object' ? row.data : {}),
                            dismissed_via: 'admin_your_call_clear_all',
                            dismiss_reason: 'Cleared from Your Call',
                        },
                    }),
                }
            ))));
        }
        const clearedIds = results.flat().map(row => row.id);
        return json(clearedIds.length === ids.length ? 200 : 409, {
            ok: clearedIds.length === ids.length,
            requested: ids.length,
            cleared: clearedIds.length,
            clearedIds,
            actionedAt,
            reason: clearedIds.length === ids.length ? null : 'partial_clear',
        });
    } catch (error) {
        console.error('[Your Call Clear] failed:', error);
        return json(500, { ok: false, reason: 'clear_failed' });
    }
};

module.exports.__test = { normalizeIds };
