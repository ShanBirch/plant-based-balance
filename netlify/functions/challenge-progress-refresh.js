/**
 * challenge-progress-refresh
 *
 * Keeps challenge leaderboards moving even when nobody opens the app.
 * This matters for seeded/test participants whose future-dated point
 * transactions are meant to release gradually through the challenge.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const DEFAULT_LIMIT = 500;

function readLimit() {
    const value = Number(process.env.CHALLENGE_PROGRESS_REFRESH_LIMIT);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.round(value), 2000);
}

async function callRpc(functionName, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body || {}),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Supabase RPC ${functionName} -> ${res.status} ${text.slice(0, 240)}`);
    }

    if (!text || !text.trim()) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

exports.handler = async () => {
    const startedAt = Date.now();

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: 'supabase_not_configured' }),
        };
    }

    try {
        const result = await callRpc('refresh_active_challenge_points', { p_limit: readLimit() });

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                checked_at: new Date().toISOString(),
                result,
                elapsed_ms: Date.now() - startedAt,
            }),
        };
    } catch (e) {
        console.error('[challenge-progress-refresh] failed:', e.message);
        return {
            statusCode: 500,
            body: JSON.stringify({
                ok: false,
                error: 'refresh_failed',
                details: e.message,
                elapsed_ms: Date.now() - startedAt,
            }),
        };
    }
};
