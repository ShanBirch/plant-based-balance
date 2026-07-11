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
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const SITE_URL = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://plantbased-balance.org').replace(/\/+$/, '');

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

async function queueFormCheckDraft(alertId) {
    if (!alertId) return false;
    try {
        const response = await fetch(`${SITE_URL}/.netlify/functions/form-check-draft-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId }),
        });
        return response.ok;
    } catch (err) {
        console.warn('[submit-form-check] self-test draft queue failed:', err.message);
        return false;
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
    if (!/^https:\/\//i.test(videoUrl)) return json(400, { error: 'Missing or invalid videoUrl' });

    const adminRows = await supabaseQuery(
        `users?select=email,name&id=eq.${encodeURIComponent(coachId)}&limit=1`
    );
    const coachEmail = String(adminRows[0]?.email || '').trim().toLowerCase();
    if (coachEmail !== BALANCE_ADMIN_EMAIL) return json(400, { error: 'Receiver is not a coach admin' });
    const isSelfTest = coachId === verified.userId;

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
    const messageText = messageLines.join('\n');

    // Form checks always need an immediate Needs You card. Do this here instead
    // of relying on the nudge-to-alert trigger, which does not fire reliably
    // for the specialised form_check nudge type.
    {
        const idempotencyKey = uuidRequestId ? `form_check:${uuidRequestId}` : '';
        if (idempotencyKey) {
            const existing = await supabaseQuery(
                `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
            ).catch(() => []);
            if (existing.length) {
                return json(200, {
                    success: true,
                    alertId: existing[0].id,
                    deduped: true,
                    selfTest: true,
                });
            }
        }

        const clientRows = await supabaseQuery(
            `users?select=name&id=eq.${encodeURIComponent(verified.userId)}&limit=1`
        ).catch(() => []);
        const clientName = cleanLine(clientRows[0]?.name, 'Balance member', 120);
        const alertRow = {
            client_id: verified.userId,
            client_name: clientName,
            coach_id: coachId,
            alert_type: 'incoming_dm',
            priority: 'high',
            title: `${clientName} sent a form check`,
            description: 'Technique video waiting for Shannon review',
            suggested_message: null,
            status: 'pending',
            data: {
                subtype: isSelfTest ? 'form_check_self_test' : 'form_check',
                self_test: isSelfTest,
                operator_queue: 'needs_you',
                needs_you_required: true,
                needs_you_reason: 'form_check_self_test',
                is_form_check: true,
                message_preview: messageText,
                draft_model: 'queued-form-check-draft',
                drafted_at: new Date().toISOString(),
                form_check_request_id: uuidRequestId || requestId || null,
                form_check_video_url: videoUrl,
                form_check_exercise_name: exerciseName,
                form_check_workout_name: workoutName,
            },
        };
        if (idempotencyKey) alertRow.idempotency_key = idempotencyKey;

        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
        });
        const alertId = inserted[0]?.id || null;
        const draftQueued = await queueFormCheckDraft(alertId);

        return json(200, {
            success: true,
            alertId,
            deduped: false,
            selfTest: isSelfTest,
            formCheckDraftQueued: draftQueued,
        });
    }

    const row = {
        sender_id: verified.userId,
        receiver_id: coachId,
        message: messageText,
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
        selfTest: isSelfTest,
    });
};
