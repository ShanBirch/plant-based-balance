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
    referencesLearningReelFollowUpText,
    reviewDraftAndUpdateAlert,
    truncate,
} = require('./_lib/client-context');
const { buildExerciseLibrarySupportBlock } = require('./_lib/exercise-library-search');

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

function draftReviewNeedsManualCheck(data = {}) {
    const review = normalizeDraftReview(data);
    if (!review || Object.keys(review).length === 0) return false;
    if (draftReviewNeedsContext(data)) return true;
    if (review.notification_required === true) return true;

    const verdict = String(review.verdict || '').trim().toLowerCase();
    if (verdict === 'warn' || verdict === 'block') return true;

    const reason = String(review.notification_reason || review.notificationReason || '').trim().toLowerCase();
    if (reason && reason !== 'none') return true;

    const text = [
        review.summary,
        review.suggested_fix,
        review.suggestedFix,
        ...(Array.isArray(review.issues) ? review.issues : []),
    ].map(v => String(v || '').toLowerCase()).join(' ');
    return /\b(manual check|needs? (?:shannon|human|manual)|open (?:the )?(?:source )?dm|non[- ]?sequitur|ignored latest|unsupported claim|does(?:n'?t| not) follow|out of context)\b/i.test(text);
}

function draftReviewNeedsYouLabel(data = {}) {
    const review = normalizeDraftReview(data);
    if (!review || Object.keys(review).length === 0) return 'AI draft needs Shannon review';
    if (draftReviewNeedsContext(data)) return 'AI may not have the full conversation context';
    return truncate(review.summary || review.suggested_fix || 'AI draft needs Shannon review', 180);
}

function hasDraftReview(data = {}) {
    const review = normalizeDraftReview(data);
    return !!(review && Object.keys(review).length > 0 && (review.reviewed_at || review.verdict || review.summary));
}

function formatReviewList(items, mapper) {
    const rows = (Array.isArray(items) ? items : [])
        .map(mapper)
        .map(v => String(v || '').trim())
        .filter(Boolean);
    return rows.length ? rows.join('\n') : '';
}

function buildDraftReviewContextBlocks(alert = {}) {
    const data = alert.data || {};
    const evidence = data.draft_evidence || {};
    const clientName = alert.client_name || data.client_name || data.profile_name || data.ig_username || 'client';
    const latest = evidence.current_message || data.message_preview || alert.description || '';
    const priorText = formatReviewList(evidence.prior_unanswered || data.recent_inbound_messages, m => `- "${truncate(m.text || m.message || '', 220)}"`);
    const timelineText = evidence.recent_timeline || '';
    const activityText = evidence.recent_activity || '';
    const workoutText = evidence.recent_workouts || '';
    const memoryText = evidence.memory_context || '';
    const shannonDayText = evidence.shannon_day_context || '';
    const checkinText = evidence.checkin_thread_context || '';
    const crossChannelText = evidence.cross_channel_context || '';
    const learningReelText = evidence.learning_reel_context || buildLearningReelContextBlock(data);
    const exerciseLibrarySupportBlock = buildExerciseLibrarySupportBlock({
        currentMessage: latest,
        conversationText: [timelineText, crossChannelText, priorText].filter(Boolean).join('\n'),
        recentInboundMessages: evidence.prior_unanswered || data.recent_inbound_messages || [],
    });

    return [
        `Just-arrived message from ${clientName}: "${truncate(latest, 500)}"`,
        priorText ? `Prior unanswered messages:\n${priorText}` : '',
        timelineText ? `Recent timestamped timeline:\n${truncate(timelineText, 2400)}` : '',
        exerciseLibrarySupportBlock ? exerciseLibrarySupportBlock.trim() : '',
        activityText ? `Recent activity snapshot:\n${truncate(activityText, 1200)}` : '',
        workoutText ? `Exact recent workout logs:\n${truncate(workoutText, 1200)}` : '',
        memoryText ? `Memory/context used:\n${truncate(memoryText, 1200)}` : '',
        shannonDayText ? `Shannon self-story context:\n${truncate(shannonDayText, 900)}` : '',
        checkinText ? `Active check-in thread:\n${truncate(checkinText, 1200)}` : '',
        crossChannelText ? `Cross-channel context:\n${truncate(crossChannelText, 1200)}` : '',
        learningReelText ? `Recent sent learning reel context:\n${truncate(learningReelText, 1800)}` : '',
    ].filter(Boolean).join('\n\n');
}

function shouldRunDraftReview(alert = {}) {
    const data = alert.data || {};
    if (!alert.suggested_message) return false;
    if (hasDraftReview(data)) return false;
    if (data.client_manager_review_required || data.needs_you_required) return false;
    return true;
}

async function ensureDraftReview(alert = {}) {
    if (!shouldRunDraftReview(alert)) return alert;
    const contextBlocks = buildDraftReviewContextBlocks(alert);
    try {
        const result = await reviewDraftAndUpdateAlert({
            alertId: alert.id,
            draftText: alert.suggested_message,
            alertType: alert.alert_type,
            contextBlocks,
            clientName: alert.client_name || alert.data?.profile_name || alert.data?.ig_username || 'client',
            channelLabel: alert.data?.channel || 'in-app',
            existingContextReview: buildContextReviewInfo(alert),
        });
        return {
            ...alert,
            data: {
                ...(alert.data || {}),
                draft_review: result?.review || null,
                context_review: result?.contextReview?.required ? result.contextReview : null,
            },
        };
    } catch (error) {
        console.warn('[client-lead-manager] draft review failed:', error.message);
        return {
            ...alert,
            data: {
                ...(alert.data || {}),
                draft_review: {
                    verdict: 'warn',
                    confidence: 0,
                    summary: 'Client/lead manager could not verify this draft, so it needs manual eyes.',
                    issues: ['client_manager_review_failed'],
                    suggested_fix: 'Open the source conversation before sending.',
                    context_loss_suspected: false,
                    notification_required: true,
                    notification_reason: 'client_manager_review_failed',
                    reviewed_at: new Date().toISOString(),
                    reviewer_model: MANAGER_SOURCE,
                },
            },
        };
    }
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
    return referencesLearningReelFollowUpText(text);
}

function draftAsksWhatSentReelWas(draftText = '') {
    const value = String(draftText || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!value) return false;
    return /\b(what\s+(?:is|was)\s+(?:it|that|this|the reel|the video|the clip)|what'?s\s+(?:it|that|this)|which\s+(?:one|reel|video|clip)|what\s+was\s+that\s+(?:one\s+)?about)\b/i.test(value)
        || /\b(what was it|what is it|what's it|what was the recipe|what recipe was it)\b/i.test(value);
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
        labels.push('Shane/Fra/Miranda/Monica permanent Needs You route');
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
        labels.push(draftReviewNeedsYouLabel(data));
    } else if (draftReviewNeedsManualCheck(data)) {
        reasons.push('draft_review_manual_check');
        labels.push(draftReviewNeedsYouLabel(data));
    }
    if (referencesOutboundLearningReel(latestText) && learningReels.length === 0) {
        reasons.push('missing_learning_reel_context');
        labels.push('client may be referring to a reel but no sent-reel context is stored');
    }
    if (referencesOutboundLearningReel(latestText) && learningReels.length > 0 && draftAsksWhatSentReelWas(alert.suggested_message || data.draft_text || '')) {
        reasons.push('draft_ignored_learning_reel_context');
        labels.push('draft appears to ignore the stored sent-reel context');
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
        const reviewedAlert = await ensureDraftReview(alert);
        const classification = classifyNeedsYou(reviewedAlert);
        if (!classification.shouldRoute) continue;
        routed.push(await stampNeedsYouAlert(reviewedAlert, classification));
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
    draftReviewNeedsManualCheck,
    buildDraftReviewContextBlocks,
    shouldRunDraftReview,
};
