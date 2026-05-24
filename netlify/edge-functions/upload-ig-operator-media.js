/**
 * Admin-only IG Operator media upload.
 *
 * Stores raw photos/videos in B2 and records them in ig_operator_assets.
 * This is an intake lane only: it does not publish to Instagram.
 */

const ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getHeader(request, name) {
    return request.headers.get(name) || request.headers.get(name.toLowerCase()) || '';
}

function getEnv(name, fallback = '') {
    return Deno.env.get(name) || fallback;
}

function sanitizeFileName(name) {
    const fallback = 'ig-operator-upload';
    const raw = String(name || fallback).replace(/[\\/:*?"<>|]+/g, '-').trim();
    const compact = raw.replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 120);
    return compact || fallback;
}

function extensionFor(fileName, contentType) {
    const fromName = String(fileName || '').split('.').pop();
    if (fromName && fromName.length <= 8 && fromName !== fileName) return fromName.toLowerCase();
    if (/quicktime/i.test(contentType)) return 'mov';
    if (/mp4/i.test(contentType)) return 'mp4';
    if (/png/i.test(contentType)) return 'png';
    if (/webp/i.test(contentType)) return 'webp';
    if (/heic/i.test(contentType)) return 'heic';
    return 'jpg';
}

function mediaTypeFor(contentType, fileName) {
    const type = String(contentType || '').toLowerCase();
    const name = String(fileName || '').toLowerCase();
    if (type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(name)) return 'video';
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(name)) return 'image';
    return 'unknown';
}

async function verifyAdmin(request) {
    const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
    const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');
    if (!supabaseUrl || !serviceKey) return { error: 'Supabase env missing', status: 500 };

    const token = String(getHeader(request, 'authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { error: 'Unauthorized', status: 401 };

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { error: 'Unauthorized', status: 401 };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== ADMIN_EMAIL) return { error: 'Forbidden', status: 403 };
    return { supabaseUrl, serviceKey, user };
}

async function uploadToB2({ file, userId, contentType, sizeBytes }) {
    const B2_KEY_ID = getEnv('B2_KEY_ID');
    const B2_APPLICATION_KEY = getEnv('B2_APPLICATION_KEY');
    const B2_BUCKET_ID = getEnv('B2_BUCKET_ID');
    const B2_BUCKET_NAME = getEnv('B2_BUCKET_NAME');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
        throw new Error('Storage configuration missing');
    }

    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        method: 'GET',
        headers: {
            Authorization: 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`),
        },
    });
    if (!authResponse.ok) throw new Error('Failed to authorize storage upload');

    const authData = await authResponse.json();
    const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: authData.authorizationToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
    });
    if (!uploadUrlResponse.ok) throw new Error('Failed to get storage upload URL');

    const uploadData = await uploadUrlResponse.json();
    const safeOriginal = sanitizeFileName(file.name);
    const ext = extensionFor(safeOriginal, contentType);
    const baseName = safeOriginal.replace(/\.[^.]+$/, '');
    const fileName = `ig-operator/${userId}/${Date.now()}-${crypto.randomUUID()}-${baseName}.${ext}`;

    const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: uploadData.authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType || 'application/octet-stream',
            'Content-Length': String(sizeBytes),
            'X-Bz-Content-Sha1': 'do_not_verify',
            'X-Bz-Info-Author': `admin-${userId}`,
            'X-Bz-Info-upload-type': 'ig-operator-media',
        },
        body: file.stream(),
    });
    if (!uploadResponse.ok) throw new Error('Failed to upload media');

    const uploaded = await uploadResponse.json();
    return {
        fileName,
        fileId: uploaded.fileId,
        publicUrl: `${authData.downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`,
    };
}

async function insertAsset({ supabaseUrl, serviceKey, row }) {
    const res = await fetch(`${supabaseUrl}/rest/v1/ig_operator_assets`, {
        method: 'POST',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
        },
        body: JSON.stringify([row]),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Could not record IG Operator asset: ${text.slice(0, 300)}`);
    try {
        return text ? JSON.parse(text)[0] : null;
    } catch {
        return null;
    }
}

export default async (request) => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    try {
        const admin = await verifyAdmin(request);
        if (admin.error) return json({ error: admin.error }, admin.status);

        const formData = await request.formData();
        const file = formData.get('file');
        const operatorNotes = String(formData.get('notes') || '').trim();

        if (!file || typeof file.arrayBuffer !== 'function') {
            return json({ error: 'Missing required file' }, 400);
        }

        const contentType = file.type || 'application/octet-stream';
        const mediaType = mediaTypeFor(contentType, file.name);
        if (mediaType === 'unknown') {
            return json({ error: 'Upload must be an image or video' }, 400);
        }

        const sizeBytes = Number(file.size || 0);
        if (Number.isFinite(sizeBytes) && sizeBytes > MAX_UPLOAD_BYTES) {
            return json({ error: 'File is too large for IG Operator upload' }, 413);
        }

        const uploaded = await uploadToB2({
            file,
            userId: admin.user.id,
            contentType,
            sizeBytes,
        });

        const asset = await insertAsset({
            supabaseUrl: admin.supabaseUrl,
            serviceKey: admin.serviceKey,
            row: {
                admin_user_id: admin.user.id,
                source: 'admin_upload',
                status: 'raw',
                media_type: mediaType,
                content_type: contentType,
                original_filename: file.name || null,
                storage_provider: 'backblaze_b2',
                storage_key: uploaded.fileName,
                storage_file_id: uploaded.fileId,
                media_url: uploaded.publicUrl,
                thumbnail_url: mediaType === 'image' ? uploaded.publicUrl : null,
                size_bytes: sizeBytes || null,
                operator_notes: operatorNotes || null,
                metadata: {
                    uploaded_from: 'admin_dashboard_ig_operator',
                    user_agent: getHeader(request, 'user-agent') || null,
                },
            },
        });

        return json({
            success: true,
            asset,
            url: uploaded.publicUrl,
            fileName: uploaded.fileName,
            fileId: uploaded.fileId,
            contentType,
            mediaType,
            size: sizeBytes || null,
        });
    } catch (error) {
        console.error('Error in upload-ig-operator-media:', error);
        return json({ error: error.message || 'Internal server error' }, 500);
    }
};

export const config = {
    path: '/api/upload-ig-operator-media',
};
