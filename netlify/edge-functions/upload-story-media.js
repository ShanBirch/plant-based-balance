/**
 * Netlify Edge Function to upload story media to Backblaze B2
 * Handles both images and videos for the stories feature
 */

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function asciiFromBytes(bytes, start, length) {
    if (!bytes || bytes.length < start + length) return '';
    let text = '';
    for (let i = start; i < start + length; i += 1) {
        const code = bytes[i];
        text += code >= 32 && code <= 126 ? String.fromCharCode(code) : ' ';
    }
    return text;
}

function hasImageSignature(bytes) {
    if (!bytes || bytes.length < 4) return false;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
    if (asciiFromBytes(bytes, 0, 4) === 'GIF8') return true;
    if (asciiFromBytes(bytes, 0, 4) === 'RIFF' && asciiFromBytes(bytes, 8, 4) === 'WEBP') return true;
    if (asciiFromBytes(bytes, 4, 4) === 'ftyp') {
        const brandText = asciiFromBytes(bytes, 8, Math.min(24, bytes.length - 8)).toLowerCase();
        return /\b(heic|heix|heif|mif1|msf1|avif)\b/.test(brandText);
    }
    return false;
}

function hasSupportedVideoSignature(bytes) {
    if (!bytes || bytes.length < 4) return false;
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
    if (asciiFromBytes(bytes, 0, 4) === 'OggS') return true;
    if (asciiFromBytes(bytes, 4, 4) === 'ftyp') return !hasImageSignature(bytes);
    return false;
}

function requiresWorkoutVideo(source) {
    const cleanSource = String(source || '').trim().toLowerCase();
    if (cleanSource.includes('thumbnail')) return false;
    // Only Share a Set uploads are video-only. Post-workout photo overlays
    // intentionally use sources such as `workout_share_photo_overlay` and
    // must be accepted as JPEGs.
    return cleanSource === 'feed_workout_share' || cleanSource === 'share_set';
}

function validateWorkoutVideoUpload(file, fileBuffer, source) {
    if (!requiresWorkoutVideo(source)) return null;

    const contentType = String(file?.type || '').trim().toLowerCase();
    const headerBytes = new Uint8Array(fileBuffer.slice(0, Math.min(fileBuffer.byteLength, 32)));

    if (contentType.startsWith('image/') || hasImageSignature(headerBytes)) {
        return 'That recording saved as a photo instead of a video. Please record the set again.';
    }

    if (!contentType.startsWith('video/') && !hasSupportedVideoSignature(headerBytes)) {
        return 'That recording did not save as a supported video. Please record the set again.';
    }

    return null;
}

const B2_UPLOAD_MAX_ATTEMPTS = 3;
const B2_UPLOAD_ATTEMPT_TIMEOUT_MS = 8000;

function isRetryableB2UploadFailure(status, errorText = '') {
    const code = Number(status || 0);
    const detail = String(errorText || '').toLowerCase();
    // The relay has already validated the file before reaching B2. In live
    // traffic B2 occasionally returns a one-off 4xx from an upload host/token
    // and accepts the identical bytes on a fresh host immediately after. Only
    // a real payload-size rejection is permanent here.
    return code !== 413
        || /expired_auth_token|service_unavailable|too_many_requests|request_timeout/.test(detail);
}

function waitForB2UploadRetry(attempt) {
    return new Promise(resolve => setTimeout(resolve, Math.min(1200, 250 * attempt)));
}

