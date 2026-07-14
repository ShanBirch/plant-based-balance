/**
 * Upload custom exercise videos to Backblaze B2.
 * Keeps exercise-library media in the shared B2 exercise section instead of Feed.
 */

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
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

function sanitizePathPart(value, fallback) {
    return String(value || fallback || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 120) || fallback;
}

function getVideoExtension(file) {
    const rawExt = file?.name && file.name.includes('.')
        ? file.name.split('.').pop()
        : '';
    const cleanExt = String(rawExt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['mp4', 'mov', 'm4v', 'webm', '3gp', '3gpp'].includes(cleanExt)) return cleanExt;

    const type = String(file?.type || '').toLowerCase();
    if (type.includes('webm')) return 'webm';
    if (type.includes('quicktime')) return 'mov';
    if (type.includes('x-m4v')) return 'm4v';
    if (type.includes('3gpp')) return '3gp';
    return 'mp4';
}

function isSupportedVideoFile(file) {
    if (!file) return false;
    const type = String(file.type || '').toLowerCase();
    if (type.startsWith('video/')) return true;
    return /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i.test(String(file.name || ''));
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

        const formData = await request.formData();
        const file = formData.get('file');
        const requestedUserId = sanitizePathPart(formData.get('userId'), '');
        const userId = sanitizePathPart(authUser.id, '');
        const exerciseId = sanitizePathPart(formData.get('exerciseId'), Date.now());

        if (!file || !userId || !exerciseId) {
            return jsonResponse(400, { error: 'Missing required fields: file, userId, exerciseId' });
        }
        if (requestedUserId !== userId) {
            return jsonResponse(403, { error: 'Upload user mismatch.' });
        }
        if (!isSupportedVideoFile(file)) {
            return jsonResponse(400, { error: 'Please choose a video clip.' });
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
            return jsonResponse(500, { error: 'Failed to authorize with storage service' });
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
            console.error('Failed to get B2 upload URL:', errorText);
            return jsonResponse(500, { error: 'Failed to get upload URL' });
        }

        const uploadUrlData = await uploadUrlResponse.json();
        const fileBuffer = await file.arrayBuffer();
        const fileName = `exercises/${userId}/${exerciseId}.${getVideoExtension(file)}`;

        const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: uploadUrlData.authorizationToken,
                'X-Bz-File-Name': encodeURIComponent(fileName),
                'Content-Type': file.type || 'video/mp4',
                'Content-Length': fileBuffer.byteLength.toString(),
                'X-Bz-Content-Sha1': 'do_not_verify',
                'X-Bz-Info-Author': `user-${userId}`,
                'X-Bz-Info-upload-type': 'custom-exercise-video',
                'X-Bz-Info-exercise-id': exerciseId
            },
            body: fileBuffer
        });
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload to B2 failed:', errorText);
            return jsonResponse(500, { error: 'Failed to upload exercise video' });
        }

        const uploadData = await uploadResponse.json();
        const publicUrl = `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        return jsonResponse(200, {
            success: true,
            publicUrl,
            url: publicUrl,
            storagePath: fileName,
            fileName,
            fileId: uploadData.fileId || '',
            contentType: file.type || 'video/mp4',
            size: fileBuffer.byteLength
        });
    } catch (error) {
        console.error('Error in upload-exercise-video:', error);
        return jsonResponse(500, { error: error?.message || 'Internal server error' });
    }
};

export const config = {
    path: '/api/upload-exercise-video'
};
