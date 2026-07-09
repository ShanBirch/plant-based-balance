/**
 * Resumable Backblaze B2 uploads for native iPhone Share a Set videos.
 *
 * Large iOS WKWebView uploads can stall when sent as one request. This endpoint
 * keeps the video bytes off Netlify while coordinating B2's large-file API so
 * the client can upload small, independently retryable parts.
 */

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const MAX_MULTIPART_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MIN_MULTIPART_UPLOAD_BYTES = 5 * 1024 * 1024 + 1;
const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
const UPLOAD_SESSION_TTL_MS = 23 * 60 * 60 * 1000;

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
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}

function sanitizeId(value, fallback) {
    const clean = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 90);
    return clean || fallback;
}

function contentExtension(contentType, fallbackName) {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('quicktime')) return 'mov';
    if (type.includes('x-m4v')) return 'm4v';
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('webm')) return 'webm';
    if (type.includes('3gpp')) return '3gp';
    const rawExt = String(fallbackName || '').split('.').pop() || '';
    const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    return cleanExt || 'mp4';
}

function bytesToBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function getSessionKey(secret, usages) {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        usages
    );
}

async function createUploadSession(payload, secret) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const encodedPayload = bytesToBase64Url(payloadBytes);
    const key = await getSessionKey(secret, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
    return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyUploadSession(value, secret) {
    try {
        const [encodedPayload, encodedSignature] = String(value || '').split('.');
        if (!encodedPayload || !encodedSignature) return null;

        const key = await getSessionKey(secret, ['verify']);
        const verified = await crypto.subtle.verify(
            'HMAC',
            key,
            base64UrlToBytes(encodedSignature),
            new TextEncoder().encode(encodedPayload)
        );
        if (!verified) return null;

        const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload)));
        if (!payload || Number(payload.expiresAt || 0) <= Date.now()) return null;
        return payload;
    } catch (_) {
        return null;
    }
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

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: supabaseKey,
            authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) return null;
    return response.json();
}

async function authorizeB2() {
    const keyId = getEnv('B2_KEY_ID');
    const applicationKey = getEnv('B2_APPLICATION_KEY');
    const bucketId = getEnv('B2_BUCKET_ID');
    const bucketName = getEnv('B2_BUCKET_NAME');
    if (!keyId || !applicationKey || !bucketId || !bucketName) {
        throw new Error('Server configuration error');
    }

    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        method: 'GET',
        headers: {
            Authorization: 'Basic ' + btoa(`${keyId}:${applicationKey}`)
        }
    });
    if (!response.ok) throw new Error('Failed to authorize upload.');
    const data = await response.json();
    return { ...data, applicationKey, bucketId, bucketName };
}