async function fetchB2WithTimeout(url, options, timeoutMs = B2_UPLOAD_ATTEMPT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

export default async (request, context) => {
    // Only allow POST
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const userId = formData.get('userId');
        const storyId = formData.get('storyId');
        const source = formData.get('source');

        if (!file || !userId || !storyId) {
            return jsonResponse(400, {
                error: 'Missing required fields: file, userId, storyId'
            });
        }

        // Get B2 credentials from environment
        const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
        const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
        const B2_BUCKET_ID = Deno.env.get("B2_BUCKET_ID");
        const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME");

        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error("Missing B2 configuration");
            return jsonResponse(500, {
                error: 'Server configuration error'
            });
        }

        // 1. Authorize with B2
        const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
            }
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            console.error('B2 Authorization failed:', errorText);
            return jsonResponse(500, {
                error: 'Failed to authorize with storage service'
            });
        }

        const authData = await authResponse.json();
        const { authorizationToken, apiUrl, downloadUrl } = authData;

        // 2. Prepare file for upload
        const fileBuffer = await file.arrayBuffer();
        const videoValidationError = validateWorkoutVideoUpload(file, fileBuffer, source);
        if (videoValidationError) {
            return jsonResponse(400, { error: videoValidationError });
        }

        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `stories/${userId}/${storyId}.${fileExtension}`;

        // Calculate SHA1 hash (required by B2)
        const hashBuffer = await crypto.subtle.digest('SHA-1', fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 3. Get a fresh upload URL for each attempt. B2 upload hosts and
        // tokens can fail transiently; one failed host should not make a Feed
        // post surface a red error toast to the member.
        let uploadData = null;
        let lastUploadError = '';
        for (let attempt = 1; attempt <= B2_UPLOAD_MAX_ATTEMPTS && !uploadData; attempt += 1) {
            try {
                const uploadUrlResponse = await fetchB2WithTimeout(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
                    method: 'POST',
                    headers: {
                        'Authorization': authorizationToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ bucketId: B2_BUCKET_ID })
                });

                if (!uploadUrlResponse.ok) {
                    const errorText = await uploadUrlResponse.text();
                    lastUploadError = `get_upload_url ${uploadUrlResponse.status}: ${errorText}`;
                    if (attempt >= B2_UPLOAD_MAX_ATTEMPTS || !isRetryableB2UploadFailure(uploadUrlResponse.status, errorText)) {
                        break;
                    }
                    await waitForB2UploadRetry(attempt);
                    continue;
                }

                const { uploadUrl, authorizationToken: uploadToken } = await uploadUrlResponse.json();
                const uploadResponse = await fetchB2WithTimeout(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': uploadToken,
                        'X-Bz-File-Name': encodeURIComponent(fileName),
                        'Content-Type': file.type || 'application/octet-stream',
                        'Content-Length': fileBuffer.byteLength.toString(),
                        'X-Bz-Content-Sha1': sha1Hash,
                        'X-Bz-Info-Author': `user-${userId}`,
                        'X-Bz-Info-story-id': storyId
                    },
                    body: fileBuffer
                });

                if (uploadResponse.ok) {
                    uploadData = await uploadResponse.json();
                    break;
                }

                const errorText = await uploadResponse.text();
                lastUploadError = `upload ${uploadResponse.status}: ${errorText}`;
                if (attempt >= B2_UPLOAD_MAX_ATTEMPTS || !isRetryableB2UploadFailure(uploadResponse.status, errorText)) {
                    break;
                }
            } catch (error) {
                lastUploadError = error?.message || String(error);
                if (attempt >= B2_UPLOAD_MAX_ATTEMPTS) break;
            }

            await waitForB2UploadRetry(attempt);
        }

        if (!uploadData) {
            console.error('Upload to B2 failed after retries:', lastUploadError);
            return jsonResponse(502, {
                error: 'Failed to upload file'
            });
        }

        // 5. Construct public URL
        const publicUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        // Return success with public URL
        return jsonResponse(200, {
            success: true,
            url: publicUrl,
            fileName: fileName,
            fileId: uploadData.fileId,
            contentType: file.type,
            size: fileBuffer.byteLength
        });

    } catch (error) {
        console.error('Error in upload-story-media:', error);
        return jsonResponse(500, {
            error: error.message || 'Internal server error'
        });
    }
};

export const config = {
    path: "/api/upload-story-media"
};
