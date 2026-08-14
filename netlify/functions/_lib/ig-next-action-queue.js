const { supabaseQuery } = require('./client-context');

const OWNERS = new Set([
    'dm_manager',
    'codex_live_worker',
    'browser_dispatcher',
    'story_operator',
    'external_comment_operator',
    'follower_operator',
    'feed_operator',
    'discovery_operator',
    'onboarding',
    'manual',
]);

function cleanOwner(value = '') {
    const owner = String(value || '').trim().toLowerCase();
    if (!OWNERS.has(owner)) throw new Error('Invalid IG next-action owner');
    return owner;
}

function clampInteger(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(parsed, maximum));
}

async function claimNextActions({ owner, limit = 20, leaseSeconds = 900, runId = null, threadIds = null } = {}) {
    return supabaseQuery('rpc/claim_ig_next_actions', {
        method: 'POST',
        body: {
            p_owner: cleanOwner(owner),
            p_limit: clampInteger(limit, 20, 1, 100),
            p_lease_seconds: clampInteger(leaseSeconds, 900, 60, 7200),
            p_run_id: runId ? String(runId).slice(0, 180) : null,
            p_thread_ids: Array.isArray(threadIds) && threadIds.length ? threadIds : null,
        },
    });
}

async function completeNextAction({ actionId, claimToken, status = 'waiting', safeAfter = null, receipt = {} } = {}) {
    if (!actionId || !claimToken) throw new Error('Action id and claim token are required');
    return supabaseQuery('rpc/complete_ig_next_action', {
        method: 'POST',
        body: {
            p_action_id: actionId,
            p_claim_token: claimToken,
            p_status: status,
            p_safe_after: safeAfter,
            p_receipt: receipt && typeof receipt === 'object' ? receipt : {},
        },
    });
}

async function seedStoryActions(rows = []) {
    const results = [];
    for (const row of rows) {
        if (!row?.thread_id || !row?.ig_username || row.story_outreach_eligible !== true) continue;
        results.push(await supabaseQuery('rpc/upsert_ig_next_action', {
            method: 'POST',
            body: {
                p_thread_id: row.thread_id,
                p_ig_username: row.ig_username,
                p_lead_state: row.engagement_label || row.engagement_temperature || 'cold',
                p_owner: 'story_operator',
                p_action_type: 'story_reply',
                p_priority: Math.max(0, Math.min(Number(row.priority_score || 0), 10000)),
                p_due_at: new Date().toISOString(),
                p_safe_after: null,
                p_reason: {
                    source: 'ig_engagement_snapshot',
                    why: row.engagement_reason || 'Story outreach is safe and eligible',
                },
                p_source_message_id: null,
                p_supersede: false,
            },
        }));
    }
    return results;
}

async function prioritizeStoryViewerUnansweredInbound({ threadId, observedMessageId = null, runId = null } = {}) {
    if (!threadId) throw new Error('Instagram thread id is required');
    return supabaseQuery('rpc/prioritize_story_viewer_unanswered_inbound', {
        method: 'POST',
        body: {
            p_thread_id: threadId,
            p_observed_message_id: observedMessageId || null,
            p_run_id: runId ? String(runId).slice(0, 180) : null,
        },
    });
}

module.exports = {
    OWNERS,
    claimNextActions,
    cleanOwner,
    completeNextAction,
    prioritizeStoryViewerUnansweredInbound,
    seedStoryActions,
    _test: { clampInteger },
};
