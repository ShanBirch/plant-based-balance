const CONTENT_ID = '2026-07-28-single-leg-rdl';
const TARGET_UTC = '2026-07-28T04:00:00.000Z';
const APPROVAL_VALUE = `${CONTENT_ID}-approved`;

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export default async () => {
    const now = new Date();
    if (now.toISOString().slice(0, 10) !== '2026-07-28') {
        return json(200, { ok: true, skipped: 'outside_publish_date', now: now.toISOString() });
    }
    if (now.getTime() < Date.parse(TARGET_UTC)) {
        return json(200, { ok: true, skipped: 'before_publish_time', now: now.toISOString(), target: TARGET_UTC });
    }
    if (clean(process.env.SINGLE_LEG_RDL_REEL_APPROVAL, 200) !== APPROVAL_VALUE) {
        return json(200, { ok: true, skipped: 'approval_missing', contentId: CONTENT_ID });
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
                account: 'shan_n_sunny',
                media: CONTENT_ID,
                timing: '2026-07-28T14:00:00+10:00',
                coverRequired: true,
            },
        }),
    });
    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text.slice(0, 1000) }; }
    if (!response.ok || !result.ok) throw new Error(`Instagram scheduled publish failed: ${response.status} ${clean(result.error || text, 700)}`);
    return json(200, { ok: true, contentId: CONTENT_ID, scheduledFor: TARGET_UTC, result });
};

export const config = { schedule: '0 4 * * *' };
