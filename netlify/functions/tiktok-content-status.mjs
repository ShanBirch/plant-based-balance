import {
  getConnection,
  isAuthorized,
  json,
  publicConnection,
  readJson,
  refreshConnectionIfNeeded,
  tiktokRedirectUri,
} from './_lib/tiktok-content.mjs';

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const body = await readJson(req);
  if (!isAuthorized(req, body)) return json(401, { ok: false, error: 'unauthorized' });

  try {
    const connection = body.refresh ? await refreshConnectionIfNeeded(true) : await getConnection();
    return json(200, {
      ok: true,
      redirectUri: tiktokRedirectUri(),
      connection: publicConnection(connection),
    });
  } catch (error) {
    return json(200, {
      ok: false,
      redirectUri: tiktokRedirectUri(),
      connection: { connected: false },
      error: error.message || 'tiktok_status_failed',
    });
  }
}
