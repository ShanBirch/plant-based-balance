const DEFAULT_SITE_URL = 'https://plantbased-balance.org';

function siteUrl() {
    return String(process.env.URL || process.env.SITE_URL || DEFAULT_SITE_URL).trim().replace(/\/+$/, '');
}

function secret() {
    return String(
        process.env.IG_STORY_BOT_BRIDGE_SECRET
        || process.env.META_IG_SYNC_SECRET
        || process.env.META_IG_WEBHOOK_VERIFY_TOKEN
        || process.env.META_WEBHOOK_VERIFY_TOKEN
        || ''
    ).trim();
}

export default async (req) => {
    let nextRun = null;
    try {
        const body = await req.json();
        nextRun = body?.next_run || null;
    } catch {
        // Netlify scheduled invocations may not need the body for this job.
    }

    try {
        const res = await fetch(`${siteUrl()}/api/post-balance-challenge-story-now`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-ig-story-secret': secret(),
            },
            body: JSON.stringify({ source: 'nightly_7pm_brisbane' }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`Manual publisher returned ${res.status}: ${JSON.stringify(result)}`);
        console.log('[post-balance-challenge-story-nightly] published', {
            mediaId: result.mediaId,
            creationId: result.creationId,
            nextRun,
        });
    } catch (error) {
        console.error('[post-balance-challenge-story-nightly] failed:', error);
        throw error;
    }
};

export const config = {
    schedule: '0 9 * * *',
};
