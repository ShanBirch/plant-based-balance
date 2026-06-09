/**
 * Content Performance Snapshot
 *
 * Admin-only dashboard feed for owned social posts. Instagram rows come from
 * the existing Graph sync tables; Threads rows are fetched live from the
 * Threads API when a token is configured.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');
const crypto = require('crypto');

const ADMIN_EMAILS = new Set(['shannonbirch@cocospersonaltraining.com']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const YOUTUBE_PLAYLIST_ITEMS_URL = 'https://www.googleapis.com/youtube/v3/playlistItems';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
        body: JSON.stringify(body),
    };
}

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return String(netlifyValue);
    return String(process.env?.[name] || '');
}

function getHeader(headers = {}, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function parseBody(event) {
    try {
        return event.body ? JSON.parse(event.body) : {};
    } catch {
        return {};
    }
}

function cleanText(value, max = 1000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function clampWindowDays(value) {
    const n = Number(value || 90);
    if (!Number.isFinite(n)) return 90;
    return Math.max(7, Math.min(365, Math.round(n)));
}

function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function isoDateDaysAgo(daysAgo) {
    const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
}

function signPreviewPath(platform, id, kind = 'auto') {
    const safePlatform = cleanText(platform, 40);
    const safeId = cleanText(id, 140);
    if (!safePlatform || !safeId || !SUPABASE_SERVICE_KEY) return '';
    const exp = String(Math.floor(Date.now() / 1000) + 60 * 60 * 6);
    const payload = `${safePlatform}:${safeId}:${kind}:${exp}`;
    const sig = crypto.createHmac('sha256', SUPABASE_SERVICE_KEY).update(payload).digest('hex');
    const params = new URLSearchParams({ p: safePlatform, id: safeId, kind, exp, sig });
    return `/.netlify/functions/content-performance-media?${params}`;
}

function previewKindForMedia({ thumbnailUrl = '', mediaType = '', mediaProductType = '', type = '' } = {}) {
    if (thumbnailUrl) return 'image';
    const hint = `${mediaType} ${mediaProductType} ${type}`.toLowerCase();
    if (/\b(video|reel)\b/.test(hint)) return 'video';
    return 'image';
}

function formBody(params) {
    const body = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
    });
    return body;
}

function graphBase() {
    return cleanText(getEnv('THREADS_GRAPH_BASE') || 'https://graph.threads.net', 200).replace(/\/+$/, '');
}

function graphVersion() {
    const raw = cleanText(getEnv('THREADS_GRAPH_VERSION') || 'v1.0', 40);
    return raw.startsWith('v') ? raw : `v${raw}`;
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`exec_sql_json ${res.status}: ${text.slice(0, 240)}`);
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
    if (Array.isArray(parsed)) return parsed;
    if (parsed?.error) throw new Error(parsed.error);
    return [];
}

async function requireAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { ok: false, error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { ok: false, error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (!ADMIN_EMAILS.has(email)) return { response: json(403, { ok: false, error: 'Forbidden' }) };
    return { user };
}

async function privateSecret(key) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';
    try {
        const rows = await supabaseQuery(
            `app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`
        );
        return cleanText(rows?.[0]?.value, 5000);
    } catch {
        return '';
    }
}

async function threadsToken() {
    return cleanText(getEnv('THREADS_ACCESS_TOKEN'), 5000)
        || await privateSecret('threads_access_token')
        || await privateSecret('threads_graph_access_token');
}

async function threadsUserId() {
    return cleanText(getEnv('THREADS_USER_ID'), 120)
        || await privateSecret('threads_user_id');
}

function numericSql(alias) {
    return `CASE WHEN ${alias} ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ${alias}::NUMERIC ELSE 0 END`;
}

function scoreMetrics(metrics = {}) {
    const deep = toNumber(metrics.likes)
        + (toNumber(metrics.comments) * 3)
        + (toNumber(metrics.saves) * 4)
        + (toNumber(metrics.shares) * 4)
        + (toNumber(metrics.replies) * 3)
        + (toNumber(metrics.reposts) * 3)
        + (toNumber(metrics.quotes) * 4);
    const visibility = (toNumber(metrics.reach) * 0.02) + (toNumber(metrics.views) * 0.01);
    return Math.round(Math.max(toNumber(metrics.totalInteractions), deep) + visibility + toNumber(metrics.feedbackEvents));
}

function standardRow(row) {
    const metrics = {
        views: toNumber(row.metrics?.views),
        likes: toNumber(row.metrics?.likes),
        comments: toNumber(row.metrics?.comments),
        saves: toNumber(row.metrics?.saves),
        shares: toNumber(row.metrics?.shares),
        reach: toNumber(row.metrics?.reach),
        replies: toNumber(row.metrics?.replies),
        reposts: toNumber(row.metrics?.reposts),
        quotes: toNumber(row.metrics?.quotes),
        totalInteractions: toNumber(row.metrics?.totalInteractions),
        feedbackEvents: toNumber(row.metrics?.feedbackEvents),
    };
    const score = row.score == null ? scoreMetrics(metrics) : toNumber(row.score);
    return {
        id: String(row.id || ''),
        platform: row.platform || 'unknown',
        platformLabel: row.platformLabel || row.platform || 'Unknown',
        externalId: String(row.externalId || ''),
        type: row.type || 'post',
        title: cleanText(row.title || '', 160),
        caption: cleanText(row.caption || '', 360),
        summary: cleanText(row.summary || '', 260),
        permalink: row.permalink || '',
        thumbnailUrl: row.thumbnailUrl || '',
        mediaUrl: row.mediaUrl || '',
        mediaType: row.mediaType || '',
        mediaProductType: row.mediaProductType || '',
        previewUrl: row.previewUrl || '',
        previewKind: row.previewKind || previewKindForMedia(row),
        postedAt: row.postedAt || null,
        postedLabel: row.postedLabel || dateLabel(row.postedAt),
        syncedAt: row.syncedAt || null,
        metrics,
        score,
        warnings: Array.isArray(row.warnings) ? row.warnings : [],
    };
}

async function loadInstagramRows(windowDays) {
    const days = clampWindowDays(windowDays);
    const rows = await execSqlJson(`
        WITH interaction_counts AS (
            SELECT
                ci.content_item_id,
                COUNT(*)::INT AS webhook_interactions,
                COUNT(*) FILTER (WHERE ci.event_type = 'comment')::INT AS webhook_comments,
                COUNT(*) FILTER (WHERE ci.event_type = 'story_reply')::INT AS webhook_story_replies,
                MAX(ci.received_at) AS latest_interaction_at
            FROM public.ig_content_interactions ci
            GROUP BY ci.content_item_id
        ),
        raw AS (
            SELECT
                item.id,
                item.source_key,
                item.ig_media_id,
                item.ig_story_id,
                item.content_type,
                item.media_product_type,
                item.media_type,
                item.caption,
                item.permalink,
                item.thumbnail_url,
                item.media_url,
                item.posted_at,
                item.created_at,
                item.analysis_summary,
                item.analysis_reply_context,
                COALESCE(ic.webhook_interactions, 0)::NUMERIC AS webhook_interactions,
                COALESCE(ic.webhook_comments, 0)::NUMERIC AS webhook_comments,
                COALESCE(ic.webhook_story_replies, 0)::NUMERIC AS webhook_story_replies,
                COALESCE(item.raw_payload #>> '{latest_counts,like_count}', item.raw_payload #>> '{latest_media,like_count}', item.raw_payload #>> '{latest_insights,likes}', item.raw_payload #>> '{insights,likes}', '0') AS likes_raw,
                COALESCE(item.raw_payload #>> '{latest_counts,comments_count}', item.raw_payload #>> '{latest_media,comments_count}', item.raw_payload #>> '{latest_insights,comments}', item.raw_payload #>> '{insights,comments}', '0') AS comments_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,saved}', item.raw_payload #>> '{latest_insights,saves}', item.raw_payload #>> '{insights,saved}', '0') AS saved_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,shares}', item.raw_payload #>> '{insights,shares}', '0') AS shares_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,reach}', item.raw_payload #>> '{latest_insights,impressions}', item.raw_payload #>> '{insights,reach}', item.raw_payload #>> '{insights,impressions}', '0') AS reach_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,views}', item.raw_payload #>> '{latest_insights,plays}', item.raw_payload #>> '{latest_insights,video_views}', item.raw_payload #>> '{latest_insights,ig_reels_aggregated_all_plays_count}', item.raw_payload #>> '{insights,views}', item.raw_payload #>> '{insights,plays}', item.raw_payload #>> '{insights,video_views}', '0') AS views_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,replies}', item.raw_payload #>> '{insights,replies}', '0') AS replies_raw,
                COALESCE(item.raw_payload #>> '{latest_insights,total_interactions}', item.raw_payload #>> '{latest_insights,engagement}', item.raw_payload #>> '{insights,total_interactions}', item.raw_payload #>> '{insights,engagement}', '0') AS total_interactions_raw,
                COALESCE(item.raw_payload #>> '{latest_graph_synced_at}', item.raw_payload #>> '{latest_insights_synced_at}', '') AS graph_synced_at
            FROM public.ig_content_items item
            LEFT JOIN interaction_counts ic ON ic.content_item_id = item.id
            WHERE COALESCE(item.posted_at, item.created_at) >= NOW() - (INTERVAL '1 day' * ${days})
                AND COALESCE(item.content_type, 'unknown') IN ('post', 'reel', 'carousel', 'story', 'unknown')
            ORDER BY COALESCE(item.posted_at, item.created_at) DESC NULLS LAST
            LIMIT 500
        )
        SELECT
            *,
            ${numericSql('likes_raw')} AS likes,
            ${numericSql('comments_raw')} AS comments,
            ${numericSql('saved_raw')} AS saved,
            ${numericSql('shares_raw')} AS shares,
            ${numericSql('reach_raw')} AS reach,
            ${numericSql('views_raw')} AS views,
            ${numericSql('replies_raw')} AS replies,
            ${numericSql('total_interactions_raw')} AS total_interactions
        FROM raw
    `);

    return rows.map(row => standardRow({
        id: row.id,
        platform: 'instagram',
        platformLabel: 'Instagram',
        externalId: row.ig_media_id || row.ig_story_id || row.source_key,
        type: row.content_type || 'post',
        title: row.media_product_type || row.media_type || '',
        caption: row.caption,
        summary: row.analysis_reply_context || row.analysis_summary,
        permalink: row.permalink,
        thumbnailUrl: row.thumbnail_url || '',
        mediaUrl: row.media_url || '',
        mediaType: row.media_type || '',
        mediaProductType: row.media_product_type || '',
        previewUrl: signPreviewPath('instagram', row.id, row.thumbnail_url ? 'thumb' : 'auto'),
        previewKind: previewKindForMedia({
            thumbnailUrl: row.thumbnail_url,
            mediaType: row.media_type,
            mediaProductType: row.media_product_type,
            type: row.content_type,
        }),
        postedAt: row.posted_at || row.created_at,
        syncedAt: row.graph_synced_at || null,
        metrics: {
            likes: row.likes,
            comments: Math.max(toNumber(row.comments), toNumber(row.webhook_comments)),
            saves: row.saved,
            shares: row.shares,
            reach: row.reach,
            views: row.views,
            replies: Math.max(toNumber(row.replies), toNumber(row.webhook_story_replies)),
            totalInteractions: row.total_interactions,
            feedbackEvents: row.webhook_interactions,
        },
    }));
}

function insightNumber(item = {}) {
    if (item.total_value && Object.prototype.hasOwnProperty.call(item.total_value, 'value')) {
        return toNumber(item.total_value.value);
    }
    const values = Array.isArray(item.values) ? item.values : [];
    if (!values.length) return 0;
    return toNumber(values[values.length - 1]?.value);
}

async function threadsGet(path, params = {}, token) {
    const url = new URL(`${graphBase()}/${graphVersion()}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    url.searchParams.set('access_token', token);
    const res = await fetch(url);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = {}; }
    if (!res.ok) {
        const message = data?.error?.message || `threads_graph_${res.status}`;
        const error = new Error(cleanText(message, 500));
        error.status = res.status;
        throw error;
    }
    return data;
}

async function fetchThreadsInsights(mediaId, token) {
    const metrics = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'];
    const data = await threadsGet(`${mediaId}/insights`, { metric: metrics.join(',') }, token);
    const out = {};
    (Array.isArray(data?.data) ? data.data : []).forEach(item => {
        out[item.name] = insightNumber(item);
    });
    return out;
}

async function loadThreadsRows(windowDays) {
    const token = await threadsToken();
    const configured = Boolean(token);
    if (!configured) {
        return { configured, rows: [], error: 'THREADS_ACCESS_TOKEN is not configured.' };
    }

    const userId = await threadsUserId();
    const fields = [
        'id',
        'media_product_type',
        'media_type',
        'media_url',
        'permalink',
        'owner',
        'username',
        'text',
        'timestamp',
        'shortcode',
        'thumbnail_url',
        'children',
        'is_quote_post',
    ].join(',');
    const data = await threadsGet(`${userId || 'me'}/threads`, {
        fields,
        since: isoDateDaysAgo(windowDays),
        until: isoDateDaysAgo(0),
        limit: 50,
    }, token);

    const posts = (Array.isArray(data?.data) ? data.data : []).filter(post => post?.id);
    const rows = [];
    for (const post of posts) {
        let insights = {};
        const warnings = [];
        try {
            insights = await fetchThreadsInsights(post.id, token);
        } catch (err) {
            warnings.push(`insights: ${err.message || err}`);
        }
        rows.push(standardRow({
            id: `threads:${post.id}`,
            platform: 'threads',
            platformLabel: 'Threads',
            externalId: post.id,
            type: String(post.media_type || 'post').toLowerCase(),
            title: post.username ? `@${post.username}` : 'Threads post',
            caption: post.text || '',
            summary: post.is_quote_post ? 'Quote post' : '',
            permalink: post.permalink || '',
            thumbnailUrl: post.thumbnail_url || '',
            mediaUrl: post.media_url || '',
            mediaType: post.media_type || '',
            mediaProductType: post.media_product_type || '',
            previewUrl: signPreviewPath('threads', post.id, post.thumbnail_url ? 'thumb' : 'auto'),
            previewKind: previewKindForMedia({
                thumbnailUrl: post.thumbnail_url,
                mediaType: post.media_type,
                mediaProductType: post.media_product_type,
                type: post.media_type,
            }),
            postedAt: post.timestamp || null,
            syncedAt: new Date().toISOString(),
            metrics: {
                views: insights.views,
                likes: insights.likes,
                replies: insights.replies,
                comments: insights.replies,
                reposts: insights.reposts,
                quotes: insights.quotes,
                shares: insights.shares,
                totalInteractions: toNumber(insights.likes) + toNumber(insights.replies) + toNumber(insights.reposts) + toNumber(insights.quotes) + toNumber(insights.shares),
            },
            warnings,
        }));
    }
    return { configured, rows, error: '' };
}

async function youtubeConfig() {
    const clientId = cleanText(getEnv('YOUTUBE_CLIENT_ID'), 1000) || await privateSecret('youtube_client_id');
    const clientSecret = cleanText(getEnv('YOUTUBE_CLIENT_SECRET'), 1000) || await privateSecret('youtube_client_secret');
    const refreshToken = cleanText(getEnv('YOUTUBE_REFRESH_TOKEN'), 2000) || await privateSecret('youtube_refresh_token');
    return { clientId, clientSecret, refreshToken };
}

async function refreshYoutubeToken(config) {
    const res = await fetch(YOUTUBE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: config.refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.access_token) {
        throw new Error(cleanText(data?.error_description || data?.error || `youtube_oauth_${res.status}`, 400));
    }
    return data.access_token;
}

async function youtubeGet(url, accessToken) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(cleanText(data?.error?.message || data?.error_description || data?.error || `youtube_api_${res.status}`, 400));
    }
    return data;
}

async function loadYoutubeRows(windowDays) {
    const config = await youtubeConfig();
    const configured = Boolean(config.clientId && config.clientSecret && config.refreshToken);
    if (!configured) {
        return { configured, rows: [], error: 'YouTube OAuth is not configured.' };
    }

    const accessToken = await refreshYoutubeToken(config);
    const channelParams = new URLSearchParams({ part: 'contentDetails', mine: 'true' });
    const channelData = await youtubeGet(`${YOUTUBE_CHANNELS_URL}?${channelParams}`, accessToken);
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
    if (!uploadsPlaylistId) return { configured, rows: [], error: 'No YouTube uploads playlist found.' };

    const playlistParams = new URLSearchParams({
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: '50',
    });
    const playlistData = await youtubeGet(`${YOUTUBE_PLAYLIST_ITEMS_URL}?${playlistParams}`, accessToken);
    const cutoff = Date.now() - clampWindowDays(windowDays) * 24 * 60 * 60 * 1000;
    const ids = (playlistData.items || [])
        .filter(item => Date.parse(item.contentDetails?.videoPublishedAt || 0) >= cutoff)
        .map(item => item.contentDetails?.videoId)
        .filter(Boolean)
        .slice(0, 50);
    if (!ids.length) return { configured, rows: [], error: '' };

    const videoParams = new URLSearchParams({
        part: 'snippet,statistics,status,contentDetails',
        id: ids.join(','),
    });
    const videoData = await youtubeGet(`${YOUTUBE_VIDEOS_URL}?${videoParams}`, accessToken);
    const rows = (videoData.items || []).map(video => standardRow({
        id: `youtube:${video.id}`,
        platform: 'youtube',
        platformLabel: 'YouTube',
        externalId: video.id,
        type: 'short/video',
        title: video.snippet?.title || '',
        caption: video.snippet?.description || '',
        summary: video.status?.privacyStatus ? `Visibility: ${video.status.privacyStatus}` : '',
        permalink: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '',
        mediaUrl: '',
        mediaType: 'video',
        mediaProductType: 'video',
        previewUrl: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || '',
        previewKind: 'image',
        postedAt: video.snippet?.publishedAt || null,
        syncedAt: new Date().toISOString(),
        metrics: {
            views: video.statistics?.viewCount,
            likes: video.statistics?.likeCount,
            comments: video.statistics?.commentCount,
            totalInteractions: toNumber(video.statistics?.likeCount) + toNumber(video.statistics?.commentCount),
        },
    }));
    return { configured, rows, error: '' };
}

function summarize(rows, statuses = {}) {
    const byPlatform = {};
    rows.forEach(row => {
        const key = row.platform || 'unknown';
        if (!byPlatform[key]) {
            byPlatform[key] = {
                posts: 0,
                score: 0,
                views: 0,
                likes: 0,
                comments: 0,
                replies: 0,
                shares: 0,
            };
        }
        byPlatform[key].posts += 1;
        byPlatform[key].score += toNumber(row.score);
        byPlatform[key].views += toNumber(row.metrics?.views);
        byPlatform[key].likes += toNumber(row.metrics?.likes);
        byPlatform[key].comments += toNumber(row.metrics?.comments);
        byPlatform[key].replies += toNumber(row.metrics?.replies);
        byPlatform[key].shares += toNumber(row.metrics?.shares);
    });
    return {
        posts: rows.length,
        byPlatform,
        topPost: rows[0] || null,
        statuses,
    };
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { ok: false, error: 'Supabase env missing' });

    const auth = await requireAdmin(event);
    if (auth.response) return auth.response;

    const body = parseBody(event);
    const windowDays = clampWindowDays(body.windowDays || body.window_days || 90);
    const statuses = {
        instagram: { configured: true, ok: false, error: '' },
        threads: { configured: false, ok: false, error: '' },
        youtube: {
            configured: Boolean(getEnv('YOUTUBE_CLIENT_ID') && getEnv('YOUTUBE_REFRESH_TOKEN')),
            ok: false,
            error: '',
        },
        tiktok: {
            configured: Boolean(getEnv('TIKTOK_ACCESS_TOKEN') || getEnv('TIKTOK_REFRESH_TOKEN')),
            ok: false,
            error: 'No stored TikTok post performance table is wired yet.',
        },
    };

    const allRows = [];
    try {
        const instagramRows = await loadInstagramRows(windowDays);
        statuses.instagram.ok = true;
        statuses.instagram.count = instagramRows.length;
        allRows.push(...instagramRows);
    } catch (err) {
        statuses.instagram.error = cleanText(err.message || err, 300);
    }

    try {
        const threads = await loadThreadsRows(windowDays);
        statuses.threads.configured = threads.configured;
        statuses.threads.ok = threads.configured && !threads.error;
        statuses.threads.error = threads.error || '';
        statuses.threads.count = threads.rows.length;
        allRows.push(...threads.rows);
    } catch (err) {
        statuses.threads.configured = true;
        statuses.threads.error = cleanText(err.message || err, 300);
    }

    try {
        const youtube = await loadYoutubeRows(windowDays);
        statuses.youtube.configured = youtube.configured;
        statuses.youtube.ok = youtube.configured && !youtube.error;
        statuses.youtube.error = youtube.error || '';
        statuses.youtube.count = youtube.rows.length;
        allRows.push(...youtube.rows);
    } catch (err) {
        statuses.youtube.configured = true;
        statuses.youtube.error = cleanText(err.message || err, 300);
    }

    const rows = allRows
        .filter(row => row.id)
        .sort((a, b) => toNumber(b.score) - toNumber(a.score) || Date.parse(b.postedAt || 0) - Date.parse(a.postedAt || 0));

    return json(200, {
        ok: true,
        windowDays,
        generatedAt: new Date().toISOString(),
        summary: summarize(rows, statuses),
        rows: rows.slice(0, 120),
    });
};

module.exports._test = {
    clampWindowDays,
    scoreMetrics,
    standardRow,
    insightNumber,
};
