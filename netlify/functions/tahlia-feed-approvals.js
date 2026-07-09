/**
 * Returns Tahlia's pending Feed posts and comments to Shannon only.
 *
 * Pending items remain coach_alert drafts. The Balance Feed merges this safe
 * projection into its normal renderer so Shannon can review the exact card,
 * comment context, and chronological placement before publishing.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SHANNON_EMAIL = 'shannonrhysbirch@gmail.com';
const TAHLIA_EMAIL = 'seed.tahlia.brooks+kayla30@plantbased-balance.org';
const TAHLIA_SOURCE = 'tahlia-social-worker';
const ALLOWED_POST_MEDIA_TYPES = new Set(['text', 'workout_card', 'checkin_card']);

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-store, max-age=0',
        },
        body: JSON.stringify(body),
    };
}

function cleanText(value = '', max = 500) {
    return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function safeIso(value, fallback) {
    const parsed = value ? new Date(value) : null;
    if (parsed && Number.isFinite(parsed.getTime())) return parsed.toISOString();
    const fallbackDate = fallback ? new Date(fallback) : new Date();
    return Number.isFinite(fallbackDate.getTime()) ? fallbackDate.toISOString() : new Date().toISOString();
}

function findPendingTahliaAction(alert = {}) {
    const data = alert.data && typeof alert.data === 'object' ? alert.data : {};
    if (alert.status !== 'pending') return null;
    if (data.source !== TAHLIA_SOURCE || data.subtype !== 'tahlia_social_approval') return null;
    if (data.needs_shannon_approval !== true || data.operator_queue !== 'needs_you') return null;
    const actions = Array.isArray(data.proposed_actions) ? data.proposed_actions : [];
    return actions.find(action => action
        && (!action.status || action.status === 'pending')
        && ['publish_tahlia_feed_post', 'publish_tahlia_feed_comment'].includes(action.type)) || null;
}

function intendedCreatedAt(alert = {}, action = {}) {
    const data = alert.data || {};
    const payload = action.payload || {};
    const evidence = data.evidence || {};
    if (action.type === 'publish_tahlia_feed_post') {
        return safeIso(
            payload.proposed_created_at || evidence.source_created_at || data.drafted_at,
            alert.created_at
        );
    }
    return safeIso(
        payload.proposed_created_at || data.drafted_at,
        alert.created_at
    );
}

function buildFeedApprovalProjection(alerts = [], tahliaUser = {}) {
    const posts = [];
    const comments = [];

    for (const alert of alerts || []) {
        const action = findPendingTahliaAction(alert);
        if (!action) continue;
        const data = alert.data || {};
        const payload = action.payload || {};
        const createdAt = intendedCreatedAt(alert, action);
        const common = {
            pending_tahlia_approval: true,
            approval_alert_id: alert.id,
            approval_action_id: action.id,
            approval_created_at: alert.created_at || createdAt,
            created_at: createdAt,
        };

        if (action.type === 'publish_tahlia_feed_post') {
            const mediaType = cleanText(payload.media_type || 'text', 40) || 'text';
            if (!ALLOWED_POST_MEDIA_TYPES.has(mediaType)) continue;
            if (payload.media_url || payload.thumbnail_url) continue;
            const caption = typeof payload.caption === 'string'
                ? payload.caption.slice(0, 6000)
                : cleanText(data.draft_text || action.preview || '', 500);
            if (!caption) continue;
            posts.push({
                ...common,
                story_id: `pending-tahlia-${alert.id}`,
                id: `pending-tahlia-${alert.id}`,
                user_id: tahliaUser.id || payload.user_id || data.tahlia_user_id || null,
                user_name: tahliaUser.name || data.tahlia_display_name || 'Tahlia Brooks',
                user_email: tahliaUser.email || TAHLIA_EMAIL,
                profile_photo: tahliaUser.profile_photo || null,
                media_type: mediaType,
                media_url: null,
                thumbnail_url: null,
                caption,
                duration: 5,
                background_color: cleanText(payload.background_color || '#f8fafc', 24) || '#f8fafc',
                view_count: 0,
                expires_at: new Date(new Date(createdAt).getTime() + (365 * 24 * 60 * 60 * 1000)).toISOString(),
                has_viewed: true,
                story_count: 1,
            });
            continue;
        }

        const storyId = cleanText(payload.story_id || data.target_story_id || '', 80);
        const commentText = cleanText(payload.comment_text || data.draft_text || action.preview || '', 500);
        if (!storyId || !commentText) continue;
        comments.push({
            ...common,
            comment_id: `pending-tahlia-${alert.id}`,
            id: `pending-tahlia-${alert.id}`,
            story_id: storyId,
            user_id: tahliaUser.id || payload.user_id || data.tahlia_user_id || null,
            user_name: tahliaUser.name || data.tahlia_display_name || 'Tahlia Brooks',
            profile_photo: tahliaUser.profile_photo || null,
            comment_text: commentText,
            like_count: 0,
            liked_by_me: false,
            mentions: [],
        });
    }

    posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    comments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { posts, comments };
}

async function serviceQuery(path) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${path} -> ${response.status} ${text}`);
    return text ? JSON.parse(text) : [];
}

async function authenticatedUser(event = {}) {
    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    const token = String(authorization).replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) return null;
    return response.json();
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    const user = await authenticatedUser(event).catch(() => null);
    if (!user?.id) return json(401, { error: 'Authentication required' });
    if (String(user.email || '').toLowerCase() !== SHANNON_EMAIL) {
        return json(403, { error: 'Feed approvals are private' });
    }

    try {
        const [alerts, tahliaRows] = await Promise.all([
            serviceQuery('coach_alerts?select=id,status,created_at,data&status=eq.pending&client_name=eq.Tahlia%20Brooks&order=created_at.desc&limit=50'),
            serviceQuery(`users?select=id,name,email,profile_photo&email=eq.${encodeURIComponent(TAHLIA_EMAIL)}&limit=1`),
        ]);
        const projection = buildFeedApprovalProjection(alerts, tahliaRows[0] || {});
        return json(200, { ok: true, ...projection });
    } catch (error) {
        console.error('[tahlia-feed-approvals] load failed:', error.message);
        return json(500, { error: 'Could not load private Feed approvals' });
    }
};

exports._test = {
    findPendingTahliaAction,
    intendedCreatedAt,
    buildFeedApprovalProjection,
};
