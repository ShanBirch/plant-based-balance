// Private owner notifications. Provider messages carry only a non-secret event ID.
export const VERSION = 'balance_activity_v1';
export const SUBJECT = 'BALANCE_ACTIVITY_V1';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function getEnv(name) { return globalThis.Netlify?.env?.get(name) || process.env[name] || ''; }
export function runtime() {
  return { url: (getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')).replace(/\/+$/, ''),
    key: getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY'),
    mailKey: getEnv('RESEND_API_KEY'), from: getEnv('BOOKING_EMAIL_FROM') };
}
export function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function rpc(name, args, config = runtime()) {
  if (!config.url || !config.key) throw new Error('database_not_configured');
  const r = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST',
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(3500) });
  if (!r.ok) throw new Error(`database_${r.status}`);
  return r.json();
}
export function notificationEmail(row, from) {
  if (!UUID.test(row.id) || !row.recipient_email || /[\r\n]/.test(from)) throw new Error('invalid_delivery');
  return { from, to: [row.recipient_email], subject: `${SUBJECT}${row.event_kind === 'test' ? ' TEST' : ''} ${row.id}`,
    text: `${row.event_kind === 'test' ? 'Synthetic test. ' : ''}Balance activity notification.\nEvent ID: ${row.id}\nClient details are available only in the authorised activity record.` };
}
export async function dispatch({ eventId = null, limit = 10, config = runtime() } = {}) {
  const configured = Boolean(config.mailKey && config.from);
  // Never persist or log credentials, request headers, raw errors, or provider bodies.
  await rpc('balance_activity_runtime_status', { p_status: { version: VERSION, email_configured: configured,
    sender: config.from || null, checked_at: new Date().toISOString() } }, config);
  if (!configured) return { sent: 0, blocked: 'email_not_configured' };
  const rows = await rpc('balance_activity_claim', { p_event_id: eventId, p_limit: limit }, config);
  let sent = 0;
  await Promise.all((rows || []).map(async row => {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST',
        headers: { Authorization: `Bearer ${config.mailKey}`, 'Content-Type': 'application/json',
          'Idempotency-Key': `balance-activity-v1/${row.id}` },
        body: JSON.stringify(notificationEmail(row, config.from)), signal: AbortSignal.timeout(4500) });
      const result = await r.json().catch(() => ({}));
      if (!r.ok) {
        await rpc('balance_activity_finish', { p_event_id: row.id, p_claim_token: row.claim_token,
          p_provider_id: null, p_error_code: `provider_${r.status}` }, config);
        return;
      }
      if (typeof result.id !== 'string' || !result.id) throw new Error('provider_receipt_missing');
      const saved = await rpc('balance_activity_finish', { p_event_id: row.id, p_claim_token: row.claim_token,
        p_provider_id: result.id.slice(0, 200), p_error_code: null }, config);
      if (saved === true) sent++;
    } catch (_) {
      await rpc('balance_activity_finish', { p_event_id: row.id, p_claim_token: row.claim_token,
        p_provider_id: null, p_error_code: 'transport_or_receipt_unconfirmed' }, config).catch(() => {});
    }
  }));
  return { sent };
}
