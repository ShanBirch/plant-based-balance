const DEFAULT_GRAPH_BASE = 'https://graph.instagram.com';
const DEFAULT_IG_USER_ID = '17841415641641750';
const CONTENT_ID = '2026-08-21-shane-front-squat-progress';
const REQUIRED_IDEMPOTENCY_KEY = `${CONTENT_ID}-instagram-reel`;
const RECEIPT_KEY = `social_publish_receipt_${CONTENT_ID.replace(/-/g, '_')}`;

function clean(value, max = 5000) {
    return String(value || '').trim().slice(0, max);
}

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

function env(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    return clean(netlifyValue || Deno.env.get(name) || '', 5000);
}

function graphBase() {
    return clean(env('META_IG_GRAPH_BASE') || env('IG_GRAPH_BASE') || DEFAULT_GRAPH_BASE, 200).replace(/\/+$/, '');
}

function graphVersion() {
    const version = clean(env('IG_GRAPH_API_VERSION') || env('INSTAGRAM_GRAPH_API_VERSION') || env('META_GRAPH_API_VERSION') || 'v25.0', 40);
    return version.startsWith('v') ? version : `v${version}`;
}

function igUserId() {
    return clean(env('SHAN_N_SUNNY_IG_USER_ID') || env('INSTAGRAM_GRAPH_ACCOUNT_ID') || env('IG_GRAPH_BUSINESS_ACCOUNT_ID') || env('META_IG_USER_ID') || DEFAULT_IG_USER_ID, 120);
}

function postPlan() {
    return {
        contentId: CONTENT_ID,
        kind: 'reel',
        account: 'shan_n_sunny',
        caption: `Shane's front-squat journey actually started because the two of us were doing them together.\n\nI'm pretty sure I hit around 100 kg. Then, a few days later, Shane sent through 100 kg too and told me it wasn't easy.\n\nThen I backed out of front squats 😂\n\nBut I told him he shouldn't. He was moving well, and I reckoned he had a lot more there.\n\nA few weeks later he hit 130 kg after the rest of his session. That's when we set the proper target: 150 kg over eight weeks.\n\nThen every session got a job.\n\nMonday: a heavy top set and paused back-offs.\n\nThursday: volume and tempo.\n\nSaturday: speed and skill.\n\nI set the direction and kept adjusting the plan. Shane did the bit nobody can fake. He showed up, sent the lifts through, took the feedback and kept moving forward.\n\nHonestly, watching him go through the whole journey and eventually smash 150 kg was an absolute pleasure.\n\nAnd by week seven, he didn't just hit it. He hit it for two.\n\nI backed out. Shane kept going 😂\n\nFucking unreal effort, mate.`,
        media: {
            type: 'video',
            mime: 'video/mp4',
            width: 1080,
            height: 1920,
            durationSeconds: 62.016,
            url: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/stories/codex-social-publish/2026-08-21-shane-front-squat-progress.mp4',
        },
        cover: {
            mime: 'image/jpeg',
            width: 1080,
            height: 1920,
            fullCoverChecked: true,
            profileGridChecked: true,
            url: 'https://f005.backblazeb2.com/file/plantbasedbalancestories/stories/codex-social-publish/2026-08-21-shane-front-squat-progress-cover.jpg',
        },
    };
}

async function readBody(request) {
    try { return await request.json(); } catch { return {}; }
}

function authorized(request, body) {
    const expected = env('CROSSPOST_ADMIN_TOKEN');
    const supplied = clean(request.headers.get('x-crosspost-token') || body.token || '', 5000);
    return Boolean(expected && supplied && expected === supplied);
}

function serviceConfig() {
    return {
        url: clean(env('SUPABASE_URL') || env('VITE_SUPABASE_URL'), 300).replace(/\/+$/, ''),
        key: clean(env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY'), 5000),
    };
}

async function privateSecret(key) {
    const config = serviceConfig();
    if (!config.url || !config.key) return '';
    const response = await fetch(`${config.url}/rest/v1/app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    });
    if (!response.ok) return '';
    const rows = await response.json().catch(() => []);
    return clean(rows?.[0]?.value || '', 5000);
}

async function setPrivateSecret(key, value) {
    const config = serviceConfig();
    if (!config.url || !config.key) throw new Error('Supabase receipt storage is unavailable');
    const response = await fetch(`${config.url}/rest/v1/app_private_secrets?on_conflict=key`, {
        method: 'POST',
        headers: {
            apikey: config.key,
            Authorization: `Bearer ${config.key}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify([{ key, value }]),
    });
    if (!response.ok) throw new Error(`Supabase receipt storage failed: ${response.status}`);
}

