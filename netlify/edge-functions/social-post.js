const DEFAULT_SITE_URL = 'https://plantbased-balance.org';
const DEFAULT_GRAPH_BASE = 'https://graph.instagram.com';
const DEFAULT_IG_USER_ID = '17841415641641750';
const CONTENT_ID = '2026-07-12-small-wins';
const REQUIRED_IDEMPOTENCY_KEY = `${CONTENT_ID}-instagram-feed`;

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

function siteUrl(request) {
    return clean(env('URL') || env('SITE_URL') || new URL(request.url).origin || DEFAULT_SITE_URL, 300).replace(/\/+$/, '');
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

function postPlan(request) {
    const base = siteUrl(request);
    return {
        contentId: CONTENT_ID,
        kind: 'carousel',
        caption: `Small wins beat motivation.\n\nOn a hard day, you don’t need to do everything perfectly.\n\n10 minutes. One walk. One decent meal.\n\nThe version you can repeat beats the perfect plan you abandon.\n\nSave this for the next rough day.\nGet back in Balance.`,
        images: [1, 2, 3, 4].map(number => `${base}/social-assets/2026-07-12-small-wins/small-wins-share-reference-slide-${String(number).padStart(2, '0')}.jpg`),
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

async function privateSecret(key) {
    const supabaseUrl = clean(env('SUPABASE_URL') || env('VITE_SUPABASE_URL'), 300).replace(/\/+$/, '');
    const serviceKey = clean(env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY'), 5000);
    if (!supabaseUrl || !serviceKey) return '';
    const response = await fetch(`${supabaseUrl}/rest/v1/app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) return '';
    const rows = await response.json().catch(() => []);
    return clean(rows?.[0]?.value || '', 5000);
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
    for (let attempt = 0; attempt < 15; attempt += 1) {
        const status = await graph(id, 'GET', { fields: 'status_code,status', access_token: token });
        const code = clean(status.status_code || status.status, 80).toUpperCase();
        if (code === 'FINISHED') return status;
        if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Instagram container ${id} is ${code.toLowerCase()}`);
        await sleep(1500);
    }
    throw new Error(`Instagram container ${id} did not finish in time`);
}

async function validatePlan(request) {
    const plan = postPlan(request);
    const token = await accessToken();
    if (!token) throw new Error('Instagram access token is unavailable');
    const account = await graph(igUserId(), 'GET', { fields: 'id,username', access_token: token });
    const images = await Promise.all(plan.images.map(async url => {
        const response = await fetch(url, { method: 'HEAD' });
        return { url, ok: response.ok, contentType: clean(response.headers.get('content-type') || '', 100) };
    }));
    if (images.some(image => !image.ok || !image.contentType.startsWith('image/'))) throw new Error('One or more carousel images are not publicly fetchable');
    return { plan, token, account, images };
}

async function publishCarousel(validation) {
    const { plan, token } = validation;
    const children = [];
    for (const imageUrl of plan.images) {
        const child = await graph(`${igUserId()}/media`, 'POST', {
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: token,
        });
        const childId = clean(child.id, 120);
        if (!childId) throw new Error('Instagram did not return a child media container');
        await waitForContainer(childId, token);
        children.push(childId);
    }
    const parent = await graph(`${igUserId()}/media`, 'POST', {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: plan.caption,
        access_token: token,
    });
    const creationId = clean(parent.id, 120);
    if (!creationId) throw new Error('Instagram did not return a carousel container');
    await waitForContainer(creationId, token);
    const published = await graph(`${igUserId()}/media_publish`, 'POST', { creation_id: creationId, access_token: token });
    const mediaId = clean(published.id, 120);
    const media = mediaId ? await graph(mediaId, 'GET', { fields: 'id,permalink,timestamp,media_product_type', access_token: token }) : {};
    return { creationId, childContainerIds: children, mediaId, permalink: clean(media.permalink || '', 700), timestamp: clean(media.timestamp || '', 100) };
}

export default async request => {
    if (request.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    const body = await readBody(request);
    if (!authorized(request, body)) return json(401, { ok: false, error: 'unauthorized' });
    const mode = clean(body.mode || 'dry_run', 30);
    if (!['dry_run', 'publish'].includes(mode)) return json(400, { ok: false, error: 'invalid_mode' });
    if (clean(body.idempotencyKey, 200) !== REQUIRED_IDEMPOTENCY_KEY) return json(400, { ok: false, error: 'invalid_idempotency_key' });
    try {
        const validation = await validatePlan(request);
        if (mode === 'dry_run') return json(200, { ok: true, mode, account: validation.account, plan: validation.plan, images: validation.images });
        const result = await publishCarousel(validation);
        return json(200, { ok: true, mode, contentId: CONTENT_ID, account: validation.account, result });
    } catch (error) {
        return json(502, { ok: false, mode, error: clean(error.message || 'publish_failed', 700) });
    }
};

export const config = { path: '/api/social/post' };
