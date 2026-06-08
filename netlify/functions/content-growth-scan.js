/**
 * Cross-platform content growth loop.
 *
 * No dashboard required: this stores metric snapshots and writes a compact
 * growth brief the daily content automation can read.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const YOUTUBE_ANALYTICS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(body, null, 2),
    };
}

function getHeader(headers = {}, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function cleanString(value, max = 1000) {
    return String(value || '').trim().slice(0, max);
}

function safeNumber(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value);
    return fallback;
}

function parseBody(event = {}) {
    try {
        return event.body ? JSON.parse(event.body) : {};
    } catch {
        return {};
    }
}

function isScheduled(event = {}, body = {}) {
    return Boolean(body?.next_run || getHeader(event.headers, 'x-nf-event').toLowerCase() === 'schedule');
}

function secrets() {
    return [
        process.env.BALANCE_CONTENT_AUTOMATION_SECRET,
        process.env.IG_STORY_BOT_BRIDGE_SECRET,
        process.env.META_IG_SYNC_SECRET,
    ].map(value => cleanString(value, 500)).filter(Boolean);
}

function isAuthorized(event = {}, body = {}) {
    if (process.env.CONTEXT === 'dev') return true;
    if (isScheduled(event, body)) return true;
    const provided = cleanString(
        getHeader(event.headers, 'x-balance-content-secret')
        || getHeader(event.headers, 'x-ig-story-secret')
        || body.secret,
        500
    );
    return Boolean(provided && secrets().includes(provided));
}

async function supabaseFetch(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase env missing');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.prefer ? { Prefer: options.prefer } : {}),
            ...(options.headers || {}),
        },
        body: options.body == null ? undefined : JSON.stringify(options.body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
        const detail = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`Supabase ${res.status}: ${detail.slice(0, 500)}`);
    }
    return data || [];
}

async function execSqlJson(sql) {
    return supabaseFetch('rpc/exec_sql_json', {
        method: 'POST',
        body: { sql },
    });
}

function sqlText(value) {
    return String(value || '').replace(/'/g, "''");
}

function formBody(params) {
    const body = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
    });
    return body;
}

async function youtubeAccessToken() {
    const clientId = process.env.YOUTUBE_CLIENT_ID || '';
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || '';
    if (!clientId || !clientSecret || !refreshToken) throw new Error('missing_youtube_oauth_env');

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formBody({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || `youtube_oauth_${res.status}`);
    }
    return data.access_token;
}

async function youtubeGet(url, token) {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data?.error?.message || data?.error_description || data?.error || `youtube_api_${res.status}`;
        throw new Error(String(message).slice(0, 500));
    }
    return data;
}

function inferLane(value = '') {
    const text = String(value || '').toLowerCase();
    if (/\bproof pulse|inside balance|weekly wins|check-?ins?|pbs?\b/.test(text)) return 'proof';
    if (/\bpaper|study|science|review|research|health science\b/.test(text)) return 'science';
    if (/\bbench|squat|pulldown|push up|press|row|deadlift|form cue|exercise|workout|push day|pull day|leg day\b/.test(text)) return 'exercise';
    if (/\bstory\b/.test(text)) return 'story';
    return 'unknown';
}

function sourceKey(platform, id) {
    return `${platform}:${id}`;
}

function nextMetricsAt(postedAt) {
    const posted = postedAt ? new Date(postedAt).getTime() : Date.now();
    const ageHours = Math.max(0, (Date.now() - posted) / 36e5);
    let hours = 168;
    if (ageHours < 24) hours = 1;
    else if (ageHours < 72) hours = 6;
    else if (ageHours < 336) hours = 24;
    return new Date(Date.now() + hours * 36e5).toISOString();
}

async function upsertPlatformPost(row) {
    const nowIso = new Date().toISOString();
    const payload = {
        source_key: row.source_key || sourceKey(row.platform, row.platform_post_id),
        platform: row.platform,
        platform_post_id: String(row.platform_post_id),
        platform_permalink: row.platform_permalink || null,
        content_item_id: row.content_item_id || null,
        content_lane: row.content_lane || inferLane(`${row.title || ''} ${row.caption || ''}`),
        source_id: row.source_id || null,
        title: row.title || null,
        caption: row.caption || null,
        asset_url: row.asset_url || null,
        thumbnail_url: row.thumbnail_url || null,
        posted_at: row.posted_at || null,
        status: row.status || 'active',
        metadata: row.metadata || {},
        next_metrics_at: row.next_metrics_at || nowIso,
    };
    const rows = await supabaseFetch('content_platform_posts?on_conflict=platform,platform_post_id', {
        method: 'POST',
        body: [payload],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}

async function updatePlatformPost(id, patch) {
    const rows = await supabaseFetch(`content_platform_posts?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=representation',
    });
    return rows[0] || null;
}

async function insertSnapshot(post, metrics) {
    const snapshot = {
        platform_post_id: post.id,
        platform: post.platform,
        views: Math.max(0, Math.round(metrics.views || 0)),
        reach: metrics.reach == null ? null : Math.max(0, Math.round(metrics.reach || 0)),
        impressions: metrics.impressions == null ? null : Math.max(0, Math.round(metrics.impressions || 0)),
        likes: Math.max(0, Math.round(metrics.likes || 0)),
        comments: Math.max(0, Math.round(metrics.comments || 0)),
        shares: Math.max(0, Math.round(metrics.shares || 0)),
        saves: Math.max(0, Math.round(metrics.saves || 0)),
        follows_gained: Math.max(0, Math.round(metrics.follows_gained || 0)),
        subscribers_gained: Math.max(0, Math.round(metrics.subscribers_gained || 0)),
        watch_time_minutes: metrics.watch_time_minutes == null ? null : Number(metrics.watch_time_minutes),
        average_view_duration_seconds: metrics.average_view_duration_seconds == null ? null : Number(metrics.average_view_duration_seconds),
        average_view_percentage: metrics.average_view_percentage == null ? null : Number(metrics.average_view_percentage),
        engagement_score: Number(metrics.engagement_score || 0),
        raw_metrics: metrics.raw_metrics || {},
    };
    const rows = await supabaseFetch('content_metric_snapshots', {
        method: 'POST',
        body: [snapshot],
        prefer: 'return=representation',
    });
    await updatePlatformPost(post.id, {
        last_metrics_at: new Date().toISOString(),
        next_metrics_at: nextMetricsAt(post.posted_at),
        metadata: {
            ...(post.metadata || {}),
            latest_metrics: snapshot,
            latest_metrics_at: new Date().toISOString(),
        },
    });
    return rows[0] || null;
}

function insightNumber(raw, keys, fallback = 0) {
    for (const key of keys) {
        const value = raw?.latest_insights?.[key] ?? raw?.insights?.[key] ?? raw?.latest_counts?.[key] ?? raw?.counts?.[key];
        const n = safeNumber(value, NaN);
        if (Number.isFinite(n)) return n;
    }
    return fallback;
}

function instagramMetricsFromRaw(rawPayload = {}) {
    const views = insightNumber(rawPayload, ['views', 'plays', 'video_views', 'ig_reels_aggregated_all_plays_count', 'clips_replays_count'], 0);
    const reach = insightNumber(rawPayload, ['reach'], NaN);
    const impressions = insightNumber(rawPayload, ['impressions'], NaN);
    const likes = insightNumber(rawPayload, ['likes', 'like_count'], 0);
    const comments = insightNumber(rawPayload, ['comments', 'comments_count'], 0);
    const shares = insightNumber(rawPayload, ['shares'], 0);
    const saves = insightNumber(rawPayload, ['saved', 'saves'], 0);
    const follows = insightNumber(rawPayload, ['follows'], 0);
    const avgWatchRaw = insightNumber(rawPayload, ['ig_reels_avg_watch_time'], NaN);
    const totalWatchRaw = insightNumber(rawPayload, ['ig_reels_video_view_total_time'], NaN);
    const avgWatchSeconds = Number.isFinite(avgWatchRaw)
        ? (avgWatchRaw > 1000 ? avgWatchRaw / 1000 : avgWatchRaw)
        : null;
    const watchMinutes = Number.isFinite(totalWatchRaw)
        ? (totalWatchRaw > 1000 ? totalWatchRaw / 60000 : totalWatchRaw / 60)
        : null;

    return {
        views,
        reach: Number.isFinite(reach) ? reach : null,
        impressions: Number.isFinite(impressions) ? impressions : null,
        likes,
        comments,
        shares,
        saves,
        follows_gained: follows,
        watch_time_minutes: watchMinutes,
        average_view_duration_seconds: avgWatchSeconds,
        average_view_percentage: null,
        engagement_score: likes + comments * 2 + shares * 4 + saves * 4 + follows * 8,
        raw_metrics: rawPayload,
    };
}

async function syncInstagramPosts(limit = 80) {
    const rows = await supabaseFetch(
        `ig_content_items?select=id,source_key,ig_media_id,ig_story_id,content_type,media_product_type,caption,permalink,media_url,thumbnail_url,posted_at,raw_payload&order=posted_at.desc.nullslast,created_at.desc&limit=${Math.max(1, Math.min(200, Number(limit) || 80))}`
    );
    const synced = [];
    for (const item of rows || []) {
        const platformId = item.ig_media_id || item.ig_story_id;
        if (!platformId) continue;
        const title = cleanString((item.caption || '').split(/\n+/)[0], 160) || `${item.content_type || 'Instagram'} content`;
        const post = await upsertPlatformPost({
            platform: 'instagram',
            platform_post_id: platformId,
            platform_permalink: item.permalink || null,
            content_item_id: item.id,
            content_lane: inferLane(`${item.content_type || ''} ${item.caption || ''}`),
            title,
            caption: item.caption || null,
            asset_url: item.media_url || null,
            thumbnail_url: item.thumbnail_url || null,
            posted_at: item.posted_at || null,
            status: item.content_type === 'story' ? 'active' : 'posted',
            metadata: {
                ig_content_source_key: item.source_key,
                content_type: item.content_type,
                media_product_type: item.media_product_type,
            },
        });
        if (post) synced.push(post);
    }
    return synced;
}

async function syncYoutubeRecent(limit = 25) {
    const token = await youtubeAccessToken();
    const searchParams = new URLSearchParams({
        part: 'snippet',
        forMine: 'true',
        type: 'video',
        order: 'date',
        maxResults: String(Math.max(1, Math.min(50, Number(limit) || 25))),
    });
    const search = await youtubeGet(`${YOUTUBE_SEARCH_URL}?${searchParams}`, token);
    const ids = (search.items || []).map(item => item.id?.videoId).filter(Boolean);
    if (!ids.length) return [];

    const detailParams = new URLSearchParams({
        part: 'snippet,status,contentDetails,statistics',
        id: ids.join(','),
    });
    const details = await youtubeGet(`${YOUTUBE_VIDEOS_URL}?${detailParams}`, token);
    const synced = [];
    for (const item of details.items || []) {
        const post = await upsertPlatformPost({
            platform: 'youtube',
            platform_post_id: item.id,
            platform_permalink: `https://www.youtube.com/shorts/${item.id}`,
            content_lane: inferLane(`${item.snippet?.title || ''} ${item.snippet?.description || ''}`),
            title: item.snippet?.title || '',
            caption: item.snippet?.description || '',
            thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || null,
            posted_at: item.snippet?.publishedAt || null,
            status: item.status?.privacyStatus === 'private' ? 'private' : 'posted',
            metadata: {
                youtube_status: item.status || {},
                duration: item.contentDetails?.duration || '',
                latest_youtube_statistics: item.statistics || {},
            },
        });
        if (post) synced.push(post);
    }
    return synced;
}

async function instagramMetricsForPost(post) {
    if (!post.content_item_id) return null;
    const rows = await supabaseFetch(
        `ig_content_items?select=raw_payload&id=eq.${encodeURIComponent(post.content_item_id)}&limit=1`
    );
    const rawPayload = rows?.[0]?.raw_payload || {};
    return instagramMetricsFromRaw(rawPayload);
}

function youtubeAnalyticsRowToMetrics(row, stats = {}) {
    const views = safeNumber(row?.[1], safeNumber(stats.viewCount, 0));
    const watchMinutes = safeNumber(row?.[2], null);
    const avgDuration = safeNumber(row?.[3], null);
    const avgPercentage = safeNumber(row?.[4], null);
    const likes = safeNumber(row?.[5], safeNumber(stats.likeCount, 0));
    const comments = safeNumber(row?.[6], safeNumber(stats.commentCount, 0));
    const shares = safeNumber(row?.[7], 0);
    const subscribers = safeNumber(row?.[8], 0);
    return {
        views,
        reach: null,
        impressions: null,
        likes,
        comments,
        shares,
        saves: 0,
        subscribers_gained: subscribers,
        watch_time_minutes: watchMinutes,
        average_view_duration_seconds: avgDuration,
        average_view_percentage: avgPercentage,
        engagement_score: likes + comments * 2 + shares * 4 + subscribers * 10,
    };
}

function isoDate(daysAgo) {
    return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function youtubeMetricsForPost(post) {
    const token = await youtubeAccessToken();
    const videoParams = new URLSearchParams({
        part: 'snippet,statistics,status,contentDetails',
        id: post.platform_post_id,
    });
    const videoData = await youtubeGet(`${YOUTUBE_VIDEOS_URL}?${videoParams}`, token);
    const video = videoData.items?.[0] || null;
    if (!video) return null;

    const analyticsParams = new URLSearchParams({
        ids: 'channel==MINE',
        startDate: isoDate(30),
        endDate: isoDate(0),
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
        dimensions: 'video',
        filters: `video==${post.platform_post_id}`,
    });
    let analytics = { columnHeaders: [], rows: [] };
    try {
        analytics = await youtubeGet(`${YOUTUBE_ANALYTICS_URL}?${analyticsParams}`, token);
    } catch (err) {
        analytics = { error: err.message, columnHeaders: [], rows: [] };
    }
    return {
        ...youtubeAnalyticsRowToMetrics(analytics.rows?.[0], video.statistics || {}),
        raw_metrics: {
            video,
            analytics,
        },
    };
}

async function duePosts(limit = 40) {
    const nowIso = encodeURIComponent(new Date().toISOString());
    return supabaseFetch(
        `content_platform_posts?select=*&status=in.(posted,active,private)&next_metrics_at=lte.${nowIso}&order=next_metrics_at.asc&limit=${Math.max(1, Math.min(100, Number(limit) || 40))}`
    );
}

async function collectMetricsForPost(post) {
    if (post.platform === 'instagram') return instagramMetricsForPost(post);
    if (post.platform === 'youtube') return youtubeMetricsForPost(post);
    return null;
}

async function scanMetrics(options = {}) {
    const synced = { instagram: [], youtube: [] };
    const errors = [];
    try {
        synced.instagram = await syncInstagramPosts(options.instagramLimit || 25);
    } catch (err) {
        errors.push({ stage: 'sync_instagram', error: err.message });
    }
    try {
        synced.youtube = await syncYoutubeRecent(options.youtubeLimit || 8);
    } catch (err) {
        errors.push({ stage: 'sync_youtube', error: err.message });
    }

    const posts = await duePosts(options.limit || 6);
    const snapshots = [];
    for (const post of posts) {
        try {
            const metrics = await collectMetricsForPost(post);
            if (!metrics) {
                await updatePlatformPost(post.id, {
                    next_metrics_at: nextMetricsAt(post.posted_at),
                    metadata: { ...(post.metadata || {}), latest_metrics_error: 'metrics_unavailable' },
                });
                continue;
            }
            snapshots.push(await insertSnapshot(post, metrics));
        } catch (err) {
            errors.push({ stage: 'snapshot', platform: post.platform, postId: post.platform_post_id, error: err.message });
            await updatePlatformPost(post.id, {
                next_metrics_at: nextMetricsAt(post.posted_at),
                metadata: { ...(post.metadata || {}), latest_metrics_error: err.message },
            }).catch(() => null);
        }
    }

    const brief = await createGrowthBrief(options.windowHours || 168).catch(err => {
        errors.push({ stage: 'growth_brief', error: err.message });
        return null;
    });

    return { synced, scanned: posts.length, snapshots, brief, errors };
}

function rowScore(row = {}) {
    return safeNumber(row.views) + safeNumber(row.engagement_score) * 12 + safeNumber(row.shares) * 18 + safeNumber(row.saves) * 14;
}

function recommendationFromRows(rows = []) {
    const byLane = new Map();
    const byPlatform = new Map();
    rows.forEach(row => {
        const lane = row.content_lane || 'unknown';
        const platform = row.platform || 'unknown';
        byLane.set(lane, (byLane.get(lane) || 0) + rowScore(row));
        byPlatform.set(platform, (byPlatform.get(platform) || 0) + rowScore(row));
    });
    const topLane = [...byLane.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'exercise';
    const topPlatform = [...byPlatform.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'instagram';
    const top = rows[0] || null;
    const recs = [];
    if (top) {
        recs.push({
            type: 'remake_winner',
            priority: 'high',
            text: `Remake or follow up "${top.title || top.platform_post_id}" because it is the strongest recent ${top.platform} signal.`,
            platform: top.platform,
            lane: top.content_lane,
            post_id: top.platform_post_id,
        });
    }
    recs.push({
        type: 'lane_bias',
        priority: 'medium',
        text: `Bias the next content pick toward ${topLane} unless today's fixed lane says otherwise.`,
        lane: topLane,
    });
    recs.push({
        type: 'platform_bias',
        priority: 'medium',
        text: `Use ${topPlatform} performance as the first reference when choosing hook style.`,
        platform: topPlatform,
    });
    return recs;
}

function platformNotes(rows = []) {
    const notes = {};
    for (const platform of ['instagram', 'youtube', 'tiktok']) {
        const set = rows.filter(row => row.platform === platform);
        if (!set.length) {
            notes[platform] = { count: 0, note: 'No tracked posts yet.' };
            continue;
        }
        const views = set.reduce((sum, row) => sum + safeNumber(row.views), 0);
        const engagement = set.reduce((sum, row) => sum + safeNumber(row.engagement_score), 0);
        notes[platform] = {
            count: set.length,
            views,
            engagement_score: engagement,
            note: `${set.length} tracked posts, ${views} views, engagement score ${Math.round(engagement)}.`,
        };
    }
    return notes;
}

async function createGrowthBrief(windowHours = 168) {
    const hours = Math.max(24, Math.min(720, Number(windowHours) || 168));
    const rows = await execSqlJson(`
        WITH latest AS (
            SELECT DISTINCT ON (s.platform_post_id)
                p.platform,
                p.platform_post_id,
                p.platform_permalink,
                p.content_lane,
                p.title,
                p.caption,
                p.posted_at,
                s.snapshot_at,
                s.views,
                s.likes,
                s.comments,
                s.shares,
                s.saves,
                s.follows_gained,
                s.subscribers_gained,
                s.watch_time_minutes,
                s.average_view_duration_seconds,
                s.average_view_percentage,
                s.engagement_score
            FROM public.content_metric_snapshots s
            JOIN public.content_platform_posts p ON p.id = s.platform_post_id
            WHERE s.snapshot_at >= NOW() - (INTERVAL '1 hour' * ${hours})
            ORDER BY s.platform_post_id, s.snapshot_at DESC
        )
        SELECT *
        FROM latest
        ORDER BY (
            COALESCE(views, 0)
            + COALESCE(engagement_score, 0) * 12
            + COALESCE(shares, 0) * 18
            + COALESCE(saves, 0) * 14
        ) DESC,
        snapshot_at DESC
        LIMIT 40
    `);
    const winners = rows.slice(0, 8);
    const recommendations = recommendationFromRows(rows);
    const notes = platformNotes(rows);
    const summary = winners.length
        ? `Tracked ${rows.length} recent platform posts. Current strongest signal: ${winners[0].title || winners[0].platform_post_id} on ${winners[0].platform}.`
        : 'No content metric snapshots yet. Keep posting and the scanner will build a baseline.';

    const inserted = await supabaseFetch('content_growth_briefs', {
        method: 'POST',
        body: [{
            window_hours: hours,
            status: rows.length ? 'completed' : 'partial',
            summary,
            recommendations,
            winners,
            platform_notes: notes,
            raw_metrics: { rows },
        }],
        prefer: 'return=representation',
    });
    return inserted[0] || null;
}

async function latestBrief() {
    const rows = await supabaseFetch('content_growth_briefs?select=*&order=generated_at.desc&limit=1');
    return rows[0] || null;
}

exports.handler = async (event = {}) => {
    const body = parseBody(event);
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    if (!isAuthorized(event, body)) return json(401, { ok: false, error: 'unauthorized' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { ok: false, error: 'supabase_env_missing' });

    const action = isScheduled(event, body) ? 'scan' : String(body.action || 'scan').toLowerCase();
    try {
        if (action === 'latest' || action === 'latest-brief') {
            return json(200, { ok: true, brief: await latestBrief() });
        }
        if (action === 'register-post') {
            const post = await upsertPlatformPost({
                platform: cleanString(body.platform, 40),
                platform_post_id: cleanString(body.platformPostId || body.videoId || body.mediaId, 200),
                platform_permalink: body.permalink || body.url || null,
                content_lane: body.lane || body.contentLane || 'unknown',
                source_id: body.sourceId || null,
                title: body.title || null,
                caption: body.caption || null,
                asset_url: body.assetUrl || body.mediaUrl || null,
                thumbnail_url: body.thumbnailUrl || null,
                posted_at: body.postedAt || null,
                status: body.status || 'posted',
                metadata: body.metadata || {},
            });
            return json(200, { ok: true, post });
        }
        if (action === 'brief') {
            return json(200, { ok: true, brief: await createGrowthBrief(body.windowHours || body.window_hours || 168) });
        }
        if (action !== 'scan') return json(400, { ok: false, error: 'unknown_action', action });

        const result = await scanMetrics({
            limit: body.limit,
            instagramLimit: body.instagramLimit,
            youtubeLimit: body.youtubeLimit,
            windowHours: body.windowHours || body.window_hours,
        });
        return json(200, { ok: true, ...result });
    } catch (error) {
        console.error('[content-growth-scan] failed:', error);
        return json(500, { ok: false, error: error.message || 'content_growth_scan_failed' });
    }
};

module.exports._test = {
    inferLane,
    instagramMetricsFromRaw,
    recommendationFromRows,
    rowScore,
};