async function b2Json(authData, operation, body) {
    const response = await fetch(`${authData.apiUrl}/b2api/v2/${operation}`, {
        method: 'POST',
        headers: {
            Authorization: authData.authorizationToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
}

async function getPartUploadTarget(authData, fileId) {
    const { response, payload } = await b2Json(authData, 'b2_get_upload_part_url', { fileId });
    if (!response.ok || !payload.uploadUrl || !payload.authorizationToken) {
        throw new Error(payload.message || 'Could not prepare the next upload part.');
    }
    return payload;
}

function isShareASetSource(source) {
    const normalized = String(source || '').trim().toLowerCase();
    return normalized.includes('workout_share') || normalized.includes('share_set');
}

function validPartSha1Array(values, expectedCount) {
    return Array.isArray(values)
        && values.length === expectedCount
        && values.every(value => /^[a-f0-9]{40}$/i.test(String(value || '')));
}

async function handleStart(body, userId, authData) {
    const requestedUserId = sanitizeId(body.userId, '');
    if (!requestedUserId || requestedUserId !== userId) {
        return jsonResponse(403, { error: 'Upload user mismatch.' });
    }

    const source = String(body.source || '').trim().toLowerCase();
    if (!isShareASetSource(source)) {
        return jsonResponse(400, { error: 'Multipart upload is only available for Share a Set.' });
    }

    const size = Number(body.size || 0);
    if (!Number.isFinite(size) || size < MIN_MULTIPART_UPLOAD_BYTES || size > MAX_MULTIPART_UPLOAD_BYTES) {
        return jsonResponse(400, { error: 'That Share a Set clip cannot use multipart upload.' });
    }

    const storyId = sanitizeId(body.storyId, crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const contentType = String(body.contentType || 'video/mp4').trim() || 'video/mp4';
    const extension = contentExtension(contentType, body.fileName);
    const fileName = `stories/${userId}/${storyId}.${extension}`;
    const publicUrl = `${authData.downloadUrl}/file/${authData.bucketName}/${fileName}`;
    // B2 large files must contain at least two parts. Keep the first part at
    // B2's 5 MB minimum for clips that are only slightly larger than 5 MB.
    const partSize = size <= MULTIPART_PART_BYTES
        ? 5 * 1024 * 1024
        : MULTIPART_PART_BYTES;
    const partCount = Math.ceil(size / partSize);

    const { response, payload } = await b2Json(authData, 'b2_start_large_file', {
        bucketId: authData.bucketId,
        fileName,
        contentType,
        fileInfo: {
            pbb_source: source,
            pbb_expected_size: String(size)
        }
    });
    if (!response.ok || !payload.fileId) {
        return jsonResponse(502, { error: payload.message || 'Could not start multipart upload.' });
    }

    const uploadTarget = await getPartUploadTarget(authData, payload.fileId);
    const sessionPayload = {
        userId,
        fileId: payload.fileId,
        fileName,
        publicUrl,
        contentType,
        size,
        partSize,
        partCount,
        expiresAt: Date.now() + UPLOAD_SESSION_TTL_MS
    };
    const uploadSession = await createUploadSession(sessionPayload, authData.applicationKey);

    return jsonResponse(200, {
        success: true,
        uploadSession,
        uploadUrl: uploadTarget.uploadUrl,
        authorizationToken: uploadTarget.authorizationToken,
        fileId: payload.fileId,
        fileName,
        publicUrl,
        contentType,
        size,
        partSize,
        partCount
    });
}

async function handleSessionAction(action, body, userId, authData) {
    const session = await verifyUploadSession(body.uploadSession, authData.applicationKey);
    if (!session || session.userId !== userId) {
        return jsonResponse(403, { error: 'Upload session is invalid or expired.' });
    }

    if (action === 'refresh') {
        const uploadTarget = await getPartUploadTarget(authData, session.fileId);
        return jsonResponse(200, {
            success: true,
            uploadUrl: uploadTarget.uploadUrl,
            authorizationToken: uploadTarget.authorizationToken
        });
    }

    if (action === 'cancel') {
        const { response, payload } = await b2Json(authData, 'b2_cancel_large_file', { fileId: session.fileId });
        if (!response.ok && response.status !== 400) {
            return jsonResponse(502, { error: payload.message || 'Could not cancel multipart upload.' });
        }
        return jsonResponse(200, { success: true, cancelled: true });
    }

    if (action === 'finish') {
        const partSha1Array = body.partSha1Array;
        if (!validPartSha1Array(partSha1Array, Number(session.partCount || 0))) {
            return jsonResponse(400, { error: 'Multipart upload is missing one or more verified parts.' });
        }

        const { response, payload } = await b2Json(authData, 'b2_finish_large_file', {
            fileId: session.fileId,
            partSha1Array
        });
        if (!response.ok) {
            const info = await b2Json(authData, 'b2_get_file_info', { fileId: session.fileId });
            const alreadyFinished = info.response.ok
                && info.payload.action === 'upload'
                && info.payload.fileName === session.fileName;
            if (!alreadyFinished) {
                return jsonResponse(502, { error: payload.message || 'Could not finish multipart upload.' });
            }
            return jsonResponse(200, {
                success: true,
                fileId: info.payload.fileId,
                fileName: session.fileName,
                publicUrl: session.publicUrl,
                contentType: session.contentType,
                size: session.size,
                alreadyFinished: true
            });
        }

        return jsonResponse(200, {
            success: true,
            fileId: payload.fileId || session.fileId,
            fileName: session.fileName,
            publicUrl: session.publicUrl,
            contentType: session.contentType,
            size: session.size
        });
    }

    return jsonResponse(400, { error: 'Invalid multipart upload action.' });
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
        const action = String(body.action || '').trim().toLowerCase();
        const userId = sanitizeId(authUser.id, '');
        const authData = await authorizeB2();

        if (action === 'start') {
            return handleStart(body, userId, authData);
        }
        return handleSessionAction(action, body, userId, authData);
    } catch (error) {
        console.error('Error in story-media-multipart:', error);
        return jsonResponse(500, { error: error?.message || 'Internal server error' });
    }
};

export const config = {
    path: '/api/story-media-multipart'
};
