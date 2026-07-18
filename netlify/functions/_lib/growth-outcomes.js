const crypto = require('crypto');

const DEFAULT_EVENT_SCORES = {
    story_comment_sent: 2,
    story_comment_send_attempted: 1,
    story_comment_liked: 1,
    story_comment_blocked: 0,
    story_comment_draft_only: 0,
    story_comment_replied: 5,
    post_comment_keyword_matched: 4,
    private_reply_sent: 8,
    free_info_unlocked: 10,
    email_captured: 12,
    dm_qualified: 15,
    challenge_invited: 12,
    challenge_accepted: 25,
    app_joined: 35,
    coaching_pitched: 20,
    subscription_started: 100,
    subscription_canceled: -30,
    ig_dm_response_sent: 1,
    client_message_response_sent: 1,
    client_checkin_completed: 3,
    client_workout_logged: 3,
    client_goal_completed: 10,
    client_retained_30d: 15,
    lead_health_progression_attempted: 0,
    lead_health_progression_answered: 0,
    lead_goal_identified: 0,
    lead_blocker_identified: 0,
    lead_problem_qualified: 0,
    lead_offer_ready: 0,
    lead_buyer_intent: 0,
};

const EVENT_FAMILIES = {
    story_comment_sent: 'acquisition',
    story_comment_send_attempted: 'acquisition',
    story_comment_liked: 'acquisition',
    story_comment_blocked: 'acquisition',
    story_comment_draft_only: 'acquisition',
    story_comment_replied: 'acquisition',
    post_comment_keyword_matched: 'acquisition',
    private_reply_sent: 'acquisition',
    free_info_unlocked: 'acquisition',
    email_captured: 'acquisition',
    dm_qualified: 'sales',
    challenge_invited: 'sales',
    challenge_accepted: 'sales',
    app_joined: 'sales',
    coaching_pitched: 'sales',
    subscription_started: 'revenue',
    subscription_canceled: 'revenue',
    ig_dm_response_sent: 'engagement',
    client_message_response_sent: 'engagement',
    client_checkin_completed: 'retention',
    client_workout_logged: 'retention',
    client_goal_completed: 'retention',
    client_retained_30d: 'retention',
    lead_health_progression_attempted: 'sales',
    lead_health_progression_answered: 'sales',
    lead_goal_identified: 'sales',
    lead_blocker_identified: 'sales',
    lead_problem_qualified: 'sales',
    lead_offer_ready: 'sales',
    lead_buyer_intent: 'sales',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value, max = 1000) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function cleanLower(value, max = 1000) {
    return cleanString(value, max).toLowerCase();
}

function normalizeHandle(value) {
    return cleanLower(value, 120).replace(/^@+/, '').replace(/\s+/g, '');
}

function normalizeEmail(value) {
    return cleanLower(value, 320);
}

function safeUuid(value) {
    const clean = cleanString(value, 80);
    return UUID_RE.test(clean) ? clean : null;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function compactObject(value, maxString = 2000) {
    if (Array.isArray(value)) return value.slice(0, 50).map(item => compactObject(item, maxString));
    if (!value || typeof value !== 'object') {
        return typeof value === 'string' ? cleanString(value, maxString) : value;
    }
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [cleanString(k, 120), compactObject(v, maxString)])
    );
}

function hashParts(parts = []) {
    return crypto.createHash('sha1')
        .update(parts.map(part => cleanString(part, 500)).join('|'))
        .digest('hex')
        .slice(0, 24);
}

function stableEventKey({
    sourceSystem = 'balance',
    eventType = '',
    primaryId = '',
    fallbackParts = [],
} = {}) {
    const cleanPrimary = cleanString(primaryId, 300);
    if (cleanPrimary) return `${cleanString(sourceSystem, 80)}:${cleanString(eventType, 100)}:${cleanPrimary}`;
    return `${cleanString(sourceSystem, 80)}:${cleanString(eventType, 100)}:${hashParts(fallbackParts)}`;
}

function eventScore(eventType, explicitScore) {
    const parsed = Number(explicitScore);
    if (Number.isFinite(parsed)) return parsed;
    return DEFAULT_EVENT_SCORES[eventType] ?? 0;
}

function tableMissing(error) {
    return /42P01|PGRST205|Could not find the table|relation .* does not exist/i.test(
        error?.message || error?.body || String(error || '')
    );
}

