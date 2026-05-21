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
const ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const INSIGHT_METRIC_GROUPS = [
    ['likes', 'comments', 'shares', 'saved', 'reach', 'total_interactions'],
    ['views', 'plays', 'video_views', 'impressions', 'engagement'],
    ['replies', 'navigation', 'follows', 'profile_activity', 'profile_visits'],
    ['ig_reels_video_view_total_time', 'ig_reels_avg_watch_time', 'clips_replays_count', 'ig_reels_aggregated_all_plays_count', 'reels_skip_rate'],
    ['thread_replies', 'reposts', 'quotes', 'thread_shares', 'content_views', 'threads_views', 'threads_media_clicks', 'threads_reposts', 'facebook_views', 'crossposted_views'],
];

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers = {}, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

async function isAdminRequest(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!res.ok) return false;
        const user = await res.json();
        return String(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
    } catch {
        return false;
    }
}

async function isAuthorized(event) {
    try {
        const body = event.body ? JSON.parse(event.body) : null;
        if (body?.next_run) return true;
    } catch {
        // Ignore malformed bodies; normal secret/dev checks still apply.
    }
    if (!SYNC_SECRET) return process.env.CONTEXT === 'dev' || isAdminRequest(event);
    const provided = String(
        event.headers?.['x-meta-ig-sync-secret']
        || event.headers?.['X-Meta-Ig-Sync-Secret']
        || event.queryStringParameters?.secret
        || ''
    ).trim();
    if (provided === SYNC_SECRET) return true;
    return isAdminRequest(event);
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

function graphUserPath() {
    return String(IG_USER_ID || 'me').replace(/^\/+|\/+$/g, '') || 'me';
}

async function fetchEdge(edge, limit) {
    const baseFields = [
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
    ];
    const withCounts = [...baseFields, 'comments_count', 'like_count'].join(',');
    let data;
    try {
        data = await graphGet(`${graphUserPath()}/${edge}`, { fields: withCounts, limit });
    } catch (err) {
        console.warn('[meta-ig-sync-content] media edge count fields unavailable, retrying base fields:', err.message);
        data = await graphGet(`${graphUserPath()}/${edge}`, { fields: baseFields.join(','), limit });
    }
    return Array.isArray(data?.data) ? data.data : [];
}

function insightValue(item = {}) {
    if (item.total_value && Object.prototype.hasOwnProperty.call(item.total_value, 'value')) {
        return item.total_value.value;
    }
    const values = Array.isArray(item.values) ? item.values : [];
    if (!values.length) return null;
    return values[values.length - 1]?.value ?? null;
}

function numericInsight(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nums = Object.values(value).map(numericInsight).filter(n => Number.isFinite(n));
        return nums.length ? nums.reduce((sum, n) => sum + n, 0) : null;
    }
    return null;
}

function mergeInsightData(target, rawItems = []) {
    rawItems.forEach(item => {
        const name = item?.name || item?.metric || item?.title;
        if (!name) return;
        const value = insightValue(item);
        const numeric = numericInsight(value);
        target.latest_insights[name] = Number.isFinite(numeric) ? numeric : value;
        target.latest_insights_raw[name] = item;
    });
}

async function graphInsights(mediaId, metrics) {
    try {
        return await graphGet(`${mediaId}/insights`, { metric: metrics.join(',') });
    } catch (withoutPeriodErr) {
        try {
            return await graphGet(`${mediaId}/insights`, { metric: metrics.join(','), period: 'day' });
        } catch (withPeriodErr) {
            withPeriodErr.firstError = withoutPeriodErr.message;
            throw withPeriodErr;
        }
    }
}

async function fetchMetricGroup(mediaId, metrics) {
    try {
        const data = await graphInsights(mediaId, metrics);
        return { data: Array.isArray(data?.data) ? data.data : [], errors: [] };
    } catch (groupErr) {
        const data = [];
        const errors = [{ metrics, error: groupErr.message, firstError: groupErr.firstError || '' }];
        for (const metric of metrics) {
            try {
                const one = await graphInsights(mediaId, [metric]);
                if (Array.isArray(one?.data)) data.push(...one.data);
            } catch (metricErr) {
                errors.push({ metric, error: metricErr.message, firstError: metricErr.firstError || '' });
            }
        }
        return { data, errors };
    }
}

