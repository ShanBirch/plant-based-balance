/**
 * client-lead-manager - scheduled Needs You router.
 *
 * Runs over pending DM alerts and stamps the cases Shannon explicitly needs
 * to inspect. For cold leads, keep Needs You narrow: confusion, AI/authenticity
 * suspicion, or missing source/media/thread context.
 */

const {
    supabaseQuery,
    buildMediaReviewInfo,
    buildContextReviewInfo,
    isAlwaysNeedsYouPerson,
    reviewDraftAndUpdateAlert,
    normalizeCoachDraftText,
    normalizeLearningReelHistory,
    referencesLearningReelFollowUpText,
    getAppProblemAutoSendHoldReason,
    truncate,
} = require('./_lib/client-context');
const {
    buildExerciseLibrarySupportBlock,
    classifyExerciseLibrarySupport,
} = require('./_lib/exercise-library-search');

const MANAGER_SOURCE = 'balance-lead-client-manager';
const MAX_PER_RUN = 80;
const DEFAULT_AI_DRAFT_REVIEWS_PER_RUN = 8;
const DM_ALERT_TYPES = ['incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm'];
const APPROVED_COACHING_URL = 'https://future-balance.netlify.app/coaching.html';
const APPROVED_COACHING_LINK_SEND_DELAY_MS = 2 * 60 * 1000;

function parseNonNegativeInteger(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
}

function resolveAiDraftReviewLimit(value = process.env.CLIENT_LEAD_MANAGER_AI_REVIEW_LIMIT) {
    return Math.min(MAX_PER_RUN, parseNonNegativeInteger(value, DEFAULT_AI_DRAFT_REVIEWS_PER_RUN));
}

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

function isAcquisitionLeadAlert(alert = {}) {
    const data = alert.data || {};
    const alertType = String(alert.alert_type || data.alert_type || '').toLowerCase();
    const channel = String(data.channel || data.delivery_channel || '').toLowerCase();
    const lifecycleStage = String(data.lifecycle?.stage || '').toLowerCase();
    const leadStage = String(data.lead_stage || lifecycleStage || 'new').toLowerCase();
    const isIgOrFbLeadChannel = ['ig_incoming_dm', 'fb_incoming_dm'].includes(alertType)
        || ['instagram', 'messenger', 'facebook'].includes(channel)
        || !!data.ig_thread_id;
    if (!isIgOrFbLeadChannel) return false;
    if (alert.client_id || data.linked_user_id || data.linked_client_name) return false;
    return !['in_app', 'paying', 'paid', 'client', 'trial', 'churned'].includes(leadStage);
}

function numberFromAny(...values) {
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

function getMediaContextCounts(data = {}) {
    const decode = data.media_decode || data.mediaDecode || {};
    return {
        photoUrl: numberFromAny(data.photo_url_count, data.image_url_count, decode.photo_url_count, decode.image_url_count),
        photoInline: numberFromAny(data.photo_inline_count, data.image_inline_count, decode.photo_inline_count, decode.image_inline_count),
        audioUrl: numberFromAny(data.audio_url_count, decode.audio_url_count),
        audioInline: numberFromAny(data.audio_inline_count, decode.audio_inline_count),
        videoUrl: numberFromAny(data.video_url_count, decode.video_url_count),
        videoInline: numberFromAny(data.video_inline_count, decode.video_inline_count),
        reelContext: numberFromAny(data.reel_context_count, decode.reel_context_count),
        photoFailed: decode.photo_failed === true,
        audioFailed: decode.audio_failed === true,
        videoFailed: decode.video_failed === true,
    };
}

function leadMediaContextMissing(data = {}, mediaReview = {}) {
    if (!mediaReview?.hasMedia) return false;
    const counts = getMediaContextCounts(data);
    if (counts.photoFailed || counts.audioFailed || counts.videoFailed) return true;
    if (counts.photoUrl > 0 && counts.photoInline <= 0) return true;
    if (counts.audioUrl > 0 && counts.audioInline <= 0) return true;
    if (counts.videoUrl > 0 && counts.videoInline <= 0 && counts.reelContext <= 0) return true;
    return false;
}

function leadLatestClearlyNeedsPriorContext(data = {}, contextReview = {}) {
    const latest = String(
        contextReview.latest_text
        || data.message_preview
        || data.draft_evidence?.current_message
        || ''
    ).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!latest) return false;
    return /\b(that|this|it|they|them|those|there|one|same|again|earlier|previous|last one|which one|what do you mean|wat do u mean|wdym|reel|clip|video|story|post)\b/i.test(latest)
        || /^(yes|yeah|yep|yup|nah|no|nope|ok|okay|cool|sure|haha|lol|same|me too|exactly|true|fair|maybe|sounds good|all good)\b/i.test(latest);
}