function buildGrowthOutcomePayload(input = {}) {
    const eventType = cleanString(input.event_type || input.eventType, 100);
    if (!eventType) throw new Error('growth_outcome_event_type_required');

    const sourceSystem = cleanString(input.source_system || input.sourceSystem || 'balance', 80);
    const email = normalizeEmail(input.email);
    const fromUsername = normalizeHandle(input.from_username || input.fromUsername || input.ig_username);
    const occurredAt = cleanString(input.occurred_at || input.occurredAt, 80) || new Date().toISOString();
    const eventKey = cleanString(input.event_key || input.eventKey, 500) || stableEventKey({
        sourceSystem,
        eventType,
        primaryId: input.primary_id || input.primaryId,
        fallbackParts: [
            input.bot_account,
            fromUsername,
            email,
            input.ig_thread_id || input.igThreadId,
            input.ig_message_id || input.igMessageId,
            input.content_item_id || input.contentItemId,
            input.content_platform_post_id || input.contentPlatformPostId,
            input.ig_media_id || input.igMediaId,
            input.story_id || input.storyId,
            input.story_comment_run_id || input.storyCommentRunId,
            occurredAt,
        ],
    });
    const score = eventScore(eventType, input.score);

    return {
        event_key: eventKey,
        event_type: eventType,
        event_family: cleanString(input.event_family || input.eventFamily || EVENT_FAMILIES[eventType] || 'acquisition', 80),
        event_status: cleanString(input.event_status || input.eventStatus || 'recorded', 80),
        source_system: sourceSystem,
        bot_account: cleanString(input.bot_account || input.botAccount, 120) || null,
        lead_key: cleanString(input.lead_key || input.leadKey, 240) || null,
        from_ig_user_id: cleanString(input.from_ig_user_id || input.fromIgUserId, 180) || null,
        from_username: fromUsername || null,
        email: email || null,
        email_key: email || null,
        ig_thread_id: safeUuid(input.ig_thread_id || input.igThreadId),
        ig_message_id: safeUuid(input.ig_message_id || input.igMessageId),
        content_item_id: safeUuid(input.content_item_id || input.contentItemId),
        content_platform_post_id: safeUuid(input.content_platform_post_id || input.contentPlatformPostId),
        campaign_id: safeUuid(input.campaign_id || input.campaignId),
        ig_comment_automation_id: safeUuid(input.ig_comment_automation_id || input.igCommentAutomationId),
        ig_comment_fulfillment_id: safeUuid(input.ig_comment_fulfillment_id || input.igCommentFulfillmentId),
        ig_growth_lead_id: safeUuid(input.ig_growth_lead_id || input.igGrowthLeadId),
        ig_growth_submission_id: safeUuid(input.ig_growth_submission_id || input.igGrowthSubmissionId),
        conversion_operator_event_id: safeUuid(input.conversion_operator_event_id || input.conversionOperatorEventId),
        coach_alert_id: safeUuid(input.coach_alert_id || input.coachAlertId),
        client_id: safeUuid(input.client_id || input.clientId),
        stripe_subscription_link_id: safeUuid(input.stripe_subscription_link_id || input.stripeSubscriptionLinkId),
        cohort_invitation_id: safeUuid(input.cohort_invitation_id || input.cohortInvitationId),
        source_key: cleanString(input.source_key || input.sourceKey, 300) || null,
        ig_media_id: cleanString(input.ig_media_id || input.igMediaId, 180) || null,
        story_id: cleanString(input.story_id || input.storyId, 180) || null,
        story_comment_run_id: cleanString(input.story_comment_run_id || input.storyCommentRunId, 180) || null,
        campaign_slug: cleanString(input.campaign_slug || input.campaignSlug, 180) || null,
        landing_url: cleanString(input.landing_url || input.landingUrl, 1000) || null,
        utm_source: cleanString(input.utm_source || input.utmSource, 128) || null,
        utm_medium: cleanString(input.utm_medium || input.utmMedium, 128) || null,
        utm_campaign: cleanString(input.utm_campaign || input.utmCampaign, 128) || null,
        score,
        score_breakdown: {
            default_score: DEFAULT_EVENT_SCORES[eventType] ?? 0,
            explicit_score: Number.isFinite(Number(input.score)) ? Number(input.score) : null,
            score,
            reason: cleanString(input.score_reason || input.scoreReason, 300) || null,
        },
        attribution: compactObject(safeObject(input.attribution)),
        raw_payload: compactObject(safeObject(input.raw_payload || input.rawPayload)),
        occurred_at: occurredAt,
    };
}

