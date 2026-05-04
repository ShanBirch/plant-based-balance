/**
 * Upload form-check videos to Backblaze B2.
 * Keeps larger coaching clips out of Supabase Storage bucket/RLS limits.
 */

const MAX_FORM_CHECK_VIDEO_BYTES = 180 * 1024 * 1024;

function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function getEnv(name) {
    return globalThis.Netlify && globalThis.Netlify.env
        ? globalThis.Netlify.env.get(name)
        : '';
}

function sanitizePathPart(value, fallback) {
    return String(value || fallback || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 120) || fallback;
}

function getVideoExtension(file) {
    const rawExt = file.name && file.name.includes('.')
        ? file.name.split('.').pop()
        : '';
    const cleanExt = String(rawExt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanExt) return cleanExt;

    if (file.type === 'video/webm') return 'webm';
    if (file.type === 'video/quicktime') return 'mov';
    if (file.type === 'video/x-m4v') return 'm4v';
    return 'mp4';
}

export default async (request) => {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');
        const requestId = formData.get('requestId');

        if (!file || !userId || !requestId) {
            return jsonResponse({ error: 'Missing required fields: file, userId, requestId' }, 400);
        }

        if (!file.type || !file.type.startsWith('video/')) {
            return jsonResponse({ error: 'Please choose a video clip.' }, 400);
        }

        if (file.size > MAX_FORM_CHECK_VIDEO_BYTES) {
            return jsonResponse({ error: 'That video is too large. Keep form checks under 180 MB.' }, 400);
        }

        const B2_KEY_ID = getEnv('B2_KEY_ID');
        const B2_APPLICATION_KEY = getEnv('B2_APPLICATION_KEY');
        const B2_BUCKET_ID = getEnv('B2_BUCKET_ID');
        const B2_BUCKET_NAME = getEnv('B2_BUCKET_NAME');

        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error('Missing B2 configuration');
            return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
            }
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('B2 authorization failed:', errorText);
            return jsonResponse({ error: 'Failed to authorize with storage service' }, 500);
        }

        const authData = await authResponse.json();
        const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
                'Authorization': authData.authorizationToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });

        if (!uploadUrlResponse.ok) {
            const errorText = await uploadUrlResponse.text();
            console.error('Failed to get B2 upload URL:', errorText);
            return jsonResponse({ error: 'Failed to get upload URL' }, 500);
        }

        const uploadUrlData = await uploadUrlResponse.json();
        const fileBuffer = await file.arrayBuffer();
        const safeUserId = sanitizePathPart(userId, 'user');
        const safeRequestId = sanitizePathPart(requestId, Date.now());
        const fileName = `form-checks/${safeUserId}/${safeRequestId}.${getVideoExtension(file)}`;

        const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadUrlData.authorizationToken,
                'X-Bz-File-Name': encodeURIComponent(fileName),
                'Content-Type': file.type || 'video/mp4',
                'Content-Length': fileBuffer.byteLength.toString(),
                'X-Bz-Content-Sha1': 'do_not_verify',
                'X-Bz-Info-Author': `user-${safeUserId}`,
                'X-Bz-Info-upload-type': 'form-check-video',
                'X-Bz-Info-request-id': safeRequestId
            },
            body: fileBuffer
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload to B2 failed:', errorText);
            return jsonResponse({ error: 'Failed to upload video' }, 500);
        }

        const uploadData = await uploadResponse.json();
        const publicUrl = `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        return jsonResponse({
            success: true,
            url: publicUrl,
            fileName,
            fileId: uploadData.fileId,
            contentType: file.type,
            size: fileBuffer.byteLength
        }, 200);
    } catch (error) {
        console.error('Error in upload-form-check-video:', error);
        return jsonResponse({ error: error.message || 'Internal server error' }, 500);
    }
};

export const config = {
    path: '/api/upload-form-check-video'
};
