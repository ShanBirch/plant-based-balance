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
    'trial_preview_started', 'trial_gate_shown', 'trial_signup_click',
    'trial_signup_view', 'trial_subscription_claimed', 'trial_purchase_claimed'
]);
const MAX_STR = 500;
const PREVIEW_FOLLOWUP_DELAY_MS = 10 * 60 * 1000;
const PREVIEW_FOLLOWUP_TEXT = "Hey, how'd you find the app?";

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

async function enqueueMetaAppPreviewFollowup(eventPayload, nowMs = Date.now()) {
    if (!SUPABASE_SERVICE_KEY || eventPayload?.event_type !== 'trial_gate_shown') return { queued: false, reason: 'not_gate' };
    const metadata = objectOrEmpty(eventPayload.metadata);
    const token = String(metadata.meta_ref || '').trim();
    const verified = verifyMetaAppPreviewRef(token, { nowMs });
    if (!verified) return { queued: false, reason: 'invalid_ref' };

    const threads = await supabase(
        `ig_threads?select=id,coach_id,linked_user_id,subscriber_id,ig_username,profile_name,lead_stage,last_inbound_at,last_outbound_at,custom_data&id=eq.${encodeURIComponent(verified.threadId)}&limit=1`
    );
    const thread = threads[0];
    if (!isEligiblePreviewThread(thread, nowMs)) return { queued: false, reason: 'ineligible_thread' };

    const messages = await supabase(
        `ig_messages?select=id,direction,text,created_at,alert_id&thread_id=eq.${encodeURIComponent(thread.id)}&order=created_at.desc&limit=12`
    );
    const previewOutbound = messages.find(message =>
        String(message.direction || '').toLowerCase() === 'out'
        && String(message.text || '').includes(token)
        && String(message.text || '').includes('https://plantbased-balance.org/meta-app-preview.html')
    );
    if (!previewOutbound) return { queued: false, reason: 'canonical_preview_missing' };

    const gateMs = Date.parse(eventPayload.created_at || '') || nowMs;
    const previewMs = Date.parse(previewOutbound.created_at || '');
    if (!Number.isFinite(previewMs) || previewMs > gateMs) return { queued: false, reason: 'invalid_timeline' };
    if (messages.some(message => Date.parse(message.created_at || '') > previewMs && message.id !== previewOutbound.id)) {
        return { queued: false, reason: 'conversation_changed' };
    }

    const funnelEvents = await supabase(
        `lp_events?select=event_type,created_at&session_id=eq.${encodeURIComponent(String(eventPayload.session_id || ''))}&event_type=in.(checkout_started,trial_purchase_claimed,trial_subscription_claimed)&created_at=gte.${encodeURIComponent(new Date(gateMs).toISOString())}&limit=1`
    );
    if (funnelEvents.length) return { queued: false, reason: 'checkout_or_purchase_started' };

    const graph = objectOrEmpty(objectOrEmpty(thread.custom_data).instagram_graph);
    const recipientId = graphRecipientId(thread);
    const scheduledAt = new Date(nowMs).toISOString();
    const scheduledFor = new Date(nowMs + PREVIEW_FOLLOWUP_DELAY_MS).toISOString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
    const idempotencyKey = `meta_app_preview_followup:${thread.id}:${tokenHash}`;
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
        draft_messages: [PREVIEW_FOLLOWUP_TEXT],
        draft_text: PREVIEW_FOLLOWUP_TEXT,
        draft_model: 'deterministic_meta_app_preview_followup_v1',
        draft_reply_mode: 'campaign_app_preview_usage_followup',
        draft_review: {
            verdict: 'pass', confidence: 1,
            summary: 'Verified five-minute app gate follow-up.', issues: [],
            reviewed_at: scheduledAt, reviewer_model: 'deterministic_preview_event_v1',
        },
        context_review: { required: false, reason: 'signed preview ref and canonical outbound verified' },
        media_review: { required: false },
        meta_app_preview_followup: true,
        meta_app_preview_gate_event_id: eventPayload.event_id || null,
        meta_app_preview_session_id: eventPayload.session_id || null,
        meta_app_preview_ref_hash: tokenHash,
        meta_app_preview_canonical_outbound_id: previewOutbound.id,
        meta_app_preview_gate_shown_at: new Date(gateMs).toISOString(),
    };
    const inserted = await supabase('coach_alerts?on_conflict=idempotency_key', {
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=representation',
        body: [{
            coach_id: thread.coach_id || null,
            client_id: null,
            client_name: thread.profile_name || thread.ig_username || 'Instagram lead',
            alert_type: 'follow_up_review',
            priority: 'high',
            title: `${thread.profile_name || thread.ig_username || 'Instagram lead'} used the Balance preview`,
            description: 'The signed five-minute preview reached its payment gate. One contextual follow-up is queued.',
            suggested_message: PREVIEW_FOLLOWUP_TEXT,
            scheduled_reply_text: PREVIEW_FOLLOWUP_TEXT,
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
        for (const row of rows.filter(item => item.event_type === 'trial_gate_shown')) {
            try {
                const result = await enqueueMetaAppPreviewFollowup(row);
                if (result.queued) console.log('[log-lp-event] queued preview follow-up', result.alertId);
            } catch (error) {
                console.error('[log-lp-event] preview follow-up enqueue failed', error && error.message);
            }
        }
    } catch (err) {
        console.error('[log-lp-event] error', err && err.message);
    }
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, inserted: rows.length }) };
};

exports.PREVIEW_FOLLOWUP_DELAY_MS = PREVIEW_FOLLOWUP_DELAY_MS;
exports.PREVIEW_FOLLOWUP_TEXT = PREVIEW_FOLLOWUP_TEXT;
exports.graphRecipientId = graphRecipientId;
exports.isEligiblePreviewThread = isEligiblePreviewThread;
exports.enqueueMetaAppPreviewFollowup = enqueueMetaAppPreviewFollowup;