async function recordGrowthOutcome(input = {}, query) {
    if (typeof query !== 'function') throw new Error('growth_outcome_query_required');
    const payload = buildGrowthOutcomePayload(input);
    try {
        const rows = await query('growth_outcome_events?on_conflict=event_key', {
            method: 'POST',
            body: [payload],
            prefer: 'resolution=merge-duplicates,return=representation',
        });
        return Array.isArray(rows) ? rows[0] || null : null;
    } catch (error) {
        if (tableMissing(error)) return null;
        throw error;
    }
}

function buildStoryCommentImportRows(row = {}) {
    const bridge = safeObject(row.balance_bridge_result);
    const sendStatus = cleanString(row.send_status || row.status || 'unknown', 120);
    const botAccount = cleanString(row.bot_account || 'shan_n_sunny', 120);
    const username = normalizeHandle(row.ig_username || row.username_after_analysis || row.url_username);
    const createdAt = cleanString(row.created_at, 80) || new Date().toISOString();
    const baseKey = cleanString(row.dedupe_key, 160)
        || hashParts([botAccount, username, row.story_id, row.run_id, createdAt, sendStatus]);
    const outreachKey = `story_comment_outreach:${baseKey}`;
    let eventType = 'story_comment_blocked';
    if (sendStatus === 'sent') eventType = 'story_comment_sent';
    else if (sendStatus === 'send_attempt_started') eventType = 'story_comment_send_attempted';
    else if (/liked_story_fallback|already_liked_story_fallback|like_attempt_started/i.test(sendStatus)) eventType = 'story_comment_liked';
    else if (sendStatus === 'draft_only') eventType = 'story_comment_draft_only';

    const safetyReason = cleanString(
        bridge.safety_reason
        || bridge.error
        || row.safety_reason
        || row.block_reason
        || row.contextual_content_block_reason
        || row.promotional_content_block_reason,
        240
    );

    const outreach = {
        event_key: outreachKey,
        bot_account: botAccount,
        ig_username: username || null,
        from_username: username || null,
        story_id: cleanString(row.story_id, 180) || null,
        story_url: cleanString(row.story_url || bridge.story_url, 1000) || null,
        run_id: cleanString(row.run_id, 180) || null,
        send_status: sendStatus,
        safety_reason: safetyReason || null,
        story_content_type: cleanString(row.story_content_type, 160) || null,
        story_description: cleanString(row.story_description, 1200) || null,
        raw_comment: cleanString(row.raw_comment, 500) || null,
        draft_comment: cleanString(row.draft_comment, 500) || null,
        screenshot_path: cleanString(row.screenshot_path, 1000) || null,
        video_path: cleanString(row.video_path, 1000) || null,
        balance_bridge_analyzed: Boolean(row.balance_bridge_analyzed),
        balance_bridge_saved: Boolean(row.balance_bridge_saved),
        raw_payload: compactObject(row),
        source_created_at: createdAt,
    };

    const outcome = buildGrowthOutcomePayload({
        eventType,
        eventKey: `story_comment_outcome:${baseKey}:${eventType}`,
        sourceSystem: 'story_comment_probe',
        botAccount,
        fromUsername: username,
        storyId: row.story_id,
        storyCommentRunId: row.run_id,
        occurredAt: createdAt,
        eventStatus: sendStatus,
        scoreReason: safetyReason || sendStatus,
        rawPayload: {
            send_status: sendStatus,
            safety_reason: safetyReason || null,
            story_description: outreach.story_description,
            raw_comment: outreach.raw_comment,
            draft_comment: outreach.draft_comment,
            story_url: outreach.story_url,
            outreach_event_key: outreachKey,
        },
        attribution: {
            story_url: outreach.story_url,
            story_content_type: outreach.story_content_type,
            screenshot_path: outreach.screenshot_path,
            video_path: outreach.video_path,
        },
    });

    return { outreach, outcome };
}

module.exports = {
    DEFAULT_EVENT_SCORES,
    EVENT_FAMILIES,
    buildGrowthOutcomePayload,
    buildStoryCommentImportRows,
    cleanString,
    hashParts,
    normalizeEmail,
    normalizeHandle,
    recordGrowthOutcome,
    stableEventKey,
    tableMissing,
    _test: {
        eventScore,
        safeUuid,
    },
};
