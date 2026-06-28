import {
  getCreatorInfo,
  isAuthorized,
  json,
  readJson,
  refreshConnectionIfNeeded,
} from './_lib/tiktok-content.mjs';

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const body = await readJson(req);
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  try {
    const connection = await refreshConnectionIfNeeded();
    const creator = await getCreatorInfo(connection.access_token);
    return json(200, { ok: true, creator });
  } catch (error) {
    return json(500, { ok: false, error: error.message || 'tiktok_creator_info_failed' });
  }
}
