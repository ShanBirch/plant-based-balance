import { buildAuthUrl, isAuthorized, json, readJson } from './_lib/tiktok-content.mjs';

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const body = await readJson(req);
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  try {
    return json(200, { ok: true, ...buildAuthUrl() });
  } catch (error) {
    return json(500, { ok: false, error: error.message || 'tiktok_oauth_start_failed' });
  }
}
