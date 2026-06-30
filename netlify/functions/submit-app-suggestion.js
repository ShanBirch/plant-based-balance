const crypto = require('crypto');

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    insertCoachAlert,
    truncate,
} = require('./_lib/client-context');

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function cleanString(value, max = 1200) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
        .slice(0, max);
}

function bearerToken(headers = {}) {
    const raw = headers.authorization || headers.Authorization || '';
    const match = String(raw).match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function getAuthedUser(accessToken) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !accessToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
}

async function loadClientProfile(userId, authUser) {
    try {
        const rows = await supabaseQuery(`users?select=id,name,email&id=eq.${encodeURIComponent(userId)}&limit=1`);
        if (rows[0]) {
            return {
                id: rows[0].id,
                name: rows[0].name || rows[0].email?.split('@')[0] || 'Client',
                email: rows[0].email || authUser?.email || '',
            };
        }
    } catch (e) {
        console.warn('[submit-app-suggestion] user profile lookup failed:', e.message);
    }
    return {
        id: userId,
        name: authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'Client',
        email: authUser?.email || '',
    };
}

async function resolveCoach(clientId) {
    try {
        const links = await supabaseQuery(
            `coach_clients?select=coach_id&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active&order=assigned_at.asc&limit=1`
        );
        if (links[0]?.coach_id) return links[0].coach_id;
    } catch (e) {
        console.warn('[submit-app-suggestion] coach link lookup failed:', e.message);
    }

    try {
        const admins = await supabaseQuery(`users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
        if (admins[0]?.id) return admins[0].id;
    } catch (e) {
        console.warn('[submit-app-suggestion] admin lookup failed:', e.message);
    }
    return null;
}

function suggestionHash(userId, suggestion) {
    const dayKey = new Date().toISOString().slice(0, 10);
    const normalized = suggestion.toLowerCase().replace(/\s+/g, ' ').trim();
    return crypto
        .createHash('sha256')
        .update(`${userId}:${dayKey}:${normalized}`)
        .digest('hex')
        .slice(0, 24);
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const suggestion = cleanString(body.suggestion, 1200);
    if (suggestion.length < 5) {
        return json(400, { error: 'Suggestion is too short' });
    }

    const authUser = await getAuthedUser(bearerToken(event.headers || {}));
    if (!authUser?.id) return json(401, { error: 'Login required' });

    const [profile, coachId] = await Promise.all([
        loadClientProfile(authUser.id, authUser),
        resolveCoach(authUser.id),
    ]);
    if (!coachId) return json(500, { error: 'No coach found' });

    const submittedAt = new Date().toISOString();
    const idempotencyKey = `app_suggestion:${authUser.id}:${suggestionHash(authUser.id, suggestion)}`;
    const title = `${profile.name || 'Client'} suggested an app idea`;
    const alertRow = {
        alert_type: 'general_idea',
        client_id: authUser.id,
        client_name: profile.name || 'Client',
        coach_id: coachId,
        priority: 'medium',
        title: truncate(title, 120),
        description: suggestion,
        suggested_message: null,
        status: 'pending',
        data: {
            subtype: 'app_suggestion',
            operator_queue: 'needs_you',
            needs_you_required: true,
            needs_you_reason: 'app_suggestion',
            suggestion,
            submitted_from: 'settings',
            submitted_at: submittedAt,
            user_id: authUser.id,
            user_email: profile.email || authUser.email || '',
            path: cleanString(body.path, 300),
            user_agent: cleanString(event.headers?.['user-agent'] || event.headers?.['User-Agent'], 500),
        },
    };

    try {
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        return json(200, {
            ok: true,
            alert_id: result.alertId,
            deduped: result.deduped,
        });
    } catch (e) {
        console.error('[submit-app-suggestion] alert insert failed:', e.message);
        return json(500, { error: 'Could not save suggestion' });
    }
};
