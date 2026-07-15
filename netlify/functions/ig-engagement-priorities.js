/**
 * Returns the current relationship and engagement state for IG conversations.
 *
 * The admin dashboard uses the complete labelled list. The browser Story bot
 * can only request the Story-ready queue, authenticated with its existing
 * bridge secret. That queue deliberately excludes clients, direct replies
 * owed, dead leads, and anyone contacted in the last 20 hours.
 */

const crypto = require('crypto');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, supabaseQuery } = require('./_lib/client-context');
const { claimNextActions, seedStoryActions } = require('./_lib/ig-next-action-queue');

const SHARED_SECRET = process.env.IG_STORY_BOT_BRIDGE_SECRET || process.env.STORY_COMMENT_BRIDGE_SECRET || '';
const MAX_LIMIT = 1000;
const STORY_QUEUE_MAX_LIMIT = 50;
// Browser micro-shifts stop claiming after 22 minutes. Keep Story leases just
// beyond that window so a dead run does not starve the next half-hour shift.
const STORY_CLAIM_LEASE_SECONDS = 25 * 60;

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

function getHeader(headers = {}, name) {
    const target = String(name || '').toLowerCase();
    const key = Object.keys(headers).find(header => header.toLowerCase() === target);
    return key ? headers[key] : '';
}

function parseBearerToken(event = {}) {
    return String(getHeader(event.headers, 'authorization') || '')
        .replace(/^Bearer\s+/i, '')
        .trim();
}

function safeEqual(left, right) {
    const a = Buffer.from(String(left || ''));
    const b = Buffer.from(String(right || ''));
    return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function isStoryBotAuthorized(event = {}) {
    if (!SHARED_SECRET) return process.env.CONTEXT === 'dev' || process.env.NODE_ENV === 'test';
    const provided = String(
        getHeader(event.headers, 'x-story-bot-secret')
        || parseBearerToken(event)
        || ''
    ).trim();
    return safeEqual(provided, SHARED_SECRET);
}

function clampLimit(value, maximum = MAX_LIMIT, fallback = 200) {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(parsed, maximum));
}

async function verifyAdminToken(event = {}) {
    const token = parseBearerToken(event);
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!userResponse.ok) return null;
    const user = await userResponse.json().catch(() => null);
    if (!user?.id) return null;

    const rows = await supabaseQuery(
        `admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`
    );
    return rows[0]?.user_id === user.id ? user : null;
}

function cleanHandle(value) {
    return String(value || '').trim().replace(/^@+/, '');
}

function mapPriorityRow(row = {}) {
    const handle = cleanHandle(row.ig_username);
    return {
        threadId: row.thread_id,
        coachId: row.coach_id || null,
        channel: row.channel || 'instagram',
        igUsername: handle || null,
        profileName: row.profile_name || handle || 'Lead',
        leadStage: row.lead_stage || 'new',
        linkedUserId: row.linked_user_id || null,
        qualifier: row.qualifier || {},
        lastInboundAt: row.last_inbound_at || null,
        lastOutboundAt: row.last_outbound_at || null,
        relationshipKind: row.relationship_kind || 'lead',
        engagementTemperature: row.engagement_temperature || 'cold',
        engagementLabel: row.engagement_label || row.engagement_temperature || 'cold',
        engagementReason: row.engagement_reason || '',
        priorityScore: Number(row.priority_score || 0),
        unansweredOutboundCount: Number(row.unanswered_outbound_count || 0),
        deadUntil: row.dead_until || null,
        pendingDmReply: row.has_pending_dm_reply === true || row.open_dm_needs_reply === true,
        storyOutreachEligible: row.story_outreach_eligible === true,
        storyOutreachBlockReason: row.story_outreach_block_reason || null,
        profileUrl: handle ? `https://www.instagram.com/${handle}/` : null,
    };
}

function buildSummary(rows = []) {
    const labels = { client: 0, hot: 0, warm: 0, cold: 0, dead: 0 };
    const storyReady = { hot: 0, warm: 0, cold: 0 };
    rows.forEach(row => {
        const label = String(row.engagementLabel || '').toLowerCase();
        if (Object.prototype.hasOwnProperty.call(labels, label)) labels[label] += 1;
        const temperature = String(row.engagementTemperature || '').toLowerCase();
        if (row.storyOutreachEligible && Object.prototype.hasOwnProperty.call(storyReady, temperature)) {
            storyReady[temperature] += 1;
        }
    });
    return { labels, storyReady, total: rows.length };
}

