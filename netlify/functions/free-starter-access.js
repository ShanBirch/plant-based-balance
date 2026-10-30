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
            rows = await supabaseQuery(`balance_free_starters?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=id,workouts_ready,workout_limit,experience,starts_at,ends_at,setup&limit=1`);
        }
        const grant = rows?.[0];
        if (grant?.experience === 'coached_month_v1' && !grant.setup?.supportOnly) {
            const programs = await supabaseQuery(`custom_workout_programs?user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&select=id&limit=1`);
            if (!programs?.[0]?.id || !grant.starts_at || !grant.ends_at) return response(409, { grantUnavailable:true, error:'Your coaching program needs a setup check. Please ask Shannon to check it before starting.' });
        }
        if (grant?.setup?.supportOnly && (grant.experience !== 'coached_month_v1' || grant.setup.challengeIntakeId !== 'consistency_20261025' || !grant.starts_at || !grant.ends_at)) {
            return response(409, { grantUnavailable:true, error:'Your check-in access needs a setup check. Please ask Shannon for help.' });
        }
        if (grant?.experience === 'coached_month_v1' && grant.ends_at && Date.parse(grant.ends_at) <= Date.now()) {
            return response(403, { expired: true, error: 'Your free coaching period has ended. Contact Shannon about continuing. No payment has been taken.' });
        }
        return response(200, { starter: grant ? { id: grant.id, workoutLimit: grant.experience === 'coached_month_v1' ? grant.setup?.schedule?.length : grant.workout_limit, workoutsReady: grant.workouts_ready,
            experience: grant.experience || 'legacy_starter', startsAt: grant.starts_at || null, endsAt: grant.ends_at || null,
            setup: grant.setup || null, courseAccess: grant.experience !== 'coached_month_v1' } : null });
    } catch (_) {
        return response(409, { error: 'We could not confirm your free invitation. Please retry or ask Shannon for help.' });
    }
};
