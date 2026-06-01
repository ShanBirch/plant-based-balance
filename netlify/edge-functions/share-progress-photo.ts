/**
 * Netlify Edge Function: Share Progress Photo
 * Creates a feed post for a weekly progress photo and awards the one-time share bonus.
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from '@supabase/supabase-js';

interface ShareProgressPhotoRequest {
  userId: string;
  photoId: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({}, 204);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body: ShareProgressPhotoRequest = await request.json();
    const { userId, photoId } = body;

    if (!userId || !photoId) {
      return jsonResponse({
        error: 'Missing required fields',
        required: ['userId', 'photoId'],
      }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse({ success: false, error: 'Missing authorization' }, 401);
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user?.id) {
      return jsonResponse({ success: false, error: 'Invalid authorization' }, 401);
    }

    if (authData.user.id !== userId) {
      return jsonResponse({ success: false, error: 'User mismatch' }, 403);
    }

    const { data: result, error: shareError } = await supabase.rpc('share_progress_photo_to_feed', {
      p_user_id: userId,
      p_photo_id: photoId,
    });

    if (shareError) {
      if (String(shareError.message || '').toLowerCase().includes('progress photo not found')) {
        return jsonResponse({ success: false, error: 'Progress photo not found' }, 404);
      }
      throw shareError;
    }

    try {
      await supabase.rpc('update_challenge_participant_points', { user_uuid: userId });
    } catch (challengeError) {
      console.warn('Could not refresh challenge points after progress photo share:', challengeError);
    }

    return jsonResponse(result || { success: true, pointsAwarded: 0 });
  } catch (error) {
    console.error('Error sharing progress photo:', error);
    return jsonResponse({
      success: false,
      error: 'Failed to share progress photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
};

export const config = {
  path: '/api/share-progress-photo',
};
