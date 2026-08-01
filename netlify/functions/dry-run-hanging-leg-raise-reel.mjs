const CONTENT_ID = '2026-08-01-hanging-leg-raise';

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function json(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

export default async () => {
    const brisbaneDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (brisbaneDate !== '2026-08-01') return json(410, { ok: false, error: 'dry_run_window_closed' });

    const siteUrl = clean(process.env.URL || process.env.SITE_URL || 'https://plantbased-balance.org', 400).replace(/\/+$/, '');
    const token = clean(process.env.CROSSPOST_ADMIN_TOKEN, 5000);
    if (!token) return json(500, { ok: false, error: 'crosspost_token_unavailable' });
    const response = await fetch(`${siteUrl}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crosspost-token': token },
        body: JSON.stringify({ mode: 'dry_run', idempotencyKey: `${CONTENT_ID}-instagram-reel` }),
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 1000) }; }
    return json(response.ok && result.ok ? 200 : 502, { ok: response.ok && Boolean(result.ok), upstreamStatus: response.status, result });
};
