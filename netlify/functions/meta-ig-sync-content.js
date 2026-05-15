/**
 * Pull Shannon-owned IG media/stories into ig_content_items.
 *
 * This is the "AI knows what Shannon posted" sidecar. Stories must be synced
 * while they are still live; feed/reel media can be refreshed from /media.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');
const {
    contentTypeFromProduct,
    analyzeInstagramContent,
    buildFallbackSummary,
} = require('./_lib/meta-ig-context');

const ACCESS_TOKEN_ENV = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN
    || process.env.IG_GRAPH_ACCESS_TOKEN
    || process.env.META_IG_ACCESS_TOKEN
    || process.env.INSTAGRAM_ACCESS_TOKEN
    || '';
let cachedAccessToken = ACCESS_TOKEN_ENV;
const IG_USER_ID = process.env.META_IG_USER_ID
    || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
    || process.env.IG_GRAPH_ACCOUNT_ID
    || '';
const GRAPH_BASE = (process.env.META_IG_GRAPH_BASE || 'https://graph.instagram.com').replace(/\/+$/, '');
const API_VERSION = normalizeGraphApiVersion(
    process.env.META_IG_API_VERSION
    || process.env.IG_GRAPH_API_VERSION
    || process.env.INSTAGRAM_GRAPH_API_VERSION
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);
const SYNC_SECRET = process.env.META_IG_SYNC_SECRET || process.env.META_IG_WEBHOOK_VERIFY_TOKEN || '';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function isAuthorized(event) {
    try {
        const body = event.body ? JSON.parse(event.body) : null;
        if (body?.next_run) return true;
    } catch {
        // Ignore malformed bodies; normal secret/dev checks still apply.
    }
    if (!SYNC_SECRET) return process.env.CONTEXT === 'dev';
    const provided = String(
        event.headers?.['x-meta-ig-sync-secret']
        || event.headers?.['X-Meta-Ig-Sync-Secret']
        || event.queryStringParameters?.secret
        || ''
    ).trim();
    return provided === SYNC_SECRET;
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

async function getAccessToken() {
    if (cachedAccessToken) return cachedAccessToken;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';
    try {
        const rows = await supabaseQuery(
            'app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'
        );
        const token = String(rows?.[0]?.value || '').trim();
        if (token) cachedAccessToken = token;
    } catch (err) {
        console.warn('[meta-ig-sync-content] IG Graph token lookup failed:', err.message);
    }
    return cachedAccessToken;
}

async function graphGet(path, params = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('Meta IG access token missing');
    const url = new URL(`${GRAPH_BASE}/${API_VERSION}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    url.searchParams.set('access_token', token);
    const res = await fetch(url.toString());
    const text = await res.text();
    if (!res.ok) throw new Error(`Graph ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
}

async function fetchEdge(edge, limit) {
    const fields = [
        'id',
        'ig_id',
        'caption',
        'media_type',
        'media_product_type',
        'media_url',
        'thumbnail_url',
        'permalink',
        'timestamp',
        'username',
    ].join(',');
    const data = await graphGet(`${IG_USER_ID}/${edge}`, { fields, limit });
    return Array.isArray(data?.data) ? data.data : [];
}

function rowFromMedia(media, edge) {
    const productType = media.media_product_type || (edge === 'stories' ? 'STORY' : media.media_type);
    const contentType = contentTypeFromProduct(productType, edge === 'stories' ? 'story' : 'post');
    const postedAt = media.timestamp || null;
    const expiresAt = contentType === 'story' && postedAt
        ? new Date(new Date(postedAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : null;
    return {
        source_key: contentType === 'story' ? `ig_story:${media.id}` : `ig_media:${media.id}`,
        ig_media_id: contentType === 'story' ? null : String(media.id),
        ig_story_id: contentType === 'story' ? String(media.id) : null,
        content_type: contentType,
        media_product_type: productType || null,
        media_type: media.media_type || null,
        caption: media.caption || null,
        permalink: media.permalink || null,
        media_url: media.media_url || null,
        thumbnail_url: media.thumbnail_url || null,
        posted_at: postedAt,
        expires_at: expiresAt,
        media_url_expires_at: contentType === 'story'
            ? expiresAt
            : (media.media_url ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : null),
        raw_payload: { latest_media: media, sync_edge: edge },
    };
}

async function loadExisting(sourceKey) {
    const rows = await supabaseQuery(
        `ig_content_items?select=*&source_key=eq.${encodeURIComponent(sourceKey)}&limit=1`
    );
    return rows[0] || null;
}

async function upsertRow(row) {
    const rows = await supabaseQuery('ig_content_items?on_conflict=source_key', {
        method: 'POST',
        body: [row],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}

async function syncOne(media, edge) {
    const baseRow = rowFromMedia(media, edge);
    const existing = await loadExisting(baseRow.source_key);
    let row = baseRow;
    const shouldAnalyze = !existing?.analysis_summary || (baseRow.media_url && baseRow.media_url !== existing.media_url);
    if (shouldAnalyze) {
        const analysis = baseRow.media_url || baseRow.caption
            ? await analyzeInstagramContent(baseRow)
            : {
                analysis_status: 'skipped',
                analysis_summary: buildFallbackSummary(baseRow),
                analysis_model: 'none',
                analysis_error: 'no_media_or_caption',
            };
        row = { ...row, ...analysis };
    }
    return upsertRow(row);
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    if (!isAuthorized(event)) return json(403, { error: 'Not authorized' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });
    if (!IG_USER_ID) return json(500, { error: 'Meta IG user id missing' });
    if (!await getAccessToken()) return json(500, { error: 'Meta IG token missing' });

    const qs = event.queryStringParameters || {};
    const mode = String(qs.mode || 'stories').toLowerCase();
    const limit = Math.max(1, Math.min(50, Number(qs.limit || (mode === 'media' ? 12 : 25)) || 12));
    const edges = mode === 'all'
        ? ['stories', 'media']
        : [mode === 'media' ? 'media' : 'stories'];

    const synced = [];
    for (const edge of edges) {
        const items = await fetchEdge(edge, limit);
        for (const item of items) {
            try {
                const saved = await syncOne(item, edge);
                synced.push({ edge, source_key: saved?.source_key, id: saved?.id, status: saved?.analysis_status });
            } catch (err) {
                console.error('[meta-ig-sync-content] sync item failed:', err);
                synced.push({ edge, source_key: item?.id || null, error: err.message });
            }
        }
    }

    return json(200, { ok: true, mode, synced_count: synced.length, synced });
};
