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
    return cleanSource === 'feed_workout_share' || cleanSource.includes('workout_share') || cleanSource.includes('share_set');
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

        // 2. Get upload URL
        const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
                'Authorization': authorizationToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });

        if (!uploadUrlResponse.ok) {
            const errorText = await uploadUrlResponse.text();
            console.error('Failed to get upload URL:', errorText);
            return jsonResponse(500, {
                error: 'Failed to get upload URL'
            });
        }

        const { uploadUrl, authorizationToken: uploadToken } = await uploadUrlResponse.json();

        // 3. Prepare file for upload
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

        // 4. Upload file to B2
        const uploadResponse = await fetch(uploadUrl, {
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

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('Upload to B2 failed:', errorText);
            return jsonResponse(500, {
                error: 'Failed to upload file'
            });
        }

        const uploadData = await uploadResponse.json();

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
