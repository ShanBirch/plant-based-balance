/**
 * log-lp-event
 *
 * Server-side landing-page analytics endpoint. Receives event payloads from
 * the LP tracker JS and writes them to `lp_events`. Always returns 200 fast
 * so the tracker is fire-and-forget.
 */

const crypto = require('node:crypto');
const { verifyMetaAppPreviewRef } = require('./_lib/meta-app-preview-ref');

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_EVENT_TYPES = new Set([
    'page_view', 'scroll', 'click', 'time_on_page', 'cta_click', 'dm_click',
    'checkout_click', 'checkout_started', 'checkout_error', 'video_play',
    'lead_created', 'purchase', 'signup', 'onboarding_started',
    'onboarding_completed', 'weekly_goals_set', 'meal_plan_created',
    'first_workout_planned', 'first_workout_completed', 'trial_started',
    'trial_walkthrough_completed', 'trial_preview_started', 'trial_gate_shown', 'trial_signup_click',
    'trial_signup_view', 'trial_subscription_claimed', 'trial_purchase_claimed',
    'trial_flow_interrupted', 'trial_flow_resumed', 'trial_inbox_preview_viewed'
]);
const MAX_STR = 500;
const PREVIEW_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
const CHECKOUT_FOLLOWUP_DELAY_MS = 45 * 60 * 1000;
const PREVIEW_FOLLOWUP_TEXT = 'How did you find the Balance preview?';
const CHECKOUT_FOLLOWUP_TEXT = "Just checking the payment page opened properly for you. If it got stuck, send me a screenshot and I'll sort it.";
const META_PREVIEW_PROGRESS_EVENTS = new Set([
    'trial_started', 'onboarding_started', 'onboarding_completed',
    'weekly_goals_set', 'meal_plan_created', 'first_workout_planned',
    'first_workout_completed', 'trial_walkthrough_completed',
    'trial_preview_started', 'trial_gate_shown', 'checkout_started',
    'trial_signup_view', 'trial_purchase_claimed', 'trial_subscription_claimed',
    'trial_flow_interrupted', 'trial_flow_resumed', 'trial_inbox_preview_viewed',
]);

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

function trim(value, max = MAX_STR) {
    if (value === null || value === undefined) return null;
    const s = String(value);
    return s.length > max ? s.slice(0, max) : s;
}

function intOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

