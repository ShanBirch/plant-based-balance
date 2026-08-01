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
    const brisbaneDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    if (brisbaneDate !== '2026-08-01') {
        return json(200, { ok: true, skipped: 'outside_publish_date' });
    }

    const siteUrl = clean(process.env.URL || process.env.SITE_URL || 'https://plantbased-balance.org', 400).replace(/\/+$/, '');
    const token = clean(process.env.CROSSPOST_ADMIN_TOKEN, 5000);
    if (!token) throw new Error('CROSSPOST_ADMIN_TOKEN is unavailable');
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
    if (!response.ok || !result.ok) {
        throw new Error(`Instagram publish failed: ${response.status} ${clean(result.error || text, 700)}`);
    }
    return json(200, { ok: true, contentId: CONTENT_ID, result });
};

export const config = { schedule: '* * * * *' };
