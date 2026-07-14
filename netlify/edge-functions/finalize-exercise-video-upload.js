/** Finalise a direct or native-background exercise video upload for its owner. */
const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';

function getEnv(name) {
    try { if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name); } catch (_) {}
    try { if (globalThis.Deno?.env?.get) return Deno.env.get(name); } catch (_) {}
    return '';
}

function json(status, body) {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function cleanId(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 90);
}

async function authenticate(request) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const url = (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const key = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY') || getEnv('SUPABASE_ANON_KEY');
    if (!token || !key) return null;
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
    return response.ok ? response.json() : null;
}

export default async request => {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    try {
        const authUser = await authenticate(request);
        const body = await request.json().catch(() => ({}));
        const userId = cleanId(body.userId);
        const exerciseId = cleanId(body.exerciseId);
        const videoUrl = String(body.videoUrl || '').trim();
        const storagePath = String(body.storagePath || '').trim();
        if (!authUser?.id) return json(401, { error: 'Please log in before finishing the upload.' });
        if (!userId || userId !== cleanId(authUser.id) || !exerciseId || !videoUrl || !storagePath) {
            return json(400, { error: 'Invalid exercise video upload details.' });
        }
        const url = (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
        const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');
        if (!serviceKey) return json(500, { error: 'Server configuration error.' });
        const response = await fetch(`${url}/rest/v1/custom_exercises?id=eq.${encodeURIComponent(exerciseId)}&user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: {
                apikey: serviceKey,
                authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
            },
            body: JSON.stringify({ video_url: videoUrl, storage_path: storagePath, is_public: false })
        });
        if (!response.ok) return json(response.status, { error: await response.text() || 'Could not save the uploaded video.' });
        const rows = await response.json().catch(() => []);
        if (!Array.isArray(rows) || !rows.length) return json(404, { error: 'Exercise was not found.' });
        return json(200, { success: true, exercise: rows[0] });
    } catch (error) {
        console.error('finalize-exercise-video-upload failed', error);
        return json(500, { error: error?.message || 'Internal server error.' });
    }
};

export const config = { path: '/api/finalize-exercise-video-upload' };
