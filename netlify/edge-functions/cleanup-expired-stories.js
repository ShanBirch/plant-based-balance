/**
 * Netlify Edge Function to clean up expired story media from Backblaze B2
 * Should be called periodically (e.g., via cron or Netlify scheduled function)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=denonext';

export default async (request, context) => {
    try {
        // Get Supabase credentials
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            console.error("Missing Supabase configuration");
            return new Response(JSON.stringify({
                error: 'Server configuration error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialize Supabase client with service role key
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Get expired stories that have B2 URLs (not Base64)
        const { data: expiredStories, error: fetchError } = await supabase
            .from('stories')
            .select('id, media_url, user_id')
            .lt('expires_at', new Date().toISOString())
            .like('media_url', 'https://%'); // Only B2 URLs, not Base64

        if (fetchError) {
            console.error('Error fetching expired stories:', fetchError);
            return new Response(JSON.stringify({
                error: 'Failed to fetch expired stories'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!expiredStories || expiredStories.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                message: 'No expired stories with B2 media found',
                deletedCount: 0
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get B2 credentials
        const B2_KEY_ID = Deno.env.get("B2_KEY_ID");
        const B2_APPLICATION_KEY = Deno.env.get("B2_APPLICATION_KEY");
        const B2_BUCKET_NAME = Deno.env.get("B2_BUCKET_NAME");

        if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_NAME) {
            console.error("Missing B2 configuration");
            return new Response(JSON.stringify({
                error: 'Server configuration error - B2 not configured'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Authorize with B2
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
        const { authorizationToken, apiUrl } = authData;

        // Delete each file from B2
        const deletionResults = [];
        for (const story of expiredStories) {
            try {
                // Extract filename from URL
                // URL format: https://...downloadUrl.../file/bucket-name/stories/userId/storyId.ext
                const urlParts = story.media_url.split(`/${B2_BUCKET_NAME}/`);
                if (urlParts.length < 2) {
                    console.warn('Could not parse B2 URL:', story.media_url);
                    continue;
                }
                const fileName = urlParts[1];

                // List file versions to get file ID
                const listResponse = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
                    method: 'POST',
                    headers: {
                        'Authorization': authorizationToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        bucketId: authData.allowed.bucketId,
                        startFileName: fileName,
                        maxFileCount: 1,
                        prefix: fileName
                    })
                });

                if (!listResponse.ok) {
                    console.error('Failed to list file:', await listResponse.text());
                    continue;
                }

                const listData = await listResponse.json();
                if (!listData.files || listData.files.length === 0) {
                    console.warn('File not found in B2:', fileName);
                    continue;
                }

                const fileId = listData.files[0].fileId;
                const fileNameFromList = listData.files[0].fileName;

                // Delete the file
                const deleteResponse = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
                    method: 'POST',
                    headers: {
                        'Authorization': authorizationToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileId: fileId,
                        fileName: fileNameFromList
                    })
                });

                if (deleteResponse.ok) {
                    deletionResults.push({
                        storyId: story.id,
                        fileName: fileName,
                        success: true
                    });
                } else {
                    const errorText = await deleteResponse.text();
                    console.error('Failed to delete file:', fileName, errorText);
                    deletionResults.push({
                        storyId: story.id,
                        fileName: fileName,
                        success: false,
                        error: errorText
                    });
                }
            } catch (error) {
                console.error('Error deleting story media:', story.id, error);
                deletionResults.push({
                    storyId: story.id,
                    success: false,
                    error: error.message
                });
            }
        }

        // Now delete the stories from database (this will also clean up Base64 stories)
        const { error: deleteDbError } = await supabase
            .rpc('cleanup_expired_stories');

        if (deleteDbError) {
            console.error('Error cleaning up database stories:', deleteDbError);
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Cleanup completed',
            b2FilesDeleted: deletionResults.filter(r => r.success).length,
            b2FilesFailed: deletionResults.filter(r => !r.success).length,
            totalExpiredStories: expiredStories.length,
            details: deletionResults
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in cleanup-expired-stories:', error);
        return new Response(JSON.stringify({
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const config = {
    path: "/api/cleanup-expired-stories"
};
