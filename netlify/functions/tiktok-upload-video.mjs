import {
  cleanString,
  getCreatorInfo,
  initTikTokUpload,
  isAuthorized,
  json,
  recordUpload,
  refreshConnectionIfNeeded,
  uploadBinaryToTikTok,
} from './_lib/tiktok-content.mjs';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function pickPrivacy(requested, creator) {
  const options = Array.isArray(creator?.privacy_level_options) ? creator.privacy_level_options : [];
  if (requested && options.includes(requested)) return requested;
  if (options.includes('SELF_ONLY')) return 'SELF_ONLY';
  return options[0] || 'SELF_ONLY';
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let form;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: 'invalid_form_data' });
  }

  const body = { secret: cleanString(form.get('secret'), 500) };
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  const file = form.get('video');
  const mode = cleanString(form.get('mode'), 20) === 'publish' ? 'publish' : 'draft';
  const caption = cleanString(form.get('caption'), 2200);
  const contentType = cleanString(file?.type, 120) || 'video/mp4';
  const fileSize = Number(file?.size || 0);

  if (!file || typeof file.arrayBuffer !== 'function') return json(400, { ok: false, error: 'missing_video' });
  if (!fileSize || fileSize > MAX_UPLOAD_BYTES) return json(400, { ok: false, error: 'video_must_be_50mb_or_less' });
  if (!SUPPORTED_TYPES.has(contentType)) return json(400, { ok: false, error: 'unsupported_video_type' });

  let uploadRecord = null;
  try {
    const connection = await refreshConnectionIfNeeded();
    let creator = {};
    let privacyLevel = cleanString(form.get('privacyLevel'), 100);

    if (mode === 'publish') {
      creator = await getCreatorInfo(connection.access_token);
      privacyLevel = pickPrivacy(privacyLevel, creator);
    }

    const init = await initTikTokUpload({
      accessToken: connection.access_token,
      mode,
      size: fileSize,
      caption,
      privacyLevel,
      creator,
    });

    await uploadBinaryToTikTok(init.data?.upload_url, file, contentType);

    uploadRecord = await recordUpload({
      mode,
      publish_id: init.data?.publish_id,
      caption,
      privacy_level: mode === 'publish' ? privacyLevel : null,
      file_name: file.name,
      file_size: fileSize,
      content_type: contentType,
    });

    return json(200, {
      ok: true,
      mode,
      publishId: init.data?.publish_id || null,
      privacyLevel: mode === 'publish' ? privacyLevel : null,
      upload: uploadRecord,
      creator: mode === 'publish' ? creator : null,
    });
  } catch (error) {
    await recordUpload({
      mode,
      caption,
      privacy_level: cleanString(form.get('privacyLevel'), 100) || null,
      file_name: file?.name,
      file_size: fileSize,
      content_type: contentType,
      tiktok_error: error.tiktok || { message: error.message || 'upload_failed' },
    }).catch(() => null);

    return json(500, {
      ok: false,
      error: error.message || 'tiktok_upload_failed',
      detail: error.tiktok || null,
    });
  }
}
