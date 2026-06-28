/**
 * Signed media redirect for the admin Post Performance board.
 *
 * IG/Threads media URLs are short-lived. The dashboard receives a signed local
 * URL, then this function refreshes/chooses the current platform media URL and
 * redirects the browser to it.
 */

const crypto = require('crypto');
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');

function text(value, max = 1000) {
    return String(value || '').trim().slice(0, max);
}

function response(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: {
            'Cache-Control': 'no-store',
            ...headers,
        },
        body,
    };
}

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return String(netlifyValue);
    return String(process.env?.[name] || '');
}

function graphVersion(envName, fallback) {
    const raw = text(getEnv(envName) || fallback, 40);
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function verifySignature({ platform, id, kind, exp, sig }) {
    const expiry = Number(exp || 0);
    if (!SUPABASE_SERVICE_KEY || !platform || !id || !kind || !sig || !Number.isFinite(expiry)) return false;
    if (expiry < Math.floor(Date.now() / 1000)) return false;
    const payload = `${platform}:${id}:${kind}:${exp}`;
    const expected = crypto.createHmac('sha256', SUPABASE_SERVICE_KEY).update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
        return false;
    }
}

async function privateSecret(key) {
    try {
        const rows = await supabaseQuery(
            `app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`
        );
        return text(rows?.[0]?.value, 5000);
    } catch {
        return '';
    }
}

async function instagramToken() {
    return text(
        getEnv('INSTAGRAM_GRAPH_ACCESS_TOKEN')
        || getEnv('IG_GRAPH_ACCESS_TOKEN')
        || getEnv('META_IG_ACCESS_TOKEN')
        || getEnv('INSTAGRAM_ACCESS_TOKEN'),
        5000
    ) || await privateSecret('instagram_graph_access_token');
}

async function threadsToken() {
    return text(getEnv('THREADS_ACCESS_TOKEN'), 5000)
        || await privateSecret('threads_access_token')
        || await privateSecret('threads_graph_access_token');
}

async function graphGet({ base, version, path, token, params = {} }) {
    if (!token) throw new Error('missing_graph_token');
    const url = new URL(`${base.replace(/\/+$/, '')}/${version}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    url.searchParams.set('access_token', token);
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(text(data?.error?.message || `graph_${res.status}`, 500));
    }
    return data || {};
}

function pickPreviewUrl(data = {}, kind = 'auto') {
    if (kind === 'thumb' && data.thumbnail_url) return data.thumbnail_url;
    if (kind === 'media' && data.media_url) return data.media_url;
    return data.thumbnail_url || data.media_url || '';
}

async function instagramPreview(id, kind) {
    const rows = await supabaseQuery(
        `ig_content_items?select=id,ig_media_id,ig_story_id,thumbnail_url,media_url,media_type,media_product_type&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    const row = rows?.[0] || null;
    if (!row) return '';

    const graphId = row.ig_media_id || row.ig_story_id || '';
    if (graphId) {
        try {
            const data = await graphGet({
                base: text(getEnv('META_IG_GRAPH_BASE') || 'https://graph.instagram.com', 200),
                version: graphVersion('META_IG_API_VERSION', 'v25.0'),
                path: graphId,
                token: await instagramToken(),
                params: { fields: 'id,media_url,thumbnail_url,media_type,media_product_type' },
            });
            const patch = {
                thumbnail_url: data.thumbnail_url || row.thumbnail_url || null,
                media_url: data.media_url || row.media_url || null,
                media_type: data.media_type || row.media_type || null,
                media_product_type: data.media_product_type || row.media_product_type || null,
                media_url_expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            };
            supabaseQuery(`ig_content_items?id=eq.${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                body: patch,
            }).catch(() => {});
            const fresh = pickPreviewUrl(data, kind);
            if (fresh) return fresh;
        } catch {
            // Fall back to stored media below.
        }
    }

    return pickPreviewUrl(row, kind);
}

async function threadsPreview(id, kind) {
    try {
        const data = await graphGet({
            base: text(getEnv('THREADS_GRAPH_BASE') || 'https://graph.threads.net', 200),
            version: graphVersion('THREADS_GRAPH_VERSION', 'v1.0'),
            path: id,
            token: await threadsToken(),
            params: { fields: 'id,media_url,thumbnail_url,media_type,media_product_type' },
        });
        return pickPreviewUrl(data, kind);
    } catch {
        return '';
    }
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'GET') return response(405, 'Method not allowed');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return response(500, 'Server misconfigured');

    const qs = event.queryStringParameters || {};
    const platform = text(qs.p, 40);
    const id = text(qs.id, 140);
    const kind = text(qs.kind || 'auto', 20);
    const exp = text(qs.exp, 40);
    const sig = text(qs.sig, 200);

    if (!verifySignature({ platform, id, kind, exp, sig })) {
        return response(403, 'Forbidden');
    }

    const url = platform === 'instagram'
        ? await instagramPreview(id, kind)
        : platform === 'threads'
            ? await threadsPreview(id, kind)
            : '';

    if (!url) return response(404, 'Preview unavailable');
    return response(302, '', { Location: url });
};

module.exports._test = { verifySignature, pickPreviewUrl };