async function accessToken() {
    const names = ['INSTAGRAM_GRAPH_ACCESS_TOKEN', 'IG_GRAPH_ACCESS_TOKEN', 'META_IG_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN'];
    for (const name of names) {
        const value = env(name);
        if (value.length >= 40 && !value.includes('*')) return value;
    }
    return await privateSecret('instagram_graph_access_token');
}

async function graph(path, method, params = {}) {
    const url = `${graphBase()}/${graphVersion()}/${String(path).replace(/^\/+/, '')}`;
    let response;
    if (method === 'GET') {
        const query = new URL(url);
        for (const [key, value] of Object.entries(params)) if (value != null && value !== '') query.searchParams.set(key, String(value));
        response = await fetch(query);
    } else {
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) if (value != null && value !== '') form.set(key, String(value));
        response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(clean(data?.error?.message || `Instagram Graph ${response.status}`, 600));
    return data;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForContainer(id, token) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
        const status = await graph(id, 'GET', { fields: 'status_code,status', access_token: token });
        const code = clean(status.status_code || status.status, 80).toUpperCase();
        if (code === 'FINISHED') return status;
        if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Instagram container ${id} is ${code.toLowerCase()}`);
        await sleep(2000);
    }
    throw new Error(`Instagram container ${id} did not finish in time`);
}

async function validatePlan() {
    const plan = postPlan();
    const token = await accessToken();
    if (!token) throw new Error('Instagram access token is unavailable');
    const account = await graph(igUserId(), 'GET', { fields: 'id,username', access_token: token });
    const [mediaResponse, coverResponse] = await Promise.all([
        fetch(plan.media.url, { method: 'HEAD' }),
        fetch(plan.cover.url, { method: 'HEAD' }),
    ]);
    const media = { ...plan.media, ok: mediaResponse.ok, contentType: clean(mediaResponse.headers.get('content-type') || '', 100) };
    const cover = { ...plan.cover, ok: coverResponse.ok, contentType: clean(coverResponse.headers.get('content-type') || '', 100) };
    if (!media.ok || media.contentType !== 'video/mp4') throw new Error('Reel video is not publicly fetchable as video/mp4');
    if (!cover.ok || !cover.contentType.startsWith('image/')) throw new Error('Reel cover is not publicly fetchable as an image');
    if (!cover.fullCoverChecked || !cover.profileGridChecked) throw new Error('Reel cover QA is incomplete');
    return { plan, token, account, media, cover };
}

async function publishReel(validation) {
    const { plan, token } = validation;
    const priorReceipt = await privateSecret(RECEIPT_KEY);
    if (priorReceipt) {
        let parsed = {};
        try { parsed = JSON.parse(priorReceipt); } catch {}
        return { alreadyPublished: true, ...parsed };
    }
    const container = await graph(`${igUserId()}/media`, 'POST', {
        media_type: 'REELS',
        video_url: plan.media.url,
        cover_url: plan.cover.url,
        caption: plan.caption,
        share_to_feed: true,
        access_token: token,
    });
    const creationId = clean(container.id, 120);
    if (!creationId) throw new Error('Instagram did not return a Reel container');
    await waitForContainer(creationId, token);
    const published = await graph(`${igUserId()}/media_publish`, 'POST', { creation_id: creationId, access_token: token });
    const mediaId = clean(published.id, 120);
    const media = mediaId ? await graph(mediaId, 'GET', { fields: 'id,permalink,timestamp,media_product_type,thumbnail_url', access_token: token }) : {};
    const receipt = {
        creationId,
        mediaId,
        permalink: clean(media.permalink || '', 700),
        timestamp: clean(media.timestamp || '', 100),
        mediaProductType: clean(media.media_product_type || '', 100),
        thumbnailUrl: clean(media.thumbnail_url || '', 1000),
        requestedCoverUrl: plan.cover.url,
    };
    await setPrivateSecret(RECEIPT_KEY, JSON.stringify(receipt));
    return receipt;
}

export default async request => {
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    const body = await readBody(request);
    if (!authorized(request, body)) return json(401, { ok: false, error: 'unauthorized' });
    const mode = clean(body.mode || 'dry_run', 30);
    if (!['dry_run', 'publish'].includes(mode)) return json(400, { ok: false, error: 'invalid_mode' });
    if (clean(body.idempotencyKey, 200) !== REQUIRED_IDEMPOTENCY_KEY) return json(400, { ok: false, error: 'invalid_idempotency_key' });
    try {
        const validation = await validatePlan();
        if (mode === 'dry_run') return json(200, { ok: true, mode, account: validation.account, plan: validation.plan, media: validation.media, cover: validation.cover });
        const result = await publishReel(validation);
        return json(200, { ok: true, mode, contentId: CONTENT_ID, account: validation.account, result });
    } catch (error) {
        return json(502, { ok: false, mode, error: clean(error.message || 'publish_failed', 700) });
    }
};

export const config = { path: '/api/social/post' };