async function fetchPerformancePayload(media, contentType, includeInsights) {
    const latestCounts = {};
    if (media.like_count != null) latestCounts.like_count = Number(media.like_count) || 0;
    if (media.comments_count != null) latestCounts.comments_count = Number(media.comments_count) || 0;
    if ((media.like_count == null || media.comments_count == null) && media?.id) {
        try {
            const counts = await graphGet(media.id, { fields: 'like_count,comments_count' });
            if (counts?.like_count != null) latestCounts.like_count = Number(counts.like_count) || 0;
            if (counts?.comments_count != null) latestCounts.comments_count = Number(counts.comments_count) || 0;
        } catch (err) {
            // Some media/API versions only expose these through insights.
        }
    }

    const payload = {
        latest_counts: latestCounts,
        latest_insights: {},
        latest_insights_raw: {},
        insight_errors: [],
        latest_graph_synced_at: new Date().toISOString(),
    };

    if (!includeInsights || !media?.id) return payload;

    for (const group of INSIGHT_METRIC_GROUPS) {
        const result = await fetchMetricGroup(media.id, group);
        mergeInsightData(payload, result.data);
        payload.insight_errors.push(...result.errors);
    }

    if (contentType === 'story' && payload.latest_counts.comments_count == null) {
        const replies = numericInsight(payload.latest_insights.replies);
        if (Number.isFinite(replies)) payload.latest_counts.comments_count = replies;
    }

    return payload;
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

async function syncOne(media, edge, options = {}) {
    const baseRow = rowFromMedia(media, edge);
    const existing = await loadExisting(baseRow.source_key);
    let row = baseRow;
    const includeAnalysis = options.includeAnalysis !== false;
    const includeInsights = options.includeInsights !== false;
    const shouldAnalyze = includeAnalysis && (!existing?.analysis_summary || (baseRow.media_url && baseRow.media_url !== existing.media_url));
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
    const performance = await fetchPerformancePayload(media, baseRow.content_type, includeInsights).catch(err => ({
        latest_counts: {},
        latest_insights: {},
        latest_insights_raw: {},
        insight_errors: [{ error: err.message }],
        latest_graph_synced_at: new Date().toISOString(),
    }));
    row.raw_payload = {
        ...(existing?.raw_payload || {}),
        ...(baseRow.raw_payload || {}),
        ...performance,
    };
    return upsertRow(row);
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    if (!await isAuthorized(event)) return json(403, { error: 'Not authorized' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });
    if (!await getAccessToken()) return json(500, { error: 'Meta IG token missing' });

    const qs = event.queryStringParameters || {};
    const mode = String(qs.mode || 'stories').toLowerCase();
    const limit = Math.max(1, Math.min(50, Number(qs.limit || (mode === 'media' ? 12 : 25)) || 12));
    const includeInsights = String(qs.include_insights ?? qs.insights ?? 'true').toLowerCase() !== 'false';
    const includeAnalysis = String(qs.include_analysis ?? qs.analyze ?? 'true').toLowerCase() !== 'false';
    const edges = mode === 'all'
        ? ['stories', 'media']
        : [mode === 'media' ? 'media' : 'stories'];

    const synced = [];
    for (const edge of edges) {
        const items = await fetchEdge(edge, limit);
        for (const item of items) {
            try {
                const saved = await syncOne(item, edge, { includeInsights, includeAnalysis });
                synced.push({
                    edge,
                    source_key: saved?.source_key,
                    id: saved?.id,
                    status: saved?.analysis_status,
                    insights: includeInsights ? 'synced' : 'skipped',
                });
            } catch (err) {
                console.error('[meta-ig-sync-content] sync item failed:', err);
                synced.push({ edge, source_key: item?.id || null, error: err.message });
            }
        }
    }

    return json(200, { ok: true, mode, synced_count: synced.length, synced });
};
