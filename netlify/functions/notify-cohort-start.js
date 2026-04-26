/**
 * notify-cohort-start
 *
 * Fires when a cohort challenge has just hit its participant threshold and
 * activated. Sends a push to every participant: "Your 30-Day Plant-Based
 * Challenge has begun!"
 *
 * POST body: { challengeId: UUID }
 *
 * Called from dashboard JS (`tryAutoEnrollInCohort`) immediately after the
 * `auto_enroll_user_in_cohort` RPC returns `just_started: true`.
 *
 * Delegates the actual push delivery to `send-dm-notification`, which already
 * knows how to talk to FCM v1 and the existing push-token tables.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

async function supabaseQuery(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { challengeId } = payload;
    if (!challengeId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing challengeId' }) };
    }

    if (!SUPABASE_SERVICE_KEY) {
        console.error('[cohort-start] SUPABASE_SERVICE_ROLE_KEY not configured');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    // 1. Verify the challenge is a system cohort that just activated.
    let challenge;
    try {
        const rows = await supabaseQuery(
            `challenges?select=id,name,status,is_system_cohort,cohort_type&id=eq.${challengeId}&limit=1`
        );
        challenge = rows[0];
    } catch (err) {
        console.error('[cohort-start] challenge lookup failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
    }

    if (!challenge || !challenge.is_system_cohort) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Not a system cohort' }) };
    }
    if (challenge.status !== 'active') {
        // Caller raced ahead of activation — nothing to push yet.
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'not_active', status: challenge.status }) };
    }

    // 2. Load participants.
    let participants;
    try {
        participants = await supabaseQuery(
            `challenge_participants?select=user_id&challenge_id=eq.${challengeId}&status=eq.accepted`
        );
    } catch (err) {
        console.error('[cohort-start] participant lookup failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Participant lookup failed' }) };
    }

    if (!participants || participants.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'no_participants' }) };
    }

    // 3. Fan out to send-dm-notification for each participant.
    const COHORT_LABELS = {
        plant_based_30: { name: '30-Day Plant-Based Challenge', sender: '🌱 Plant-Based Balance' },
        transform_30:   { name: '30-Day Transformation Challenge', sender: '🔥 Balance Coach' },
    };
    const cohortLabel = COHORT_LABELS[challenge.cohort_type] || COHORT_LABELS.plant_based_30;
    const challengeName = challenge.name || cohortLabel.name;
    const senderName = cohortLabel.sender;
    const pushBody = `Your ${challengeName} has begun. Tap to see the leaderboard.`;

    const results = await Promise.allSettled(
        participants.map(p =>
            fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: p.user_id,
                    senderId: 'cohort_system',
                    senderName,
                    messageText: pushBody,
                    type: 'cohort_started',
                    challengeId,
                    challengeName,
                }),
            }).then(r => r.ok ? r.json().catch(() => ({ ok: true })) : Promise.reject(new Error(`HTTP ${r.status}`)))
        )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
        console.warn(`[cohort-start] ${failed}/${participants.length} push deliveries failed for challenge ${challengeId}`);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            challengeId,
            participantCount: participants.length,
            pushesSent: succeeded,
            pushesFailed: failed,
        }),
    };
};