function objectOrEmpty(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function supabase(path, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase ${response.status}: ${text.slice(0, 300)}`);
    if (!text.trim()) return [];
    try { return JSON.parse(text); } catch (_) { return []; }
}

function metaPreviewStage(eventType = '') {
    return ({
        trial_started: 'preview_opened',
        onboarding_started: 'onboarding_started',
        onboarding_completed: 'onboarding_completed',
        weekly_goals_set: 'weekly_goals_set',
        meal_plan_created: 'meal_plan_created',
        first_workout_planned: 'first_workout_planned',
        first_workout_completed: 'first_workout_completed',
        trial_walkthrough_completed: 'walkthrough_completed',
        trial_preview_started: 'app_preview_started',
        trial_gate_shown: 'payment_gate_reached',
        trial_flow_interrupted: 'preview_interrupted',
        trial_flow_resumed: 'preview_resumed',
        trial_inbox_preview_viewed: 'inbox_preview_viewed',
        checkout_started: 'stripe_opened',
        trial_signup_view: 'account_signup_opened',
        trial_purchase_claimed: 'purchase_claimed',
        trial_subscription_claimed: 'purchase_claimed',
    })[eventType] || eventType;
}

function deterministicFollowupAlertId(idempotencyKey = '') {
    const hex = crypto.createHash('sha256').update(String(idempotencyKey || '')).digest('hex').slice(0, 32).split('');
    // A stable RFC 4122-shaped UUID lets the primary key provide atomic
    // idempotency even when older production schemas do not yet have a
    // unique constraint on coach_alerts.idempotency_key.
    hex[12] = '5';
    hex[16] = (8 | (parseInt(hex[16], 16) & 3)).toString(16);
    const value = hex.join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function verifiedPreviewThread(eventPayload, nowMs = Date.now()) {
    const metadata = objectOrEmpty(eventPayload?.metadata);
    const token = String(metadata.meta_ref || '').trim();
    const verified = verifyMetaAppPreviewRef(token, { nowMs });
    if (!verified) return null;
    const rows = await supabase(
        `ig_threads?select=id,coach_id,linked_user_id,subscriber_id,ig_username,profile_name,lead_stage,last_inbound_at,last_outbound_at,custom_data&id=eq.${encodeURIComponent(verified.threadId)}&limit=1`
    );
    const thread = rows[0] || null;
    if (!thread) return null;
    const customData = objectOrEmpty(thread.custom_data);
    const graph = objectOrEmpty(customData.instagram_graph);
    if (String(customData.bot_account || graph.bot_account || '').trim().toLowerCase() !== 'shan_n_sunny') return null;
    return { thread, token, verified };
}

async function recordMetaAppPreviewProgress(eventPayload, nowMs = Date.now(), context = null) {
    if (!META_PREVIEW_PROGRESS_EVENTS.has(String(eventPayload?.event_type || ''))) {
        return { recorded: false, reason: 'not_preview_progress' };
    }
    const preview = context || await verifiedPreviewThread(eventPayload, nowMs);
    if (!preview) return { recorded: false, reason: 'invalid_ref' };
    const metadata = objectOrEmpty(eventPayload.metadata);
    const tokenHash = crypto.createHash('sha256').update(preview.token).digest('hex').slice(0, 32);
    const occurredAt = eventPayload.created_at || new Date(nowMs).toISOString();
    const safeMetadata = { ...metadata };
    delete safeMetadata.meta_ref;
    const eventId = String(eventPayload.event_id || `${eventPayload.session_id}:${eventPayload.event_type}:${occurredAt}`);
    await supabase('growth_outcome_events?on_conflict=event_key', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=minimal',
        body: [{
            event_key: `meta_app_preview:${eventId}`,
            event_type: `meta_app_preview_${eventPayload.event_type}`,
            event_family: 'conversion',
            event_status: 'recorded',
            source_system: 'meta_app_preview',
            bot_account: 'shan_n_sunny',
            from_username: preview.thread.ig_username || null,
            ig_thread_id: preview.thread.id,
            campaign_slug: eventPayload.utm_campaign || null,
            landing_url: trim(eventPayload.page_url, 1000),
            utm_source: eventPayload.utm_source || null,
            utm_medium: eventPayload.utm_medium || null,
            utm_campaign: eventPayload.utm_campaign || null,
            score: eventPayload.event_type === 'checkout_started' ? 80 : eventPayload.event_type === 'trial_gate_shown' ? 60 : 20,
            score_breakdown: { stage: metaPreviewStage(eventPayload.event_type) },
            attribution: {
                analytics_session_id: eventPayload.session_id || null,
                visitor_id: eventPayload.visitor_id || null,
                campaign_id: metadata.campaign_id || null,
                adset_id: metadata.adset_id || null,
                ad_id: metadata.ad_id || null,
                creative_id: metadata.creative_id || null,
                meta_ref_hash: tokenHash,
            },
            raw_payload: {
                stage: metaPreviewStage(eventPayload.event_type),
                event_id: eventPayload.event_id || null,
                stripe_checkout_session_id: metadata.stripe_session_id || null,
                metadata: safeMetadata,
            },
            occurred_at: occurredAt,
        }],
    });
    return { recorded: true, threadId: preview.thread.id, context: preview };
}

function graphRecipientId(thread = {}) {
    const customData = objectOrEmpty(thread.custom_data);
    const graph = objectOrEmpty(customData.instagram_graph);
    const subscriberId = String(thread.subscriber_id || '');
    return String(
        graph.ig_graph_user_id
        || graph.recipient_id
        || customData.ig_graph_recipient_id
        || (subscriberId.startsWith('ig_graph:') ? subscriberId.slice('ig_graph:'.length) : '')
        || ''
    ).trim();
}

function isEligiblePreviewThread(thread = {}, nowMs = Date.now()) {
    if (!thread.id || !thread.coach_id || thread.linked_user_id) return false;
    if (['in_app', 'paying', 'churned'].includes(String(thread.lead_stage || '').toLowerCase())) return false;
    const customData = objectOrEmpty(thread.custom_data);
    const graph = objectOrEmpty(customData.instagram_graph);
    if (String(customData.bot_account || graph.bot_account || '').trim().toLowerCase() !== 'shan_n_sunny') return false;
    if (customData.do_not_follow_up === true || String(customData.do_not_follow_up).toLowerCase() === 'true') return false;
    if (!graphRecipientId(thread)) return false;
    const inboundMs = Date.parse(thread.last_inbound_at || '');
    return Number.isFinite(inboundMs)
        && nowMs >= inboundMs
        && nowMs - inboundMs < (23.5 * 60 * 60 * 1000);
}

async function enqueueMetaAppPreviewFollowup(eventPayload, nowMs = Date.now(), context = null) {
    const eventType = String(eventPayload?.event_type || '');
    if (!SUPABASE_SERVICE_KEY || !['trial_gate_shown', 'checkout_started'].includes(eventType)) {
        return { queued: false, reason: 'not_followup_stage' };
    }
    const preview = context || await verifiedPreviewThread(eventPayload, nowMs);
    if (!preview) return { queued: false, reason: 'invalid_ref' };
    const { thread, token } = preview;
    if (!isEligiblePreviewThread(thread, nowMs)) return { queued: false, reason: 'ineligible_thread' };

    const messages = await supabase(
        `ig_messages?select=id,direction,text,created_at,alert_id&thread_id=eq.${encodeURIComponent(thread.id)}&order=created_at.desc&limit=12`
    );
    const previewOutbound = messages.find(message =>
        String(message.direction || '').toLowerCase() === 'out'
        && String(message.text || '').includes(token)
        && /https:\/\/plantbased-balance\.org\/(?:meta-app-preview\.html|p\/)/i.test(String(message.text || ''))
    );
    if (!previewOutbound) return { queued: false, reason: 'canonical_preview_missing' };

    const gateMs = Date.parse(eventPayload.created_at || '') || nowMs;
    const previewMs = Date.parse(previewOutbound.created_at || '');
    if (!Number.isFinite(previewMs) || previewMs > gateMs) return { queued: false, reason: 'invalid_timeline' };
    if (messages.some(message => Date.parse(message.created_at || '') > previewMs && message.id !== previewOutbound.id)) {
        return { queued: false, reason: 'conversation_changed' };
    }

    if (eventType === 'trial_gate_shown') {
        const funnelEvents = await supabase(
            `lp_events?select=event_type,created_at&session_id=eq.${encodeURIComponent(String(eventPayload.session_id || ''))}&event_type=in.(checkout_started,trial_purchase_claimed,trial_subscription_claimed)&created_at=gte.${encodeURIComponent(new Date(gateMs).toISOString())}&limit=1`
        );
        if (funnelEvents.length) return { queued: false, reason: 'checkout_or_purchase_started' };
    }

    const graph = objectOrEmpty(objectOrEmpty(thread.custom_data).instagram_graph);
    const recipientId = graphRecipientId(thread);
    const scheduledAt = new Date(nowMs).toISOString();
    const followupKind = eventType === 'checkout_started' ? 'checkout_abandoned' : 'gate';
    const followupText = followupKind === 'checkout_abandoned' ? CHECKOUT_FOLLOWUP_TEXT : PREVIEW_FOLLOWUP_TEXT;
    const scheduledFor = new Date(nowMs + (followupKind === 'checkout_abandoned' ? CHECKOUT_FOLLOWUP_DELAY_MS : PREVIEW_FOLLOWUP_DELAY_MS)).toISOString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
    const checkoutSessionId = String(objectOrEmpty(eventPayload.metadata).stripe_session_id || '').trim();
    const idempotencyKey = followupKind === 'checkout_abandoned'
        ? `meta_app_preview_followup:${followupKind}:${thread.id}:${checkoutSessionId || tokenHash}`
        : `meta_app_preview_followup:${followupKind}:${thread.id}:${tokenHash}`;
    const alertId = deterministicFollowupAlertId(idempotencyKey);
    const alertData = {
        channel: 'instagram',
        delivery_channel: 'instagram_graph',
        subscriber_id: thread.subscriber_id,
        ig_thread_id: thread.id,
        ig_username: thread.ig_username || null,
        profile_name: thread.profile_name || null,
        bot_account: objectOrEmpty(thread.custom_data).bot_account || graph.bot_account || 'shan_n_sunny',
        ig_graph_recipient_id: recipientId,
        ig_graph_account_id: graph.ig_account_id || null,
        instagram_graph: { ...graph, ig_graph_user_id: recipientId, send_ready: true },
        last_inbound_at: thread.last_inbound_at,
        source_inbound_created_at: new Date(gateMs).toISOString(),
        drafted_at: scheduledAt,
        scheduled_via: 'balance_lead_client_manager_cron',
        auto_send_review_approved_at: scheduledAt,
        outbound_attempted: false,
        draft_messages: [followupText],
        draft_text: followupText,
        draft_model: 'deterministic_meta_app_preview_followup_v2',
        draft_reply_mode: followupKind === 'checkout_abandoned'
            ? 'campaign_app_preview_checkout_followup'
            : 'campaign_app_preview_usage_followup',
        draft_review: {
            verdict: 'pass', confidence: 1,
            summary: 'Verified five-minute app gate follow-up.', issues: [],
            reviewed_at: scheduledAt, reviewer_model: 'deterministic_preview_event_v1',
        },
        context_review: { required: false, reason: 'signed preview ref and canonical outbound verified' },
        media_review: { required: false },
        meta_app_preview_followup: true,
        meta_app_preview_followup_kind: followupKind,
        meta_app_preview_gate_event_id: eventPayload.event_id || null,
        meta_app_preview_session_id: eventPayload.session_id || null,
        meta_app_preview_checkout_session_id: checkoutSessionId || null,
        meta_app_preview_ref_hash: tokenHash,
        meta_app_preview_canonical_outbound_id: previewOutbound.id,
        meta_app_preview_gate_shown_at: new Date(gateMs).toISOString(),
    };
    const inserted = await supabase('coach_alerts?on_conflict=id', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=representation',
        body: [{
            id: alertId,
            coach_id: thread.coach_id || null,
            client_id: null,
            client_name: thread.profile_name || thread.ig_username || 'Instagram lead',
            alert_type: 'follow_up_review',
            priority: 'high',
            title: followupKind === 'checkout_abandoned'
                ? `${thread.profile_name || thread.ig_username || 'Instagram lead'} opened Stripe`
                : `${thread.profile_name || thread.ig_username || 'Instagram lead'} used the Balance preview`,
            description: followupKind === 'checkout_abandoned'
                ? 'Stripe opened but no purchase is confirmed yet. A payment-help follow-up is queued.'
                : 'The signed five-minute preview reached its payment gate. One contextual follow-up is queued.',
            suggested_message: followupText,
            scheduled_reply_text: followupText,
            status: 'scheduled',
            scheduled_at: scheduledAt,
            scheduled_for: scheduledFor,
            idempotency_key: idempotencyKey,
            data: alertData,
        }],
    });
    return { queued: inserted.length > 0, reason: inserted.length ? 'scheduled' : 'duplicate', alertId: inserted[0]?.id || null };
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders(), body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_SERVICE_KEY) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, skipped: 'no_service_key' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, skipped: 'bad_json' }) };
    }

    // Accept a batch of events or a single event.
    const events = Array.isArray(payload.events) ? payload.events : [payload];
    const rows = [];
    for (const e of events) {
        if (!e || !ALLOWED_EVENT_TYPES.has(e.event_type)) continue;
        if (!e.session_id || !e.landing_page) continue;
        rows.push({
            event_id: trim(e.event_id, 80),
            session_id: trim(e.session_id, 64),
            visitor_id: trim(e.visitor_id, 80),
            landing_page: trim(e.landing_page, 64),
            page_variant: trim(e.page_variant, 64),
            page_url: trim(e.page_url, 1000),
            event_type: trim(e.event_type, 32),
            target: trim(e.target, 200),
            target_text: trim(e.target_text, 200),
            scroll_depth: intOrNull(e.scroll_depth),
            duration_ms: intOrNull(e.duration_ms),
            viewport_w: intOrNull(e.viewport_w),
            viewport_h: intOrNull(e.viewport_h),
            click_x: intOrNull(e.click_x),
            click_y: intOrNull(e.click_y),
            utm_source: trim(e.utm_source, 128),
            utm_medium: trim(e.utm_medium, 128),
            utm_campaign: trim(e.utm_campaign, 128),
            utm_term: trim(e.utm_term, 128),
            utm_content: trim(e.utm_content, 128),
            fbclid: trim(e.fbclid, 500),
            fbc: trim(e.fbc, 500),
            fbp: trim(e.fbp, 500),
            referrer: trim(e.referrer, 500),
            user_agent: trim(e.user_agent, 200),
            metadata: objectOrEmpty(e.metadata),
        });
    }
    if (rows.length === 0) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, inserted: 0 }) };
    }

    try {
        await supabase('lp_events', { method: 'POST', body: rows, prefer: 'return=minimal' });
        for (const row of rows.filter(item => META_PREVIEW_PROGRESS_EVENTS.has(item.event_type))) {
            try {
                const progress = await recordMetaAppPreviewProgress(row);
                const result = await enqueueMetaAppPreviewFollowup(row, Date.now(), progress.context || null);
                if (result.queued) console.log('[log-lp-event] queued preview follow-up', result.alertId);
            } catch (error) {
                console.error('[log-lp-event] preview progress/follow-up failed', error && error.message);
            }
        }
    } catch (err) {
        console.error('[log-lp-event] error', err && err.message);
    }
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, inserted: rows.length }) };
};

exports.PREVIEW_FOLLOWUP_DELAY_MS = PREVIEW_FOLLOWUP_DELAY_MS;
exports.CHECKOUT_FOLLOWUP_DELAY_MS = CHECKOUT_FOLLOWUP_DELAY_MS;
exports.PREVIEW_FOLLOWUP_TEXT = PREVIEW_FOLLOWUP_TEXT;
exports.CHECKOUT_FOLLOWUP_TEXT = CHECKOUT_FOLLOWUP_TEXT;
exports.graphRecipientId = graphRecipientId;
exports.isEligiblePreviewThread = isEligiblePreviewThread;
exports.recordMetaAppPreviewProgress = recordMetaAppPreviewProgress;
exports.enqueueMetaAppPreviewFollowup = enqueueMetaAppPreviewFollowup;
exports.deterministicFollowupAlertId = deterministicFollowupAlertId;
