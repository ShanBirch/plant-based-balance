/**
 * Authenticated form-check DM submit.
 *
 * The video upload itself happens in the B2 edge function. This function then
 * writes the normal in-app DM with the video marker using the service role, so
 * a successful upload is not stranded outside Shannon's admin inbox by client
 * RLS/session edge cases.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    };
}

function cleanLine(value, fallback, max = 240) {
    const text = String(value || fallback || '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    return text.slice(0, max) || fallback || '';
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

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const verified = await verifyUserToken(event);
    if (!verified.ok) return json(401, { error: verified.error });

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    const coachId = String(payload.coachId || '').trim();
    const videoUrl = String(payload.videoUrl || '').trim();
    const requestId = String(payload.requestId || '').trim();

    if (!UUID_RE.test(coachId)) return json(400, { error: 'Missing or invalid coachId' });
    if (coachId === verified.userId) return json(400, { error: 'Cannot send form check to yourself' });
    if (!/^https:\/\//i.test(videoUrl)) return json(400, { error: 'Missing or invalid videoUrl' });

    const adminRows = await supabaseQuery(
        `admin_users?select=user_id&user_id=eq.${encodeURIComponent(coachId)}&limit=1`
    );
    if (!adminRows.length) return json(400, { error: 'Receiver is not a coach admin' });

    const exerciseName = cleanLine(payload.exerciseName, 'Exercise', 120);
    const notes = cleanLine(payload.notes, 'Please check my technique.', 400);
    const workoutName = cleanLine(payload.workoutName, '', 160);
    const uuidRequestId = UUID_RE.test(requestId) ? requestId : '';

    if (uuidRequestId) {
        const existing = await supabaseQuery(
            `nudges?select=id&sender_id=eq.${encodeURIComponent(verified.userId)}` +
            `&receiver_id=eq.${encodeURIComponent(coachId)}` +
            `&nudge_type=eq.form_check&reference_id=eq.${encodeURIComponent(uuidRequestId)}&limit=1`
        ).catch(() => []);
        if (existing.length) {
            return json(200, { success: true, nudgeId: existing[0].id, deduped: true });
        }
    }

    const messageLines = [
        'Form check request',
        `Exercise: ${exerciseName}`,
        `Video: [video: ${videoUrl}]`,
    ];
    if (workoutName) messageLines.push(`Workout: ${workoutName}`);
    messageLines.push(`Focus: ${notes}`);

    const row = {
        sender_id: verified.userId,
        receiver_id: coachId,
        message: messageLines.join('\n'),
        nudge_type: 'form_check',
    };
    if (uuidRequestId) row.reference_id = uuidRequestId;

    const inserted = await supabaseQuery('nudges', {
        method: 'POST',
        body: [row],
    });

    return json(200, {
        success: true,
        nudgeId: inserted[0]?.id || null,
        deduped: false,
    });
};