async function loadRows({ storyOnly = false, limit }) {
    const select = [
        'thread_id', 'coach_id', 'channel', 'ig_username', 'profile_name', 'lead_stage',
        'linked_user_id', 'qualifier', 'last_inbound_at', 'last_outbound_at',
        'relationship_kind', 'engagement_temperature', 'engagement_label',
        'engagement_reason', 'priority_score', 'unanswered_outbound_count', 'dead_until',
        'has_pending_dm_reply', 'open_dm_needs_reply', 'story_outreach_eligible',
        'story_outreach_block_reason', 'is_test_account', 'is_merged',
    ].join(',');
    const filters = [
        `select=${select}`,
        'is_test_account=eq.false',
        'is_merged=eq.false',
    ];
    if (storyOnly) {
        filters.push(
            'relationship_kind=eq.lead',
            'story_outreach_eligible=eq.true',
            'order=priority_score.desc,last_inbound_at.desc.nullslast',
            `limit=${clampLimit(limit, STORY_QUEUE_MAX_LIMIT, 20)}`
        );
    } else {
        filters.push(
            'order=priority_score.desc,last_inbound_at.desc.nullslast',
            `limit=${clampLimit(limit, MAX_LIMIT, 500)}`
        );
    }
    return supabaseQuery(`ig_thread_engagement_snapshot?${filters.join('&')}`);
}

function mapClaimedStoryRows(claimed = [], candidates = []) {
    const byThreadId = new Map(candidates.map(row => [row.thread_id, row]));
    return claimed
        .map(action => {
            const row = byThreadId.get(action.thread_id);
            if (!row) return null;
            return {
                ...mapPriorityRow(row),
                nextAction: {
                    id: action.id,
                    type: action.action_type,
                    version: action.action_version,
                    claimToken: action.claim_token,
                    claimExpiresAt: action.claim_expires_at,
                },
            };
        })
        .filter(Boolean);
}

async function loadClaimedStoryRows(limit) {
    // Load a little deeper than the requested batch so a temporarily claimed
    // lead does not make the current run come up short.
    const requested = clampLimit(limit, STORY_QUEUE_MAX_LIMIT, 20);
    const candidates = await loadRows({ storyOnly: true, limit: Math.min(MAX_LIMIT, requested * 4) });
    await seedStoryActions(candidates);
    const claimed = await claimNextActions({
        owner: 'story_operator',
        limit: requested,
        leaseSeconds: STORY_CLAIM_LEASE_SECONDS,
        runId: `story-priorities:${new Date().toISOString()}`,
        threadIds: candidates.map(row => row.thread_id).filter(Boolean),
    });
    return mapClaimedStoryRows(claimed, candidates);
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });

    const query = event.queryStringParameters || {};
    const requestedScope = String(query.scope || '').toLowerCase();
    const storyBot = isStoryBotAuthorized(event);
    const storyOnly = storyBot && requestedScope !== 'admin';
    const admin = storyBot ? null : await verifyAdminToken(event);
    if (!storyBot && !admin) return json(401, { error: 'Unauthorized' });
    if (requestedScope === 'admin' && !admin) return json(403, { error: 'Forbidden' });

    try {
        const rows = storyOnly
            ? await loadClaimedStoryRows(query.limit)
            : (await loadRows({ storyOnly, limit: query.limit })).map(mapPriorityRow);
        return json(200, {
            ok: true,
            scope: storyOnly ? 'story' : 'admin',
            summary: storyOnly ? null : buildSummary(rows),
            targets: rows,
        });
    } catch (error) {
        console.error('[ig-engagement-priorities] query failed:', error.message || error);
        return json(500, { error: 'Unable to load Instagram engagement priorities' });
    }
};

exports._test = {
    clampLimit,
    mapPriorityRow,
    mapClaimedStoryRows,
    buildSummary,
    safeEqual,
    STORY_CLAIM_LEASE_SECONDS,
};
