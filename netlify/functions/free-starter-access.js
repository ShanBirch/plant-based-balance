const { createHash } = require('node:crypto');
const { supabaseQuery } = require('./_lib/client-context');
const response = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });
    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    if (!/^Bearer \S+$/i.test(authorization)) return response(401, { error: 'Please sign in.' });
    try {
        const auth = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, Authorization: authorization }
        });
        if (!auth.ok) return response(401, { error: 'Please sign in again.' });
        const user = await auth.json();
        if (!user.id || user.is_anonymous) return response(401, { error: 'Please sign in to your own account.' });
        let body;
        try { body = JSON.parse(event.body || '{}'); } catch (_) { return response(400, { error: 'Invalid request.' }); }
        const profiles = await supabaseQuery(`users?id=eq.${encodeURIComponent(user.id)}&select=subscription_status&limit=1`);
        if (['active', 'trialing', 'paid', 'paying'].includes(profiles?.[0]?.subscription_status)) {
            // Opening someone else's invitation must not consume it for a paid member.
            return response(200, { starter: null, alreadyMember: true });
        }
        let rows;
        if (body.token) {
            if (!/^[A-Za-z0-9_-]{43}$/.test(body.token)) return response(400, { error: 'This invitation is invalid.' });
            rows = await supabaseQuery('rpc/claim_balance_free_starter', {
                method: 'POST', body: { p_user_id: user.id, p_token_hash: createHash('sha256').update(body.token).digest('hex') }
            });
        } else {
            rows = await supabaseQuery(`balance_free_starters?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=id,workouts_ready,workout_limit&limit=1`);
        }
        const grant = rows?.[0];
        return response(200, { starter: grant ? { id: grant.id, workoutLimit: grant.workout_limit, workoutsReady: grant.workouts_ready, courseAccess: true } : null });
    } catch (_) {
        return response(409, { error: 'We could not confirm your free invitation. Please retry or ask Shannon for help.' });
    }
};
