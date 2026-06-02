/**
 * client-lead-manager - scheduled Needs You router.
 *
 * Runs over pending DM alerts and stamps the cases Shannon explicitly needs
 * to inspect: permanent people, inbound media, AI/authenticity suspicion,
 * confused replies, and missing tracked context.
 */

const {
    supabaseQuery,
    buildMediaReviewInfo,
    buildContextReviewInfo,
    isAlwaysNeedsYouPerson,
    normalizeLearningReelHistory,
    buildLearningReelContextBlock,
    truncate,
} = require('./_lib/client-context');

const MANAGER_SOURCE = 'balance-lead-client-manager';
const MAX_PER_RUN = 80;
const DM_ALERT_TYPES = ['incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm'];

function normalizeDraftReview(data = {}) {
    const review = data.draft_review || data.draftReview || {};
    return review && typeof review === 'object' ? review : {};
}

function alertIdentity(alert = {}) {
    const data = alert.data || {};
    return {
        name: alert.client_name || data.client_name || data.profile_name || data.ig_username || '',
        client_name: alert.client_name || data.client_name || '',
        profile_name: data.profile_name || '',
        ig_username: data.ig_username || '',
        username: data.username || data.ig_username || '',
        custom_data: data.custom_data || {},
    };
}

function draftReviewNeedsContext(data = {}) {
    const review = normalizeDraftReview(data);
    const text = [
        review.summary,
        review.notification_reason,
        ...(Array.isArray(review.issues) ? review.issues : []),
    ].map(v => String(v || '').toLowerCase()).join(' ');
    return review.context_loss_suspected === true
        || /\b(context_loss|missing_context|missing thread|missing conversation|unclear context|lost context|understand total)\b/i.test(text);
}

function latestAlertMessageText(data = {}) {
    const currentFromBatch = Array.isArray(data.inbound_message_batch)
        ? data.inbound_message_batch.find(m => m && m.is_current)
        : null;
    return String(
        currentFromBatch?.text
        || data.message_preview
        || data.client_message
        || data.draft_evidence?.current_message
        || ''
    ).trim();
}

function referencesOutboundLearningReel(text = '') {
    const value = String(text || '').toLowerCase();
    if (!value) return false;
    return /\b(what|why|which|that|the|your|you|u|sent|send|reckon|think|question)\b[\s\S]{0,80}\b(reel|youtube|short|clip|video)\b/i.test(value)
        || /\b(reel|youtube|short|clip|video)\b[\s\S]{0,80}\b(about|mean|sent|send|reckon|think|question|explain)\b/i.test(value);
}

function classifyNeedsYou(alert = {}) {
    const data = alert.data || {};
    const mediaReview = buildMediaReviewInfo(alert);
    const contextReview = buildContextReviewInfo(alert);
    const learningReels = normalizeLearningReelHistory(data);
    const latestText = latestAlertMessageText(data);
    const reasons = [];
    const labels = [];

    if (isAlwaysNeedsYouPerson(alertIdentity(alert))) {
        reasons.push('always_needs_you_person');
        labels.push('Shane/Fra permanent Needs You route');
    }
    if (mediaReview.required) {
        reasons.push('media_review_required');
        labels.push(mediaReview.label || 'media needs Shannon review');
    }
    if (contextReview.required) {
        reasons.push(...contextReview.reasons);
        labels.push(contextReview.label || 'tracked context may be incomplete');
    }
    if (draftReviewNeedsContext(data)) {
        reasons.push('draft_review_context_loss');
        labels.push('AI may not have the full conversation context');
    }
    if (referencesOutboundLearningReel(latestText) && learningReels.length === 0) {
        reasons.push('missing_learning_reel_context');
        labels.push('client may be referring to a reel but no sent-reel context is stored');
    }

    const uniqueReasons = [...new Set(reasons.filter(Boolean))];
    const uniqueLabels = [...new Set(labels.filter(Boolean))];
    return {
        shouldRoute: uniqueReasons.length > 0,
        reasons: uniqueReasons,
        label: uniqueLabels.join(', ') || 'Needs Shannon review',
        mediaReview,
        contextReview,
    };
}

function buildNeedsYouData(alert, classification) {
    const data = alert.data || {};
    const reason = classification.label;
    const learningReels = normalizeLearningReelHistory(data);
    const learningReelContextBlock = buildLearningReelContextBlock(data);
    const existingReview = data.codex_review && typeof data.codex_review === 'object'
        ? data.codex_review
        : {};
    return {
        ...data,
        media_review: classification.mediaReview.required
            ? classification.mediaReview
            : (data.media_review || data.mediaReview || null),
        context_review: classification.contextReview.required
            ? classification.contextReview
            : (data.context_review || data.contextReview || null),
        client_manager_review_required: true,
        needs_you_required: true,
        needs_you_reason: reason,
        needs_you_reasons: classification.reasons,
        learning_reels: learningReels.length ? {
            recent: learningReels,
            last_sent: learningReels[0],
        } : (data.learning_reels || null),
        operator_queue: 'needs_you',
        codex_review: {
            ...existingReview,
            source: MANAGER_SOURCE,
            decision: 'client_manager_review_required',
            queue: 'needs_you',
            needs_shannon_approval: true,
            reason,
            learning_reel_context: learningReelContextBlock ? truncate(learningReelContextBlock, 1800) : undefined,
            evidence_ids: [
                alert.id ? `coach_alerts:${alert.id}` : '',
                alert.client_id ? `users:${alert.client_id}` : '',
                data.nudge_id ? `nudges:${data.nudge_id}` : '',
                data.ig_thread_id ? `ig_threads:${data.ig_thread_id}` : '',
                data.manychat_message_id ? `manychat_message_id:${data.manychat_message_id}` : '',
            ].filter(Boolean),
            reviewed_at: new Date().toISOString(),
            automation_id: MANAGER_SOURCE,
        },
    };
}

async function loadPendingDmAlerts(limit = MAX_PER_RUN) {
    const types = DM_ALERT_TYPES.join(',');
    return supabaseQuery(
        `coach_alerts?select=id,created_at,client_id,client_name,coach_id,alert_type,title,description,suggested_message,status,data&status=eq.pending&alert_type=in.(${types})&order=created_at.asc&limit=${limit}`
    );
}

async function stampNeedsYouAlert(alert, classification) {
    const merged = buildNeedsYouData(alert, classification);
    await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending`, {
        method: 'PATCH',
        body: { data: merged },
        prefer: 'return=minimal',
    });
    return {
        id: alert.id,
        client_name: alert.client_name || merged.profile_name || merged.ig_username || null,
        reason: truncate(classification.label, 180),
    };
}

async function runClientLeadManager({ limit = MAX_PER_RUN } = {}) {
    const alerts = await loadPendingDmAlerts(limit);
    const routed = [];
    for (const alert of alerts) {
        const classification = classifyNeedsYou(alert);
        if (!classification.shouldRoute) continue;
        routed.push(await stampNeedsYouAlert(alert, classification));
    }
    return {
        scanned: alerts.length,
        routed: routed.length,
        routed_alerts: routed,
    };
}

exports.handler = async () => {
    try {
        const result = await runClientLeadManager();
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, ...result }),
        };
    } catch (error) {
        console.error('[client-lead-manager] failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: error.message || String(error) }),
        };
    }
};

exports._test = {
    classifyNeedsYou,
    buildNeedsYouData,
    draftReviewNeedsContext,
};
