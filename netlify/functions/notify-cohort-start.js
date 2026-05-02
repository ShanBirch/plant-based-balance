/**
 * notify-cohort-start
 *
 * Two modes, controlled by the `event` field on the POST body:
 *
 *   event: 'cohort_filled'   → sent when a cohort first hits 6 participants.
 *                              Pushes to all 6 (status='pending_acceptance')
 *                              asking them to confirm their spot within 24h.
 *
 *   event: 'cohort_activated' (default for backwards compat — also fires when
 *                              the omitted/legacy `just_started` path is used)
 *                              → sent when all 6 have accepted and the 30-day
 *                              clock has actually started. Pushes the
 *                              "challenge has begun" notification to the 6
 *                              accepted participants.
 *
 * POST body: { challengeId: UUID, event?: 'cohort_filled' | 'cohort_activated' }
 *
 * Called from dashboard JS (`tryAutoEnrollInCohort`) when a cohort fills, and
 * from the dashboard `acceptCohortInvitation` flow when the 6th accept lands.
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
    const mode = payload.event === 'cohort_filled' ? 'cohort_filled' : 'cohort_activated';
    if (!challengeId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing challengeId' }) };
    }

    if (!SUPABASE_SERVICE_KEY) {
        console.error('[cohort-start] SUPABASE_SERVICE_ROLE_KEY not configured');
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

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

    // Mode-specific recipient + payload selection.
    let participantStatusFilter;
    let pushBodyFor;
    let pushType;
    if (mode === 'cohort_filled') {
        // Cohort just hit 6. We want everyone in the acceptance window.
        if (challenge.status !== 'pending') {
            return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'not_pending', status: challenge.status }) };
        }
        participantStatusFilter = 'pending_acceptance';
        pushType = 'cohort_acceptance_request';
    } else {
        // Cohort fully accepted. Skip if it hasn't actually activated yet.
        if (challenge.status !== 'active') {
            return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'not_active', status: challenge.status }) };
        }
        participantStatusFilter = 'accepted';
        pushType = 'cohort_started';
    }

    let participants;
    try {
        participants = await supabaseQuery(
            `challenge_participants?select=user_id&challenge_id=eq.${challengeId}&status=eq.${participantStatusFilter}`
        );
    } catch (err) {
        console.error('[cohort-start] participant lookup failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Participant lookup failed' }) };
    }

    if (!participants || participants.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'no_participants' }) };
    }

    const COHORT_LABELS = {
        plant_based_30: { name: '30 Day Challenge', sender: 'Balance' },
        transform_30:   { name: '30-Day Transformation Challenge', sender: '🔥 Balance Coach' },
    };
    const cohortLabel = COHORT_LABELS[challenge.cohort_type] || COHORT_LABELS.plant_based_30;
    const challengeName = challenge.name || cohortLabel.name;
    const senderName = cohortLabel.sender;

    if (mode === 'cohort_filled') {
        pushBodyFor = `Your ${challengeName} cohort just filled up! Tap to accept your spot — you have 24 hours before it goes to the next person.`;
    } else {
        pushBodyFor = `Your ${challengeName} has begun. Tap to see the leaderboard.`;
    }

    const results = await Promise.allSettled(
        participants.map(p =>
            fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: p.user_id,
                    senderId: 'cohort_system',
                    senderName,
                    messageText: pushBodyFor,
                    type: pushType,
                    challengeId,
                    challengeName,
                }),
            }).then(r => r.ok ? r.json().catch(() => ({ ok: true })) : Promise.reject(new Error(`HTTP ${r.status}`)))
        )
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
        console.warn(`[cohort-start] mode=${mode} ${failed}/${participants.length} push deliveries failed for challenge ${challengeId}`);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            mode,
            challengeId,
            participantCount: participants.length,
            pushesSent: succeeded,
            pushesFailed: failed,
        }),
    };
};
