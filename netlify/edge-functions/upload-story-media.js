/**
 * Netlify Edge Function to upload story media to Backblaze B2
 * Handles both images and videos for the stories feature
 */

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

        if (!file || !userId || !storyId) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: file, userId, storyId'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get B2 credentials from environment
        const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
        const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
        const B2_BUCKET_ID = Deno.env.get("B2_BUCKET_ID");
        const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME");

        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error("Missing B2 configuration");
            return new Response(JSON.stringify({
                error: 'Server configuration error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
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
            return new Response(JSON.stringify({
                error: 'Failed to authorize with storage service'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
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
            return new Response(JSON.stringify({
                error: 'Failed to get upload URL'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const { uploadUrl, authorizationToken: uploadToken } = await uploadUrlResponse.json();

        // 3. Prepare file for upload
        const fileBuffer = await file.arrayBuffer();
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
            return new Response(JSON.stringify({
                error: 'Failed to upload file'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const uploadData = await uploadResponse.json();

        // 5. Construct public URL
        const publicUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${fileName}`;

        // Return success with public URL
        return new Response(JSON.stringify({
            success: true,
            url: publicUrl,
            fileName: fileName,
            fileId: uploadData.fileId,
            contentType: file.type,
            size: fileBuffer.byteLength
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in upload-story-media:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/upload-story-media"
};
