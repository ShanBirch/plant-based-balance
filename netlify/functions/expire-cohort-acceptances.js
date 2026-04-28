/**
 * expire-cohort-acceptances
 *
 * Hourly scheduled function. Calls the `expire_cohort_acceptances()` RPC,
 * which marks any `challenge_participants` row whose 24-hour acceptance
 * window has lapsed as `status='expired'`. The vacated slot is filled
 * naturally on the next call to `auto_enroll_user_in_cohort` — i.e. when
 * a new LP applicant signs up in the app, they'll be backfilled into the
 * still-pending cohort with their own fresh 24h window.
 *
 * Idempotent: the RPC's WHERE clause excludes anything already past
 * pending_acceptance, so re-running in the same hour is a no-op.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async () => {
    if (!SUPABASE_SERVICE_KEY) {
        console.error('[expire-cohort] SUPABASE_SERVICE_ROLE_KEY not configured');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let result;
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/expire_cohort_acceptances`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`RPC failed: ${res.status} ${text}`);
        }
        result = await res.json();
    } catch (err) {
        console.error('[expire-cohort] RPC failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'RPC failed' }) };
    }

    const expiredCount = result?.expired_count || 0;
    if (expiredCount > 0) {
        console.log(`[expire-cohort] expired ${expiredCount} cohort participant(s):`, JSON.stringify(result.expired));
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, expiredCount, expired: result?.expired || [] }),
    };
};
