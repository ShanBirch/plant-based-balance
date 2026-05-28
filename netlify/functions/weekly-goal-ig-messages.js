/**
 * Authenticated weekly-goal IG/Messenger message count.
 *
 * Clients cannot read ig_threads / ig_messages directly. This exposes only the
 * current user's inbound message timestamps for a requested weekly-goal window.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    };
}

async function verifyUserToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = String(auth || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, error: 'missing_token' };
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, error: 'supabase_not_configured' };

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) return { ok: false, error: 'invalid_token' };
        const user = await response.json();
        if (!user?.id) return { ok: false, error: 'invalid_user' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'auth_failed' };
    }
}

function parseWindow(value) {
    const date = new Date(String(value || ''));
    return Number.isFinite(date.getTime()) ? date : null;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

    const verified = await verifyUserToken(event);
    if (!verified.ok) return json(401, { error: verified.error });

    const params = event.queryStringParameters || {};
    const start = parseWindow(params.start);
    const end = parseWindow(params.end);
    if (!start || !end || end <= start) return json(400, { error: 'Invalid date window' });

    const rangeDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > 45) return json(400, { error: 'Date window too large' });

    try {
        const threads = await supabaseQuery(
            `ig_threads?select=id&linked_user_id=eq.${encodeURIComponent(verified.userId)}` +
            `&order=last_inbound_at.desc.nullslast&limit=20`
        );
        const threadIds = (threads || []).map(row => row.id).filter(Boolean);
        if (!threadIds.length) return json(200, { messages: [], count: 0 });

        const idFilter = threadIds.map(id => encodeURIComponent(id)).join(',');
        const startIso = encodeURIComponent(start.toISOString());
        const endIso = encodeURIComponent(end.toISOString());
        const rows = await supabaseQuery(
            `ig_messages?select=id,thread_id,created_at,direction` +
            `&thread_id=in.(${idFilter})` +
            `&direction=eq.in` +
            `&created_at=gte.${startIso}` +
            `&created_at=lt.${endIso}` +
            `&order=created_at.asc&limit=300`
        );

        const messages = (rows || []).map(row => ({
            id: row.id,
            thread_id: row.thread_id,
            created_at: row.created_at,
            source: 'ig'
        }));
        return json(200, { messages, count: messages.length });
    } catch (err) {
        console.error('[weekly-goal-ig-messages] failed:', err);
        return json(500, { error: 'query_failed' });
    }
};
