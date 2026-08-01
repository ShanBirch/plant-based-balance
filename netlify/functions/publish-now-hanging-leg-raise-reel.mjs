const CONTENT_ID = '2026-08-01-hanging-leg-raise';
const EXPECTED_NONCE_SHA256 = '9290fe42a998bea705dabfd3e825b09d11cf0240bde90cd81e72d680883f21f5';

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function json(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default async request => {
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    const suppliedNonce = clean(request.headers.get('x-publish-nonce'), 200);
    if (!suppliedNonce || await sha256(suppliedNonce) !== EXPECTED_NONCE_SHA256) {
        return json(401, { ok: false, error: 'unauthorized' });
    }

    const brisbaneDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    if (brisbaneDate !== '2026-08-01') return json(410, { ok: false, error: 'publish_window_closed' });

    const siteUrl = clean(process.env.URL || process.env.SITE_URL || 'https://plantbased-balance.org', 400).replace(/\/+$/, '');
    const token = clean(process.env.CROSSPOST_ADMIN_TOKEN, 5000);
    if (!token) return json(500, { ok: false, error: 'crosspost_token_unavailable' });
    const response = await fetch(`${siteUrl}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crosspost-token': token },
        body: JSON.stringify({
            mode: 'publish',
            idempotencyKey: `${CONTENT_ID}-instagram-reel`,
            approval: {
                approvedBy: 'Shannon Birch',
                account: 'shan_n_sunny',
                media: CONTENT_ID,
                timing: 'immediate',
                coverRequired: true,
                approvalSource: 'User confirmed the exact Instagram package in the active conversation.',
            },
        }),
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 1000) }; }
    return json(response.ok && result.ok ? 200 : 502, {
        ok: response.ok && Boolean(result.ok),
        upstreamStatus: response.status,
        result,
    });
};
