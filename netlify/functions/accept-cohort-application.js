/**
 * accept-cohort-application
 *
 * Receives a challenge-LP form submission (vegan-challenge or
 * transform-challenge) and writes a row to `cohort_invitations`. That row is
 * the gate the auto_enroll_user_in_cohort RPC checks when the same email
 * later signs up for the app — without a matching invitation, the new user
 * does NOT get auto-enrolled in the corresponding cohort.
 *
 * The cohort_type is derived from the `landing_page` field so each LP
 * funnels into its own cohort:
 *   vegan-challenge      -> plant_based_30
 *   transform-challenge  -> transform_30
 *
 * POST body: { name, email, instagram, utm_source, utm_medium, utm_campaign,
 *              utm_content, fbclid, referrer, landing_page, cohortType? }
 *
 * Always returns 200 to the LP — this endpoint is best-effort. The
 * formsubmit.co email notification is the user-visible "submitted!" signal;
 * we don't want a transient DB hiccup to make the LP show an error.
 */

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

function ok(body) {
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(body) };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders(), body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'Valid email required' }) };
    }

    if (!SUPABASE_SERVICE_KEY) {
        console.error('[accept-cohort] SUPABASE_SERVICE_ROLE_KEY not configured');
        return ok({ ok: false, error: 'misconfigured' });
    }

    const LANDING_PAGE_MAP = {
        'vegan-challenge': { cohort_type: 'plant_based_30', source: 'vegan_challenge_lp' },
        'transform-challenge': { cohort_type: 'transform_30', source: 'transform_challenge_lp' },
    };
    const lpMatch = LANDING_PAGE_MAP[payload.landing_page];
    const cohortType = String(payload.cohortType || lpMatch?.cohort_type || 'plant_based_30');
    const source = lpMatch?.source || payload.source || 'lp';

    const row = {
        email,
        cohort_type: cohortType,
        source,
        name: (payload.name || '').toString().trim() || null,
        ig_handle: (payload.instagram || '').toString().trim() || null,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        referrer: payload.referrer || null,
    };

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cohort_invitations`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
            body: JSON.stringify(row),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[accept-cohort] insert failed:', res.status, errText);
            return ok({ ok: false, error: 'queue_error' });
        }

        const inserted = await res.json().catch(() => []);
        const id = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
        console.log(`[accept-cohort] invitation ${id} created for ${email} (cohort=${cohortType}, source=${source})`);
        return ok({ ok: true, invitationId: id });
    } catch (err) {
        console.error('[accept-cohort] failed:', err.message);
        return ok({ ok: false, error: 'server_error' });
    }
};
