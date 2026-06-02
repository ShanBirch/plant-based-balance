import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    defaultBalanceChallengeStoryUrl,
    publishBalanceChallengeStory,
} = require('./_lib/ig-story-publisher');

function json(status, body) {
    return Response.json(body, { status });
}

function getSecret() {
    return String(
        process.env.IG_STORY_BOT_BRIDGE_SECRET
        || process.env.META_IG_SYNC_SECRET
        || process.env.META_IG_WEBHOOK_VERIFY_TOKEN
        || process.env.META_WEBHOOK_VERIFY_TOKEN
        || ''
    ).trim();
}

async function readJson(req) {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

function isAuthorized(req, body = {}) {
    if (process.env.CONTEXT === 'dev') return true;
    const secret = getSecret();
    const provided = String(
        req.headers.get('x-ig-story-secret')
        || req.headers.get('x-meta-ig-sync-secret')
        || body.secret
        || ''
    ).trim();
    return Boolean(secret && provided === secret);
}

export default async (req) => {
    if (req.method !== 'POST') {
        return json(405, { ok: false, error: 'method_not_allowed' });
    }

    const body = await readJson(req);
    if (!isAuthorized(req, body)) {
        return json(401, { ok: false, error: 'unauthorized' });
    }

    try {
        const result = await publishBalanceChallengeStory({
            source: 'manual_now',
            videoUrl: body.videoUrl || defaultBalanceChallengeStoryUrl(),
        });
        return json(200, result);
    } catch (error) {
        console.error('[post-balance-challenge-story-now] failed:', error);
        return json(500, {
            ok: false,
            error: error.message || 'publish_failed',
            graph: error.graph || null,
        });
    }
};

export const config = {
    path: '/api/post-balance-challenge-story-now',
};