function latestLeadText(data = {}) {
    return String(
        data.message_preview
        || data.draft_evidence?.current_message
        || data.client_message
        || ''
    ).trim();
}

function leadReferencesLearningReel(data = {}) {
    return referencesLearningReelFollowUpText(latestLeadText(data));
}

function leadHasLearningReelContext(data = {}) {
    return normalizeLearningReelHistory(data).length > 0;
}

function draftMentionsLearningReelAnchor(draftText = '', data = {}) {
    const text = String(draftText || '').toLowerCase();
    if (!text) return false;
    const latest = normalizeLearningReelHistory(data)[0] || {};
    const anchors = [
        latest.title,
        latest.channel_title,
        latest.topic_label,
        latest.topic_id,
        ...(String(latest.title || '').match(/[a-z0-9]{5,}/gi) || []),
        ...(String(latest.channel_title || '').match(/[a-z0-9]{5,}/gi) || []),
    ]
        .map(value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
        .filter(value => value.length >= 4);
    return anchors.some(anchor => text.includes(anchor));
}

function draftIgnoredLearningReelContext(alert = {}) {
    const data = alert.data || {};
    if (!leadReferencesLearningReel(data) || !leadHasLearningReelContext(data)) return false;
    const draftText = normalizeCoachDraftText(alert.suggested_message || data.draft_text || '').trim();
    if (!draftText) return false;
    if (draftMentionsLearningReelAnchor(draftText, data)) return false;
    return /\bwhat (?:was|is)(?: it| that| this| the reel| the video| the clip)|what'?s (?:it|that|this)|which (?:one|reel|video|clip)|not sure what|send it again\b/i.test(draftText);
}

function contextReviewShouldRouteForLead(data = {}, contextReview = {}, mediaReview = {}) {
    const reasons = new Set(Array.isArray(contextReview.reasons) ? contextReview.reasons : []);
    if (reasons.has('ai_suspicion_or_authenticity_question')) return true;
    if (reasons.has('client_does_not_understand_context')) return true;

    const missingMedia = leadMediaContextMissing(data, mediaReview);
    if (missingMedia) return true;

    const missingThreadReasons = [
        'manychat_reconcile_latest_only',
        'first_captured_reply_with_hidden_context',
        'reference_heavy_reply_without_tracked_context',
    ];
    if (!mediaReview?.hasMedia
        && missingThreadReasons.some(reason => reasons.has(reason))
        && leadLatestClearlyNeedsPriorContext(data, contextReview)) {
        return true;
    }

    return false;
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

function draftReviewText(data = {}) {
    const review = normalizeDraftReview(data);
    return [
        review.verdict,
        review.notification_reason,
        review.summary,
        review.suggested_fix,
        review.suggestedFix,
        ...(Array.isArray(review.issues) ? review.issues : []),
    ].map(v => String(v || '').toLowerCase()).join(' ');
}

function draftReviewNeedsManualCheck(data = {}) {
    const review = normalizeDraftReview(data);
    if (!review || Object.keys(review).length === 0) return false;
    if (draftReviewNeedsContext(data)) return true;
    const verdict = String(review.verdict || '').trim().toLowerCase();
    const reason = String(review.notification_reason || review.notificationReason || '').trim().toLowerCase();

    const text = [
        reason,
        review.summary,
        review.suggested_fix,
        review.suggestedFix,
        ...(Array.isArray(review.issues) ? review.issues : []),
    ].map(v => String(v || '').toLowerCase()).join(' ');
    const hardManualSignal = /\b(context[_ -]?loss|missing[_ -]?(?:source[_ -]?)?context|missing thread|missing conversation|unclear context|lost context|open (?:the )?(?:source )?dm|manual check|needs? (?:shannon|human|manual)|non[-_ ]?sequitur|ignored[_ -]?latest(?:[_ -]?message)?|unsupported[_ -]?claim|media[_ -]?review|voice[_ -]?note|ai[_ -]?suspicion|authenticity|does(?:n'?t| not) follow|out of context|safety|medical|diagnosis|treatment|pregnancy|eating[_ -]?disorder|body[_ -]?image|crisis|self[-_ ]?harm|non[_ -]?approved[_ -]?link)\b/i;

    if (review.notification_required === true) {
        return hardManualSignal.test(text) || reason === 'draft_review_required';
    }
    if (verdict === 'block') return true;
    if (reason && reason !== 'none') return hardManualSignal.test(text);
    return hardManualSignal.test(text);
}

function draftReviewNeedsLeadManualCheck(data = {}, mediaReview = {}) {
    if (draftReviewNeedsContext(data)) return true;
    const text = draftReviewText(data);
    if (/\b(ai|a\.?i\.?|bot|robot|automation|automated|authenticity|real person|not really shannon)\b/i.test(text)) return true;
    if (/\b(confus(?:ed|ing)|what do you mean|wdym|does(?:n'?t| not) follow|ignored[_ -]?latest(?:[_ -]?message)?|non[-_ ]?sequitur|out of context|missing source|source dm|unseen)\b/i.test(text)) return true;
    if (leadMediaContextMissing(data, mediaReview) && /\b(media|photo|image|video|reel|audio|voice note|context|open source|manual check)\b/i.test(text)) return true;
    return false;
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

function draftReviewPassedForAutoSend(data = {}) {
    const review = normalizeDraftReview(data);
    return String(review.verdict || '').toLowerCase() === 'pass'
        && Number(review.confidence || 0) >= 0.72
        && review.notification_required !== true
        && review.context_loss_suspected !== true;
}

function hasApprovedCoachingLinkHandoff(alert = {}) {
    const data = alert.data || {};
    const url = String(data.signup_link_handoff_url || data.signupLinkHandoffUrl || '').trim();
    const replyText = normalizeCoachDraftText(alert.scheduled_reply_text || alert.suggested_message || data.draft_text || '').trim();
    return data.approved_link_auto_sendable === true
        && data.signup_link_manual_only !== true
        && data.client_manager_review_required !== true
        && data.needs_you_required !== true
        && url === APPROVED_COACHING_URL
        && replyText.includes(APPROVED_COACHING_URL);
}

function shouldAutoScheduleApprovedCoachingHandoff(alert = {}, classification = {}) {
    if (!alert || alert.status !== 'pending') return false;
    if (classification?.shouldRoute) return false;
    if (!hasApprovedCoachingLinkHandoff(alert)) return false;
    return draftReviewPassedForAutoSend(alert.data || {});
}

function buildApprovedCoachingAutoSchedulePatch(alert = {}, now = new Date()) {
    const data = alert.data || {};
    const nowIso = now.toISOString();
    const scheduledFor = new Date(now.getTime() + APPROVED_COACHING_LINK_SEND_DELAY_MS).toISOString();
    const replyText = normalizeCoachDraftText(alert.scheduled_reply_text || alert.suggested_message || data.draft_text || '').trim();
    return {
        status: 'scheduled',
        scheduled_for: scheduledFor,
        scheduled_reply_text: replyText,
        scheduled_at: nowIso,
        data: {
            ...data,
            scheduled_via: 'auto_send',
            scheduled_was_edited: false,
            scheduled_send_in_ms: APPROVED_COACHING_LINK_SEND_DELAY_MS,
            schedule_reason: 'Client/lead manager approved the Starter Coaching link handoff; accelerated sales follow-up.',
            auto_send_review_approved_at: nowIso,
            auto_send_review_approved_by: MANAGER_SOURCE,
            client_manager_auto_scheduled_at: nowIso,
            client_manager_auto_schedule_reason: 'approved_starter_coaching_link_handoff',
            reply_timing_choice: {
                action: 'schedule',
                chosen_delay_ms: APPROVED_COACHING_LINK_SEND_DELAY_MS,
                chosen_at: nowIso,
                source: MANAGER_SOURCE,
            },
            reply_timing_suggestion: {
                action: 'schedule',
                delay_ms: APPROVED_COACHING_LINK_SEND_DELAY_MS,
                label: '2 min',
                reason: 'Approved Starter Coaching link handoff; keep the sales moment warm.',
                confidence: 0.9,
                signals: {
                    approved_starter_coaching_link_handoff: true,
                },
            },
        },
    };
}

function formatReviewList(items, mapper) {
    const rows = (Array.isArray(items) ? items : [])
        .map(mapper)
        .map(v => String(v || '').trim())
        .filter(Boolean);
    return rows.length ? rows.join('\n') : '';
}

function buildExerciseSupportClassification(alert = {}) {
    const data = alert.data || {};
    const evidence = data.draft_evidence || {};
    const latest = evidence.current_message || data.message_preview || alert.description || '';
    const priorText = formatReviewList(evidence.prior_unanswered || data.recent_inbound_messages, m => `- "${truncate(m.text || m.message || '', 220)}"`);
    const conversationText = [
        evidence.recent_timeline || '',
        evidence.cross_channel_context || '',
        data.last_outbound_message || data.last_shannon_message || '',
        priorText,
    ].filter(Boolean).join('\n');
    return classifyExerciseLibrarySupport({
        currentMessage: latest,
        conversationText,
        recentInboundMessages: evidence.prior_unanswered || data.recent_inbound_messages || [],
    });
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

function classifyNeedsYou(alert = {}) {
    const data = alert.data || {};
    const mediaReview = buildMediaReviewInfo(alert);
    const contextReview = buildContextReviewInfo(alert);
    const exerciseSupport = buildExerciseSupportClassification(alert);
    const exerciseLookupFastTrack = exerciseSupport.isSupport && exerciseSupport.canFastTrack;
    const acquisitionLead = isAcquisitionLeadAlert(alert);
    const leadMissingMediaContext = acquisitionLead && leadMediaContextMissing(data, mediaReview);
    const missingLearningReelContext = acquisitionLead && leadReferencesLearningReel(data) && !leadHasLearningReelContext(data);
    const reasons = [];
    const labels = [];
    const appProblemHold = getAppProblemAutoSendHoldReason({
        currentMessage: latestLeadText(data),
        draftText: alert.suggested_message || data.draft_text || '',
        alertData: data,
    });

    if (missingLearningReelContext) {
        reasons.push('missing_learning_reel_context');
        labels.push('lead is asking about a reel but no stored reel context is available');
    }
    if (acquisitionLead && draftIgnoredLearningReelContext(alert)) {
        reasons.push('draft_ignored_learning_reel_context');
        labels.push('draft ignored the stored reel context');
    }
    if (exerciseSupport.confusedFollowup) {
        reasons.push('exercise_lookup_confused_followup');
        labels.push('exercise lookup got confusing, send a holding reply and leave it for Shannon');
    }
    if (!acquisitionLead && isAlwaysNeedsYouPerson(alertIdentity(alert)) && !exerciseLookupFastTrack) {
        reasons.push('always_needs_you_person');
        labels.push('Shane/Fra/Monica permanent Needs You route');
    }
    if (appProblemHold) {
        reasons.push(appProblemHold.code);
        labels.push(appProblemHold.label);
    }
    if (mediaReview.required && !exerciseLookupFastTrack && (!acquisitionLead || leadMissingMediaContext)) {
        reasons.push('media_review_required');
        labels.push(acquisitionLead
            ? `${mediaReview.label || 'media'} context did not come through cleanly`
            : (mediaReview.label || 'media needs Shannon review'));
    }
    if (contextReview.required && (!acquisitionLead || contextReviewShouldRouteForLead(data, contextReview, mediaReview))) {
        reasons.push(...contextReview.reasons);
        labels.push(contextReview.label || 'tracked context may be incomplete');
    }
    if (draftReviewNeedsContext(data)) {
        reasons.push('draft_review_context_loss');
        labels.push(draftReviewNeedsYouLabel(data));
    } else if (acquisitionLead ? draftReviewNeedsLeadManualCheck(data, mediaReview) : draftReviewNeedsManualCheck(data)) {
        reasons.push('draft_review_manual_check');
        labels.push(draftReviewNeedsYouLabel(data));
    }

    const uniqueReasons = [...new Set(reasons.filter(Boolean))];
    const uniqueLabels = [...new Set(labels.filter(Boolean))];
    return {
        shouldRoute: uniqueReasons.length > 0,
        reasons: uniqueReasons,
        label: uniqueLabels.join(', ') || 'Needs Shannon review',
        mediaReview,
        contextReview,
        exerciseSupport,
    };
}

function buildNeedsYouData(alert, classification) {
    const data = alert.data || {};
    const reason = classification.label;
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
        operator_queue: 'needs_you',
        codex_review: {
            ...existingReview,
            source: MANAGER_SOURCE,
            decision: 'client_manager_review_required',
            queue: 'needs_you',
            needs_shannon_approval: true,
            reason,
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

async function scheduleApprovedCoachingHandoff(alert) {
    const patch = buildApprovedCoachingAutoSchedulePatch(alert);
    const rows = await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=representation',
    });
    const scheduled = rows?.[0];
    if (!scheduled) return null;
    return {
        id: alert.id,
        client_name: alert.client_name || patch.data.profile_name || patch.data.ig_username || null,
        scheduled_for: patch.scheduled_for,
        reason: 'approved Starter Coaching link handoff',
    };
}

async function runClientLeadManager({ limit = MAX_PER_RUN, aiDraftReviewLimit = resolveAiDraftReviewLimit() } = {}) {
    const alerts = await loadPendingDmAlerts(limit);
    const routed = [];
    const autoScheduled = [];
    let autoScheduleFailed = 0;
    let aiDraftReviewsAttempted = 0;
    let aiDraftReviewsSkipped = 0;
    const maxAiDraftReviews = parseNonNegativeInteger(aiDraftReviewLimit, DEFAULT_AI_DRAFT_REVIEWS_PER_RUN);
    for (const alert of alerts) {
        const needsDraftReview = shouldRunDraftReview(alert);
        const approvedSalesHandoff = needsDraftReview && hasApprovedCoachingLinkHandoff(alert);
        const canRunDraftReview = needsDraftReview
            && maxAiDraftReviews > 0
            && (aiDraftReviewsAttempted < maxAiDraftReviews || approvedSalesHandoff);
        const reviewedAlert = canRunDraftReview ? await ensureDraftReview(alert) : alert;
        if (canRunDraftReview) {
            aiDraftReviewsAttempted++;
        } else if (needsDraftReview) {
            aiDraftReviewsSkipped++;
        }
        const classification = classifyNeedsYou(reviewedAlert);
        if (classification.shouldRoute) {
            routed.push(await stampNeedsYouAlert(reviewedAlert, classification));
            continue;
        }
        if (shouldAutoScheduleApprovedCoachingHandoff(reviewedAlert, classification)) {
            try {
                const scheduled = await scheduleApprovedCoachingHandoff(reviewedAlert);
                if (scheduled) autoScheduled.push(scheduled);
            } catch (error) {
                autoScheduleFailed++;
                console.warn('[client-lead-manager] approved coaching handoff schedule failed:', error.message);
            }
        }
    }
    return {
        scanned: alerts.length,
        routed: routed.length,
        auto_scheduled: autoScheduled.length,
        auto_schedule_failed: autoScheduleFailed,
        ai_draft_reviews_attempted: aiDraftReviewsAttempted,
        ai_draft_review_limit: maxAiDraftReviews,
        ai_draft_reviews_skipped: aiDraftReviewsSkipped,
        routed_alerts: routed,
        auto_scheduled_alerts: autoScheduled,
    };
}

exports.handler = async () => {
    try {
        const result = await runClientLeadManager();
        console.info('[client-lead-manager] scheduled run complete', JSON.stringify({
            at: new Date().toISOString(),
            scanned: result.scanned,
            routed: result.routed,
            auto_scheduled: result.auto_scheduled,
            auto_schedule_failed: result.auto_schedule_failed,
            ai_draft_reviews_attempted: result.ai_draft_reviews_attempted,
            ai_draft_review_limit: result.ai_draft_review_limit,
            ai_draft_reviews_skipped: result.ai_draft_reviews_skipped,
        }));
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
    draftReviewNeedsLeadManualCheck,
    buildDraftReviewContextBlocks,
    shouldRunDraftReview,
    resolveAiDraftReviewLimit,
    isAcquisitionLeadAlert,
    leadMediaContextMissing,
    draftReviewPassedForAutoSend,
    hasApprovedCoachingLinkHandoff,
    shouldAutoScheduleApprovedCoachingHandoff,
    buildApprovedCoachingAutoSchedulePatch,
};
