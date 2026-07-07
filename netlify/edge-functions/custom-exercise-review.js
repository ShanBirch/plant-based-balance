const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

function corsEmptyResponse(status = 204) {
    return new Response(null, {
        status,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

function getEnv(name) {
    try {
        if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name);
    } catch (_) {}
    try {
        if (globalThis.Deno?.env?.get) return Deno.env.get(name);
    } catch (_) {}
    return '';
}

function getSupabaseConfig() {
    return {
        url: (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, ''),
        serviceKey: getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY')
    };
}

function cleanText(value, max = 500) {
    return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function supabaseRequest(path, options = {}) {
    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) throw new Error('Missing Supabase service configuration');

    const res = await fetch(`${url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${text}`);
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch (_) { return []; }
}

async function authenticateUser(request) {
    const token = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const { url, serviceKey } = getSupabaseConfig();
    if (!url || !serviceKey) return null;

    const res = await fetch(`${url}/auth/v1/user`, {
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${token}`
        }
    });
    if (!res.ok) return null;
    return res.json();
}

async function isAdminUser(userId) {
    if (!isUuid(userId)) return false;
    const rows = await supabaseRequest(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    return Array.isArray(rows) && rows.length > 0;
}

async function getExerciseForUser(exerciseId, userId) {
    const rows = await supabaseRequest(
        `custom_exercises?select=id,user_id,exercise_name,description,muscle_group,equipment,video_url,storage_path,is_public,created_at&` +
        `id=eq.${encodeURIComponent(exerciseId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    return Array.isArray(rows) ? rows[0] : null;
}

async function getUserProfile(userId) {
    const rows = await supabaseRequest(`users?select=id,name,email,profile_photo&id=eq.${encodeURIComponent(userId)}&limit=1`);
    return Array.isArray(rows) ? rows[0] : null;
}

async function getReviewCoachId(userId) {
    const coachRows = await supabaseRequest(
        `coach_clients?select=coach_id&client_id=eq.${encodeURIComponent(userId)}&status=eq.active&limit=1`
    ).catch(() => []);
    const coachId = Array.isArray(coachRows) && coachRows[0]?.coach_id ? coachRows[0].coach_id : '';
    if (coachId) return coachId;

    const adminRows = await supabaseRequest('admin_users?select=user_id,role&role=in.(super_admin,admin)&limit=1').catch(() => []);
    return Array.isArray(adminRows) && adminRows[0]?.user_id ? adminRows[0].user_id : null;
}

function buildExerciseCaption(exercise = {}) {
    const reviewData = exercise.review_data || {};
    const name = cleanText(exercise.exercise_name || 'new exercise', 120) || 'new exercise';
    const lines = [`New exercise added - ${name}`];
    const description = cleanText(exercise.description || '', 500);
    if (description) lines.push('', description);

    const family = cleanText(reviewData.technique_family || '', 120);
    const force = cleanText(reviewData.technique_force || '', 160);
    const tips = Array.isArray(reviewData.technique_tips)
        ? reviewData.technique_tips.map(tip => cleanText(tip, 220)).filter(Boolean).slice(0, 2)
        : [];

    if (family || force || tips.length) {
        const techniqueLine = [family, force].filter(Boolean).join('. ');
        if (techniqueLine) lines.push('', `Technique: ${techniqueLine}`);
        if (tips.length) {
            lines.push('', 'Tips:');
            tips.forEach(tip => lines.push(`- ${tip}`));
        }
    }

    return lines.join('\n');
}

async function createFeedPostForExercise(exercise, reviewData = {}) {
    const videoUrl = cleanText(exercise.video_url || '', 1000);
    if (!isUuid(exercise.user_id) || !isUuid(exercise.id) || !videoUrl) return null;

    const existing = await supabaseRequest(
        `stories?select=id&user_id=eq.${encodeURIComponent(exercise.user_id)}&media_type=eq.video&media_url=eq.${encodeURIComponent(videoUrl)}&limit=1`
    ).catch(() => []);
    if (Array.isArray(existing) && existing[0]) return existing[0];

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseRequest('stories?select=id,user_id,media_type,media_url,caption,created_at', {
        method: 'POST',
        body: [{
            user_id: exercise.user_id,
            media_type: 'video',
            media_url: videoUrl,
            thumbnail_url: null,
            caption: buildExerciseCaption({ ...exercise, review_data: reviewData }),
            duration: 10,
            expires_at: expiresAt,
            background_color: '#0f172a'
        }]
    });
    return Array.isArray(rows) ? rows[0] : null;
}

function getTechniqueReviewData(body = {}) {
    const technique = body.technique && typeof body.technique === 'object' ? body.technique : {};
    const tips = Array.isArray(technique.tips)
        ? technique.tips.map(tip => cleanText(tip, 220)).filter(Boolean).slice(0, 2)
        : [];
    return {
        technique_family: cleanText(technique.family || '', 120),
        technique_force: cleanText(technique.force || '', 160),
        technique_tips: tips
    };
}

async function awardExerciseContributionXp(request, exercise) {
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/award-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: exercise.user_id,
            type: 'exercise_contribution',
            referenceId: exercise.id,
            clientDate: new Date().toISOString().split('T')[0]
        })
    });
    return res.json().catch(() => ({ success: false, pointsAwarded: 0, error: `HTTP ${res.status}` }));
}

async function findPendingAlert(exerciseId) {
    const rows = await supabaseRequest(
        `coach_alerts?select=id,data,status&alert_type=eq.custom_exercise_review&status=eq.pending&data->>exercise_id=eq.${encodeURIComponent(exerciseId)}&limit=1`
    ).catch(() => []);
    return Array.isArray(rows) ? rows[0] : null;
}

async function submitReview(request, authUser, body) {
    const exerciseId = cleanText(body.exerciseId || body.exercise_id || '', 80);
    if (!isUuid(exerciseId)) return jsonResponse(400, { error: 'Missing exerciseId' });

    const exercise = await getExerciseForUser(exerciseId, authUser.id);
    if (!exercise) return jsonResponse(404, { error: 'Exercise not found' });
    if (!cleanText(exercise.video_url || '', 1000)) {
        return jsonResponse(400, { error: 'Exercise video is not uploaded yet' });
    }

    const callerIsAdmin = await isAdminUser(authUser.id);
    if (callerIsAdmin) {
        const approved = await approveExercise(request, authUser, { ...body, exerciseId, directAdminSubmit: true });
        return approved;
    }

    const profile = await getUserProfile(authUser.id);
    const coachId = await getReviewCoachId(authUser.id);
    if (!coachId) return jsonResponse(500, { error: 'Could not route exercise review' });

    const existing = await findPendingAlert(exerciseId);
    const now = new Date().toISOString();
    const alertData = {
        ...(existing?.data || {}),
        exercise_id: exercise.id,
        exercise_name: exercise.exercise_name,
        exercise_description: exercise.description || '',
        muscle_group: exercise.muscle_group || '',
        equipment: exercise.equipment || '',
        video_url: exercise.video_url,
        storage_path: exercise.storage_path || '',
        submitted_by: authUser.id,
        submitted_by_name: profile?.name || profile?.email || 'Client',
        review_status: 'pending',
        submitted_at: existing?.data?.submitted_at || now,
        ...getTechniqueReviewData(body)
    };

    const payload = {
        coach_id: coachId,
        client_id: authUser.id,
        client_name: profile?.name || profile?.email || 'Client',
        alert_type: 'custom_exercise_review',
        priority: 'medium',
        title: `Review exercise: ${cleanText(exercise.exercise_name, 120) || 'Custom exercise'}`,
        description: `${profile?.name || profile?.email || 'A client'} uploaded a new exercise video. Approve it to share it and award 15 XP, or delete it.`,
        suggested_message: null,
        status: 'pending',
        data: alertData
    };

    let alertRow;
    if (existing?.id) {
        const rows = await supabaseRequest(`coach_alerts?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            body: payload
        });
        alertRow = Array.isArray(rows) ? rows[0] : existing;
    } else {
        const rows = await supabaseRequest('coach_alerts?select=id', {
            method: 'POST',
            body: [payload]
        });
        alertRow = Array.isArray(rows) ? rows[0] : null;
    }

    return jsonResponse(200, {
        success: true,
        status: 'pending_review',
        alertId: alertRow?.id || existing?.id || null
    });
}

async function approveExercise(request, authUser, body) {
    const exerciseId = cleanText(body.exerciseId || body.exercise_id || '', 80);
    if (!isUuid(exerciseId)) return jsonResponse(400, { error: 'Missing exerciseId' });

    const callerIsAdmin = await isAdminUser(authUser.id);
    if (!callerIsAdmin) return jsonResponse(403, { error: 'Admin access required' });

    const rows = await supabaseRequest(
        `custom_exercises?select=id,user_id,exercise_name,description,muscle_group,equipment,video_url,storage_path,is_public,created_at&id=eq.${encodeURIComponent(exerciseId)}&limit=1`
    );
    const exercise = Array.isArray(rows) ? rows[0] : null;
    if (!exercise) return jsonResponse(404, { error: 'Exercise not found' });
    if (!cleanText(exercise.video_url || '', 1000)) return jsonResponse(400, { error: 'Exercise has no video URL' });

    const existingAlert = await findPendingAlert(exerciseId);
    const updatedRows = await supabaseRequest(`custom_exercises?id=eq.${encodeURIComponent(exerciseId)}`, {
        method: 'PATCH',
        body: { is_public: true, updated_at: new Date().toISOString() }
    });
    const updatedExercise = Array.isArray(updatedRows) && updatedRows[0] ? { ...exercise, ...updatedRows[0] } : { ...exercise, is_public: true };
    const reviewData = existingAlert?.data || getTechniqueReviewData(body);
    const story = await createFeedPostForExercise(updatedExercise, reviewData);
    const xp = await awardExerciseContributionXp(request, updatedExercise);
    const actionedAt = new Date().toISOString();
    if (existingAlert?.id) {
        await supabaseRequest(`coach_alerts?id=eq.${encodeURIComponent(existingAlert.id)}`, {
            method: 'PATCH',
            body: {
                status: 'sent',
                actioned_at: actionedAt,
                data: {
                    ...(existingAlert.data || {}),
                    review_status: 'approved',
                    approved_by: authUser.id,
                    approved_at: actionedAt,
                    story_id: story?.id || null,
                    points_result: xp || null
                }
            }
        });
    }

    return jsonResponse(200, {
        success: true,
        status: 'approved',
        exercise: updatedExercise,
        story,
        pointsAwarded: Number(xp?.pointsAwarded || 0),
        alreadyAwarded: !!xp?.alreadyAwarded
    });
}

async function deleteExercise(authUser, body) {
    const exerciseId = cleanText(body.exerciseId || body.exercise_id || '', 80);
    if (!isUuid(exerciseId)) return jsonResponse(400, { error: 'Missing exerciseId' });

    const callerIsAdmin = await isAdminUser(authUser.id);
    if (!callerIsAdmin) return jsonResponse(403, { error: 'Admin access required' });

    await supabaseRequest(`custom_exercises?id=eq.${encodeURIComponent(exerciseId)}`, {
        method: 'DELETE',
        prefer: 'return=minimal'
    });

    const actionedAt = new Date().toISOString();
    const existingAlert = await findPendingAlert(exerciseId);
    if (existingAlert?.id) {
        await supabaseRequest(`coach_alerts?id=eq.${encodeURIComponent(existingAlert.id)}`, {
            method: 'PATCH',
            body: {
                status: 'dismissed',
                actioned_at: actionedAt,
                data: {
                    ...(existingAlert.data || {}),
                    review_status: 'deleted',
                    deleted_by: authUser.id,
                    deleted_at: actionedAt
                }
            }
        });
    }

    return jsonResponse(200, { success: true, status: 'deleted' });
}

export default async (request) => {
    if (request.method === 'OPTIONS') return corsEmptyResponse(204);
    if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

    try {
        const authUser = await authenticateUser(request);
        if (!authUser?.id) return jsonResponse(401, { error: 'Please log in.' });

        const body = await request.json().catch(() => ({}));
        const action = cleanText(body.action || 'submit', 40);
        if (action === 'submit') return submitReview(request, authUser, body);
        if (action === 'approve') return approveExercise(request, authUser, body);
        if (action === 'delete') return deleteExercise(authUser, body);
        return jsonResponse(400, { error: 'Unknown action' });
    } catch (error) {
        console.error('custom-exercise-review failed:', error);
        return jsonResponse(500, { error: error?.message || 'Internal server error' });
    }
};

export const config = {
    path: '/api/custom-exercise-review'
};
