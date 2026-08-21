const CONTENT_ID = '2026-08-21-shane-front-squat-progress-ui-safe-v2';
const APPROVAL_KEY = `${CONTENT_ID}-instagram-reel`;

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function json(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

export default async request => {
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

    const body = await request.json().catch(() => ({}));
    const mode = clean(body.mode || 'dry_run', 30);
    if (!['dry_run', 'publish', 'status'].includes(mode)) return json(400, { ok: false, error: 'invalid_mode' });
    if (clean(body.approvalKey, 200) !== APPROVAL_KEY) return json(401, { ok: false, error: 'approval_key_invalid' });

    const siteUrl = clean(process.env.URL || process.env.SITE_URL || 'https://plantbased-balance.org', 400).replace(/\/+$/, '');
    const token = clean(process.env.CROSSPOST_ADMIN_TOKEN, 5000);
    if (!token) return json(500, { ok: false, error: 'crosspost_token_unavailable' });

    const response = await fetch(`${siteUrl}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crosspost-token': token },
        body: JSON.stringify({
            mode,
            idempotencyKey: APPROVAL_KEY,
            approval: {
                approvedBy: 'Shannon',
                account: 'shan_n_sunny',
                media: CONTENT_ID,
                permissionConfirmed: true,
                timing: 'immediate',
                coverRequired: true,
            },
        }),
    });

    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 1000) }; }
    return json(response.ok && result.ok ? 200 : 502, {
        ok: response.ok && Boolean(result.ok),
        mode,
        contentId: CONTENT_ID,
        upstreamStatus: response.status,
        result,
    });
};
