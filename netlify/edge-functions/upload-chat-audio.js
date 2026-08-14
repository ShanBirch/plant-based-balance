/**
 * Authenticated voice-message upload for Balance DMs.
 * Audio is stored in Backblaze B2 and referenced from the existing nudges
 * message contract as [AUDIO:https://...].
 */

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/mpeg',
    'audio/aac',
    'audio/x-m4a'
]);

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

function sanitizeId(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 90);
}

function audioExtension(contentType) {
    const type = String(contentType || '').toLowerCase();
    if (type === 'audio/mp4' || type === 'audio/x-m4a') return 'm4a';
    if (type === 'audio/ogg') return 'ogg';
    if (type === 'audio/mpeg') return 'mp3';
    if (type === 'audio/aac') return 'aac';
    return 'webm';
}

async function authenticateUser(request) {
    const token = String(request.headers.get('authorization') || '')
        .replace(/^Bearer\s+/i, '')
        .trim();
    if (!token) return null;

    const supabaseUrl = (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
        || getEnv('SUPABASE_SERVICE_KEY')
        || getEnv('SUPABASE_ANON_KEY');
    if (!supabaseKey) return null;

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: supabaseKey,
            authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) return null;
    return await response.json();
}

export default async (request) => {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const authUser = await authenticateUser(request);
        const userId = sanitizeId(authUser?.id);
        if (!userId) return jsonResponse(401, { error: 'Please log in before uploading.' });

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || typeof file.arrayBuffer !== 'function') {
            return jsonResponse(400, { error: 'Choose a voice recording to upload.' });
        }

        const contentType = String(file.type || '').split(';')[0].toLowerCase();
        if (!ALLOWED_AUDIO_TYPES.has(contentType)) {
            return jsonResponse(415, { error: 'That audio format is not supported.' });
        }
        if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
            return jsonResponse(413, { error: 'Keep voice messages under 12 MB.' });
        }

        const B2_KEY_ID = getEnv('B2_KEY_ID');
        const B2_APPLICATION_KEY = getEnv('B2_APPLICATION_KEY');
        const B2_BUCKET_ID = getEnv('B2_BUCKET_ID');
        const B2_BUCKET_NAME = getEnv('B2_BUCKET_NAME');
        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error('[upload-chat-audio] Missing B2 configuration');
            return jsonResponse(500, { error: 'Audio storage is not configured.' });
        }

        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: { Authorization: `Basic ${btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)}` }
        });
        if (!authResponse.ok) {
            console.error('[upload-chat-audio] B2 authorization failed:', await authResponse.text());
            return jsonResponse(502, { error: 'Could not connect to audio storage.' });
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
            console.error('[upload-chat-audio] B2 upload URL failed:', await uploadUrlResponse.text());
            return jsonResponse(502, { error: 'Could not prepare audio storage.' });
        }
        const uploadTarget = await uploadUrlResponse.json();

        const fileBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-1', fileBuffer);
        const sha1Hash = Array.from(new Uint8Array(hashBuffer))
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
        const fileName = `chats/${userId}/voice/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${audioExtension(contentType)}`;

        const uploadResponse = await fetch(uploadTarget.uploadUrl, {
            method: 'POST',
            headers: {
                Authorization: uploadTarget.authorizationToken,
                'X-Bz-File-Name': encodeURIComponent(fileName),
                'Content-Type': contentType,
                'Content-Length': String(fileBuffer.byteLength),
                'X-Bz-Content-Sha1': sha1Hash,
                'X-Bz-Info-Author': `user-${userId}`,
                'X-Bz-Info-upload-type': 'chat-audio'
            },
            body: fileBuffer
        });
        if (!uploadResponse.ok) {
            console.error('[upload-chat-audio] B2 upload failed:', await uploadResponse.text());
            return jsonResponse(502, { error: 'Could not upload the voice message.' });
        }

        const uploadData = await uploadResponse.json();
        const publicUrl = `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;
        return jsonResponse(200, {
            success: true,
            url: publicUrl,
            fileName,
            fileId: uploadData.fileId,
            contentType,
            size: fileBuffer.byteLength
        });
    } catch (error) {
        console.error('[upload-chat-audio] Unexpected error:', error);
        return jsonResponse(500, { error: 'Could not send the voice message.' });
    }
};

export const config = {
    path: '/api/upload-chat-audio'
};
