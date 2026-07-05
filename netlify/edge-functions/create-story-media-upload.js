/**
 * Mint a short-lived Backblaze B2 upload URL for direct browser media uploads.
 * The browser uploads the large file to B2, not through Netlify's request body.
 */

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const MAX_DIRECT_UPLOAD_BYTES = 200 * 1024 * 1024;

function getEnv(name) {
    try {
        if (globalThis.Netlify?.env?.get) return globalThis.Netlify.env.get(name);
    } catch (_) {}
    try {
        if (globalThis.Deno?.env?.get) return Deno.env.get(name);
    } catch (_) {}
    return '';
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function sanitizeId(value, fallback) {
    const clean = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 90);
    return clean || fallback;
}

function contentExtension(contentType, fallbackName) {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('quicktime')) return 'mov';
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('webm')) return 'webm';
    if (type.includes('3gpp')) return '3gp';
    if (type.includes('jpeg')) return 'jpg';
    if (type.includes('png')) return 'png';
    if (type.includes('gif')) return 'gif';
    const rawExt = String(fallbackName || '').split('.').pop() || '';
    const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    return cleanExt || 'bin';
}

async function authenticateUser(request) {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    const supabaseUrl = (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
        || getEnv('SUPABASE_SERVICE_KEY')
        || getEnv('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseKey) return null;

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: supabaseKey,
            authorization: `Bearer ${token}`
        }
    });
    if (!res.ok) return null;
    return await res.json();
}

export default async (request) => {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const authUser = await authenticateUser(request);
        if (!authUser?.id) {
            return jsonResponse(401, { error: 'Please log in before uploading.' });
        }

        const body = await request.json().catch(() => ({}));
        const requestedUserId = sanitizeId(body.userId, '');
        const userId = sanitizeId(authUser.id, '');
        if (!userId || requestedUserId !== userId) {
            return jsonResponse(403, { error: 'Upload user mismatch.' });
        }

        const storyId = sanitizeId(body.storyId, crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        const source = String(body.source || 'feed').trim().toLowerCase();
        const contentType = String(body.contentType || 'application/octet-stream').trim() || 'application/octet-stream';
        const size = Number(body.size || 0);
        if (!Number.isFinite(size) || size <= 0 || size > MAX_DIRECT_UPLOAD_BYTES) {
            return jsonResponse(400, { error: 'That video is too large. Trim it to just the set and try again.' });
        }
        if (!/^feed/.test(source)) {
            return jsonResponse(400, { error: 'Invalid upload source.' });
        }

        const B2_KEY_ID = getEnv('B2_KEY_ID');
        const B2_APPLICATION_KEY = getEnv('B2_APPLICATION_KEY');
        const B2_BUCKET_ID = getEnv('B2_BUCKET_ID');
        const B2_BUCKET_NAME = getEnv('B2_BUCKET_NAME');
        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error('Missing B2 configuration');
            return jsonResponse(500, { error: 'Server configuration error' });
        }

        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            method: 'GET',
            headers: {
                Authorization: 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
            }
        });
        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('B2 authorization failed:', errorText);
            return jsonResponse(500, { error: 'Failed to authorize upload.' });
        }
        const authData = await authResponse.json();

        const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
                Authorization: authData.authorizationToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });
        if (!uploadUrlResponse.ok) {
            const errorText = await uploadUrlResponse.text();
            console.error('B2 upload URL failed:', errorText);
            return jsonResponse(500, { error: 'Failed to start upload.' });
        }

        const uploadData = await uploadUrlResponse.json();
        const extension = contentExtension(contentType, body.fileName);
        const fileName = `stories/${userId}/${storyId}.${extension}`;
        const publicUrl = `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        return jsonResponse(200, {
            success: true,
            uploadUrl: uploadData.uploadUrl,
            authorizationToken: uploadData.authorizationToken,
            fileName,
            publicUrl,
            contentType,
            size
        });
    } catch (error) {
        console.error('Error in create-story-media-upload:', error);
        return jsonResponse(500, { error: error?.message || 'Internal server error' });
    }
};

export const config = {
    path: '/api/create-story-media-upload'
};
