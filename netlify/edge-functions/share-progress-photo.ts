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

interface ProgressPhotoShot {
  angle?: string;
  title?: string;
  photo_url: string;
  storage_path?: string;
}

interface ProgressPhotoRow {
  id: string;
  user_id: string;
  photo_url: string;
  storage_path?: string | null;
  photo_week?: string | null;
  notes?: string | null;
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

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseProgressPhotoNotes(notes: unknown): Record<string, unknown> {
  const raw = cleanString(notes);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch (_) {
    return {};
  }
}

function normalizeProgressPhotoShot(value: unknown): ProgressPhotoShot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shot = value as Record<string, unknown>;
  const photoUrl = cleanString(shot.photo_url) || cleanString(shot.media_url) || cleanString(shot.url);
  if (!photoUrl || !isHttpUrl(photoUrl)) return null;

  const normalized: ProgressPhotoShot = { photo_url: photoUrl };
  const angle = cleanString(shot.angle) || cleanString(shot.key) || cleanString(shot.position);
  const title = cleanString(shot.title) || cleanString(shot.label);
  const storagePath = cleanString(shot.storage_path) || cleanString(shot.fileName) || cleanString(shot.file_name);

  if (angle) normalized.angle = angle;
  if (title) normalized.title = title;
  if (storagePath) normalized.storage_path = storagePath;
  return normalized;
}

function buildProgressPhotoFeedPayload(photo: ProgressPhotoRow): Record<string, unknown> {
  const notes = parseProgressPhotoNotes(photo.notes);
  const rawShots = Array.isArray(notes.shots) ? notes.shots : [];
  const shots = rawShots
    .map(normalizeProgressPhotoShot)
    .filter((shot): shot is ProgressPhotoShot => !!shot);

  if (!shots.length && cleanString(photo.photo_url)) {
    shots.push({
      angle: 'progress',
      title: 'Progress photo',
      photo_url: photo.photo_url,
      ...(photo.storage_path ? { storage_path: photo.storage_path } : {}),
    });
  }

  return {
    card_type: 'progress_photo_set',
    share_caption: shots.length >= 3 ? 'Weekly progress photos locked in.' : 'Weekly progress photo locked in.',
    photo_id: photo.id,
    photo_week: photo.photo_week || null,
    shot_count: shots.length,
    shots,
  };
}

function getResultStoryId(result: Record<string, unknown>): string {
  const story = result.story;
  if (!story || typeof story !== 'object' || Array.isArray(story)) return '';
  return cleanString((story as Record<string, unknown>).id);
}

async function enhanceProgressPhotoStory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  photoId: string,
  result: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data: photo, error: photoError } = await supabase
    .from('weekly_progress_photos')
    .select('id,user_id,photo_url,storage_path,photo_week,notes')
    .eq('id', photoId)
    .eq('user_id', userId)
    .maybeSingle();

  if (photoError) throw photoError;
  if (!photo) return result;

  const payload = buildProgressPhotoFeedPayload(photo as ProgressPhotoRow);
  const shots = Array.isArray(payload.shots) ? payload.shots as ProgressPhotoShot[] : [];
  const primaryUrl = cleanString(shots[0]?.photo_url) || cleanString((photo as ProgressPhotoRow).photo_url);
  if (!primaryUrl) return result;

  let storyId = getResultStoryId(result);
  if (!storyId) {
    const candidateUrls = Array.from(new Set([cleanString((photo as ProgressPhotoRow).photo_url), primaryUrl].filter(Boolean)));
    const { data: existingStory, error: findError } = await supabase
      .from('stories')
      .select('id')
      .eq('user_id', userId)
      .eq('media_type', 'progress_photo')
      .in('media_url', candidateUrls)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;
    storyId = cleanString(existingStory?.id);
  }

  const storyPatch = {
    media_url: primaryUrl,
    thumbnail_url: primaryUrl,
    caption: JSON.stringify(payload),
    duration: 5,
    background_color: '#ec4899',
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (storyId) {
    const { data: updatedStory, error: updateError } = await supabase
      .from('stories')
      .update(storyPatch)
      .eq('id', storyId)
      .eq('user_id', userId)
      .select('id,user_id,media_type,media_url,thumbnail_url,caption,created_at')
      .maybeSingle();

    if (updateError) throw updateError;
    return updatedStory ? { ...result, story: updatedStory } : result;
  }

  const { data: insertedStory, error: insertError } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_type: 'progress_photo',
      ...storyPatch,
    })
    .select('id,user_id,media_type,media_url,thumbnail_url,caption,created_at')
    .single();

  if (insertError) throw insertError;
  return insertedStory ? { ...result, story: insertedStory } : result;
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

    const responseBody = result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown>
      : { success: true, pointsAwarded: 0 };

    try {
      return jsonResponse(await enhanceProgressPhotoStory(supabase, userId, photoId, responseBody));
    } catch (enhanceError) {
      console.warn('Could not attach all progress photo shots to feed story:', enhanceError);
      return jsonResponse(responseBody);
    }
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
