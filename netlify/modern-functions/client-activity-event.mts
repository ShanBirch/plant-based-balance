import { UUID, response, runtime, rpc, dispatch } from '../functions/_lib/client-activity-alerts.mjs';

export default async function handler(request: Request) {
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' });
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) return response(401, { error: 'unauthorized' });
  if (Number(request.headers.get('content-length') || 0) > 2048) return response(413, { error: 'too_large' });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return response(413, { error: 'too_large' });
    body = JSON.parse(raw);
  } catch { return response(400, { error: 'invalid_json' }); }
  if (!body || !['foreground', 'presence'].includes(body.kind) || body.visible !== true ||
      !UUID.test(body.event_id || '') || typeof body.occurred_at !== 'string' ||
      !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(body.occurred_at) ||
      !Number.isFinite(Date.parse(body.occurred_at)) || Date.parse(body.occurred_at) < Date.now() - 300000 ||
      Date.parse(body.occurred_at) > Date.now() + 60000 || typeof body.usage_session_id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(body.usage_session_id) ||
      Object.keys(body).some(k => !['kind', 'event_id', 'usage_session_id', 'visible', 'occurred_at'].includes(k))) {
    return response(400, { error: 'invalid_event' });
  }
  try {
    const config = runtime();
    if (!config.url || !config.key) return response(503, { error: 'unavailable' });
    const auth = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.key, Authorization: authorization }, signal: AbortSignal.timeout(6500) });
    if (!auth.ok) return response(401, { error: 'unauthorized' });
    const user = await auth.json();
    if (!UUID.test(user.id || '')) return response(401, { error: 'unauthorized' });
    const result = await rpc('balance_activity_record_presence', {
      p_user_id: user.id, p_event_id: body.event_id, p_usage_session_id: body.usage_session_id, p_kind: body.kind, p_occurred_at: body.occurred_at
    }, config);
    // Capture is durable before provider delivery. The scheduled worker retries failures.
    if (result?.outbox_id) await dispatch({ eventId: result.outbox_id, limit: 1, config }).catch(() => {});
    return response(202, { accepted: true });
  } catch { return response(503, { error: 'temporarily_unavailable' }); }
}
