const { createClient } = require('@supabase/supabase-js');
const { randomInt } = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

function response(statusCode, body) {
    return { statusCode, body: JSON.stringify(body) };
}

function getHeader(headers, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

async function requireShannonAdmin(event) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { response: response(500, { error: 'Server misconfigured' }) };
    }

    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: response(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: response(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== BALANCE_ADMIN_EMAIL) return { response: response(403, { error: 'Forbidden' }) };
    return { user };
}

function makeTemporaryPassword(user) {
    const source = String(user?.name || user?.email || 'Balance')
        .split('@')[0]
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 10);
    const stem = source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Balance';
    const number = randomInt(1000, 10000);
    return `${stem}Balance${number}!`;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return response(405, { error: 'Method not allowed' });
    }

    const admin = await requireShannonAdmin(event);
    if (admin.response) return admin.response;

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return response(400, { error: 'Invalid JSON' });
    }

    const userId = String(body.userId || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return response(400, { error: 'Missing or invalid userId' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: publicUser, error: userError } = await supabase
        .from('users')
        .select('id,email,name')
        .eq('id', userId)
        .maybeSingle();

    if (userError) {
        console.error('[admin-reset-user-password] user lookup failed:', userError.message);
        return response(500, { error: 'User lookup failed' });
    }
    if (!publicUser?.email) {
        return response(404, { error: 'User not found or missing email' });
    }

    const temporaryPassword = makeTemporaryPassword(publicUser);
    const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true,
    });

    if (resetError) {
        console.error('[admin-reset-user-password] reset failed:', resetError.message);
        return response(500, { error: 'Password reset failed' });
    }

    return response(200, {
        ok: true,
        userId,
        email: publicUser.email,
        name: publicUser.name || '',
        temporaryPassword,
    });
};
