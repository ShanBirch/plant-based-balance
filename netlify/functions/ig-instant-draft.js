/**
 * ig-instant-draft — produces an AI draft reply for an inbound Instagram DM
 * captured by the manychat-inbound webhook.
 *
 * Mirrors instant-coach-draft.js for the in-app DM path with channel-specific
 * differences:
 *
 *   - Conversation history comes from ig_messages, not nudges.
 *   - Client identity is by ManyChat subscriber_id, not users.id. The IG
 *     thread might have a linked_user_id (lead converted to app user) — when
 *     present we also load client_memory so the voice stays consistent.
 *   - Coach_alert row is alert_type='ig_incoming_dm' and stamped with
 *     data.channel='instagram' so send-coach-reply routes the outbound
 *     through ManyChat instead of the in-app nudges path.
 *   - IG/FB auto-send is opt-in per thread and schedules through the same
 *     delayed worker path Shannon uses from the admin dashboard.
 *
 * Trigger: POST from manychat-inbound after it has persisted the inbound
 * message and upserted the thread.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    loadCoachDayContext,
    buildCoachDayContextBlock,
    shouldIncludeCoachDayContext,
    cancelPriorScheduledForIgThread,
    selectRecentInboundSinceLastReplyIg,
    normalizeLearningReelHistory,
    buildLearningReelContextBlock,
    buildLearningReelReplyAnchorBlock,
    resolveLifecycleStage,
    lifecycleForFcmData,
    fireDraftReasoning,
    fireCoachDraftShadow,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildCoachBioBlock,
    buildAppNavigationGuideBlock,
    buildAppXpGuideBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    buildDailyGreetingPolicyBlock,
    shouldAllowDailyGreeting,
    isAlwaysNeedsYouPerson,
    buildShannonDmTuningBlock,
    buildOpenAIShannonVoiceBlock,
    loadEditExamples,
    loadResponseTimingProfile,
    buildReplyTimingSuggestion,
    loadOnboardingPhase,
    loadRecentWorkouts,
    formatRecentWorkoutEvidence,
    loadWeeklyAppContext,
    loadActiveCheckinThreadContext,
    buildCheckinConversationBlock,
    callVertexAIModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    normalizeCoachDraftChunks,
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    stripLeadingGreeting,
    truncate,
    truncateTail,
    formatCoachLocalTimestamp,
    formatTimedConversationLine,
    buildMessageMediaBatchParts,
    normalizeImplicitMediaMarkers,
    replacePhotoMarkers,
    replaceAudioMarkers,
    extractPhotoUrls,
    extractAudioUrls,
    extractVideoUrls,
    replaceVideoMarkers,
    buildMediaReviewInfo,
    buildContextReviewInfo,
    reviewDraftAndUpdateAlert,
    isDraftReviewAutoSendSafe,
    isTestAccount,
    isAiAutomationOptedOut,
} = require('./_lib/client-context');

const {
    isQualifierEligible,
    evaluateQualifier,
    persistQualifier,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
    buildQualifierRelationshipBlock,
    cleanFactValue,
    isUnsafeStockDiscoveryQuestion,
    hasChallengeInviteReadinessSignal,
    countMeaningfulLeadReplies,
    hasEarnedChallengeInviteMoment,
    isPrematureChallengeInvite,
    isChallengeOfferWarningText,
} = require('./_lib/qualifier-engine');
const {
    detectProposedCoachActions,
    mergeProposedActions,
} = require('./_lib/coach-actions');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const HISTORY_LIMIT = 40;
const MAX_CHUNKS = 3;
const DEEP_REPLY_MAX_CHUNKS = 4;
const DEEP_REPLY_MAX_OUTPUT_TOKENS = 8192;
const LONG_DRAFT_PUSH_COMPACT_AT = 2400;
// When a lead fires multiple messages before Shannon replies, coalesce them
// onto the existing pending alert instead of stacking pushes. The draft is
// regenerated against the full message history, so the reply addresses the
// whole unanswered streak in one shot. Keep this wide enough for ManyChat and
// the reconcile worker to arrive a few minutes apart.
const PENDING_THREAD_COALESCE_LOOKBACK_HOURS = 24;
const IG_AUTO_SEND_DEFAULT_DELAY_MS = 30 * 60 * 1000;
const IG_AUTO_SEND_MIN_DELAY_MS = 15 * 60 * 1000;
const IG_AUTO_SEND_MAX_DELAY_MS = 8 * 60 * 60 * 1000;
const IG_DRAFT_REVIEW_TIMEOUT_MS = 7000;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';

function graphSubscriberParts(subscriberId = '') {
    const raw = String(subscriberId || '');
    if (!raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)) return { accountId: '', recipientId: '' };
    const suffix = raw.slice(GRAPH_SUBSCRIBER_PREFIX.length);
    const parts = suffix.split(':').filter(Boolean);
    if (parts.length >= 2) {
        return { accountId: parts[0], recipientId: parts[parts.length - 1] };
    }
    return { accountId: '', recipientId: suffix };
}

function envFlagEnabled(value) {
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}
const INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED = envFlagEnabled(
    process.env.INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.IG_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.META_HUMAN_AGENT_ENABLED
);
const HUMAN_AGENT_NOT_APPROVED_MESSAGE = 'Meta Human Agent is still only ready for testing, so replies after 24 hours need to be copied/sent manually in Instagram until the feature is approved.';

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanGraphData(value) {
    const data = { ...safeObject(value) };
    delete data.manual_ig_required;
    return data;
}

function resolveThreadGraphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const candidates = [
        graph.ig_graph_user_id,
        graph.recipient_id,
        customData.ig_graph_user_id,
        thread.ig_graph_recipient_id,
    ];
    const subscriberId = String(thread.subscriber_id || '');
    if (subscriberId.startsWith(GRAPH_SUBSCRIBER_PREFIX)) {
        candidates.push(graphSubscriberParts(subscriberId).recipientId);
    }
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function resolveThreadGraphAccountId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return String(
        graph.ig_account_id
        || graph.account_id
        || graph.owner_id
        || customData.ig_graph_account_id
        || customData.ig_account_id
        || customData.owner_ig_user_id
        || graphSubscriberParts(thread.subscriber_id).accountId
        || ''
    ).trim();
}

function hoursSinceIso(value, nowMs = Date.now()) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

function isHumanAgentWindow(value) {
    const hours = hoursSinceIso(value);
    return hours !== null && hours > 24 && hours <= 24 * 7;
}

function resolveIgAutoSendDelayMs(responseTimingProfile) {
    const learned = Number(responseTimingProfile?.recommendation_delay_ms);
    const base = Number.isFinite(learned) && learned > 0
        ? learned
        : IG_AUTO_SEND_DEFAULT_DELAY_MS;
    return Math.min(IG_AUTO_SEND_MAX_DELAY_MS, Math.max(IG_AUTO_SEND_MIN_DELAY_MS, base));
}

function formatAutoDelayLabel(delayMs) {
    const mins = Math.round((Number(delayMs) || 0) / 60000);
    if (mins <= 0) return 'send now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.round((mins / 60) * 10) / 10;
    return `${hours}h`;
}

function normalizeIgAutoTimingSuggestion({ timingSuggestion, delayMs, timingLabel }) {
    const rawDelay = Number(timingSuggestion?.delay_ms ?? delayMs ?? IG_AUTO_SEND_DEFAULT_DELAY_MS);
    const normalizedDelayMs = Number.isFinite(rawDelay)
        ? Math.min(IG_AUTO_SEND_MAX_DELAY_MS, Math.max(IG_AUTO_SEND_MIN_DELAY_MS, Math.round(rawDelay)))
        : IG_AUTO_SEND_DEFAULT_DELAY_MS;
    const adjustedForMinimum = Number.isFinite(rawDelay) && normalizedDelayMs !== Math.round(rawDelay);
    const action = normalizedDelayMs === 0 ? 'send_now' : 'schedule';
    const baseReason = String(timingSuggestion?.reason || 'auto DM contextual timing').slice(0, 220);
    return {
        action,
        delay_ms: normalizedDelayMs,
        preset_value: String(timingSuggestion?.preset_value || '').slice(0, 40),
        label: adjustedForMinimum
            ? formatAutoDelayLabel(normalizedDelayMs)
            : String(timingSuggestion?.label || timingLabel || formatAutoDelayLabel(normalizedDelayMs)).slice(0, 40),
        reason: adjustedForMinimum
            ? `${baseReason}; held for auto-send review window`.slice(0, 240)
            : baseReason,
        confidence: Number.isFinite(Number(timingSuggestion?.confidence)) ? Number(timingSuggestion.confidence) : null,
        signals: timingSuggestion?.signals && typeof timingSuggestion.signals === 'object'
            ? timingSuggestion.signals
            : {},
    };
}

function buildIgAutoTimingSuggestion(alertLike, replyText) {
    const suggestion = buildReplyTimingSuggestion(alertLike, replyText);
    if (suggestion) return suggestion;
    const delayMs = resolveIgAutoSendDelayMs(alertLike?.data?.response_timing_profile);
    return {
        action: delayMs ? 'schedule' : 'send_now',
        delay_ms: delayMs,
        label: formatAutoDelayLabel(delayMs),
        reason: 'auto DM fallback timing',
        confidence: null,
        signals: { fallback: true },
    };
}

function withTimeout(promise, timeoutMs, label) {
    let timeoutId = null;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label || 'operation'} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}

async function scheduleIgAutoReplyDirect({ alertId, alertData, replyText, delayMs, timingLabel, timingSuggestion }) {
    if (!alertId || !replyText) throw new Error('missing alertId or replyText');
    const normalizedTiming = normalizeIgAutoTimingSuggestion({ timingSuggestion, delayMs, timingLabel });
    const scheduledAt = new Date();
    const scheduledFor = new Date(scheduledAt.getTime() + normalizedTiming.delay_ms);
    const mergedData = {
        ...(alertData || {}),
        scheduled_via: 'auto_send',
        scheduled_was_edited: false,
        scheduled_send_in_ms: normalizedTiming.delay_ms,
        scheduled_at: scheduledAt.toISOString(),
        schedule_reason: normalizedTiming.action === 'send_now'
            ? 'Auto DM recommended sending now; queued for worker dispatch.'
            : 'Auto DM enabled; delayed using contextual timing.',
        reply_timing_choice: {
            action: normalizedTiming.action,
            chosen_delay_ms: normalizedTiming.delay_ms,
            chosen_at: scheduledAt.toISOString(),
            source: 'auto_send',
        },
        reply_timing_suggestion: normalizedTiming,
    };
    const rows = await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`, {
        method: 'PATCH',
        body: {
            status: 'scheduled',
            scheduled_for: scheduledFor.toISOString(),
            scheduled_reply_text: normalizeCoachDraftText(replyText || '').trim(),
            scheduled_at: scheduledAt.toISOString(),
            data: mergedData,
        },
        prefer: 'return=representation',
    });
    if (rows?.[0]) {
        return { scheduledFor: scheduledFor.toISOString(), data: mergedData, alreadyActioned: false, timing: normalizedTiming };
    }
    const currentRows = await supabaseQuery(
        `coach_alerts?select=status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    const currentStatus = currentRows?.[0]?.status || 'missing';
    if (currentStatus === 'scheduled' || currentStatus === 'sent') {
        return { scheduledFor: null, data: currentRows[0]?.data || alertData || {}, alreadyActioned: true, timing: normalizedTiming };
    }
    throw new Error(`alert not pending for auto schedule: ${currentStatus}`);
}

const COCOS_SOFT_CONTEXT_REASONS = new Set([
    'first_captured_reply_with_hidden_context',
    'reference_heavy_reply_without_tracked_context',
    'draft_review_timeout',
]);
const COCOS_SIMPLE_OPENER_RE = /^(yo+|yoo+|hey+|heya+|hi+|hello+|hiya+|morning+|afternoon+|evening+|haha+|hahaha+|lol+|sup|what'?s up|whats up|thanks?|thank you|cheers|nice|sick|love it|haha yeah|yeah|yea|yep|yess?|yes|nah|no worries)[!?.\s]*$/i;
const COCOS_RISKY_REPLY_RE = /\b(challenge|join|joined|sign\s*up|signup|link|price|cost|program|plan|meal|workout|coach|coaching|injur|injury|pain|hurt|sore|hospital|doctor|medical|sorry|grief|death|died|anxiety|depress|sad|trauma|pregnan|calorie|macro|eating disorder)\b/i;
const COCOS_DRAFT_REVIEW_TIMEOUT_MS = 12000;
const COCOS_DRAFT_REPAIR_TIMEOUT_MS = 9000;
const BALANCE_SOFT_CONTEXT_REASONS = new Set(['draft_review_timeout']);

function draftTextFromDraft(draft) {
    if (!draft) return '';
    if (typeof draft === 'string') return normalizeCoachDraftText(draft).trim();
    if (draft.joined) return normalizeCoachDraftText(draft.joined).trim();
    if (Array.isArray(draft.messages)) return normalizeCoachDraftText(draft.messages.join('\n')).trim();
    return '';
}

function isReviewTimeoutOnly(draftReview) {
    if (!draftReview || typeof draftReview !== 'object') return false;
    const verdict = String(draftReview.verdict || '').toLowerCase();
    if (verdict === 'block') return false;
    if (draftReview.context_loss_suspected) return false;
    const issues = Array.isArray(draftReview.issues) ? draftReview.issues.map(v => String(v || '').toLowerCase()) : [];
    const reason = String(draftReview.notification_reason || '').toLowerCase();
    const summary = String(draftReview.summary || '').toLowerCase();
    return reason === 'review_timeout'
        || issues.includes('review_timeout')
        || /review did not finish|review timeout|timed out/.test(summary);
}

function reviewLooksLikePureContextGap(review) {
    if (!review) return false;
    if (review.context_loss_suspected) return true;
    const haystack = [
        review.notification_reason,
        review.summary,
        review.suggested_fix,
        ...(Array.isArray(review.issues) ? review.issues : []),
    ].filter(Boolean).join(' ').toLowerCase();
    return /\b(context[-_ ]?loss|missing[-_ ]?source[-_ ]?context|missing[-_ ]?context|open (?:the )?(?:source )?dm|source dm|tracked dm context may be incomplete)\b/.test(haystack);
}

function collectCocosAutoRepairIssues({ draft, draftReview, challengeOfferWarning, currentMessage, qualifier, leadStage, linkedUserId, meaningfulLeadReplyCount }) {
    const issues = [];
    const draftText = draftTextFromDraft(draft);
    const challengeOfferAllowed = hasChallengeInviteReadinessSignal(currentMessage)
        || hasEarnedChallengeInviteMoment({ qualifier, currentMessage, leadReplyCount: meaningfulLeadReplyCount })
        || ['pitched', 'won'].includes(qualifier?.stage)
        || linkedUserId
        || ['in_app', 'paying', 'invited'].includes(leadStage);
    const prematureChallengeInvite = isPrematureChallengeInvite({
        draftText,
        currentMessage,
        qualifier,
        leadStage,
        linkedUserId,
        leadReplyCount: meaningfulLeadReplyCount,
    });
    if (draftReview && !isDraftReviewAutoSendSafe(draftReview) && !isReviewTimeoutOnly(draftReview) && !reviewLooksLikePureContextGap(draftReview)) {
        if (draftReview.summary) issues.push(`Reviewer summary: ${draftReview.summary}`);
        const reviewIssues = Array.isArray(draftReview.issues) ? draftReview.issues.filter(Boolean) : [];
        reviewIssues.slice(0, 4).forEach(issue => issues.push(`Reviewer issue: ${issue}`));
        if (draftReview.suggested_fix) issues.push(`Reviewer suggested fix: ${draftReview.suggested_fix}`);
    }
    if (challengeOfferWarning?.required && !challengeOfferAllowed) {
        issues.push('Draft appears to offer or link the free challenge. Remove the pitch unless the latest message clearly asks how to start or asks for the link.');
    }
    if (isUnsafeStockDiscoveryQuestion(draftText)) {
        issues.push('Draft uses a stock discovery question. Replace it with a specific reply to the latest detail, or no question if a reaction is enough.');
    }
    if (prematureChallengeInvite) {
        issues.push('Draft invites the challenge before the person has shown enough readiness or 3 meaningful lead replies. Keep rapport moving instead.');
    }
    return [...new Set(issues.map(issue => truncate(String(issue || '').replace(/\s+/g, ' ').trim(), 220)).filter(Boolean))];
}

function shouldAttemptCocosDraftRepair({ cocosAutoSendLane, mediaReview, baseContextReview, draft, repairIssues }) {
    if (!cocosAutoSendLane) return false;
    if (!draftTextFromDraft(draft)) return false;
    if (mediaReview?.required) return false;
    if (baseContextReview?.required) return false;
    return Array.isArray(repairIssues) && repairIssues.length > 0;
}

function normalizeCocosRepairedDraft(rawText, maxChunks, leadName) {
    const parsed = parseDraftChunks(rawText, maxChunks || MAX_CHUNKS);
    const chunks = splitCoachDraftIntoDmBubbles(
        parsed.chunks
            .map(chunk => String(chunk || '').trim())
            .filter(Boolean)
    ).slice(0, maxChunks || MAX_CHUNKS);
    return { chunks, joined: chunks.join('\n') };
}

async function repairCocosDraftFromReview({ draft, repairIssues, reviewContextBlocks, leadName, channelLabel, maxChunks }) {
    const draftText = draftTextFromDraft(draft);
    if (!draftText || !repairIssues?.length) return null;
    const prompt = `You are repairing a Coco's PT Studio ${channelLabel || 'IG'} DM draft before it can auto-send for Shannon.

Return ONLY valid JSON in this format:
{"messages":["chunk 1","chunk 2 if needed"]}

Repair rules:
- Fix every issue below, then keep the reply natural enough that Shannon would be happy sending it untouched.
- Answer the latest inbound message first. If the latest message is simple, a short simple reply is better than a coaching paragraph.
- Keep Shannon's casual lower-case texting style. No corporate tone, no AI talk, no mention of auto-send, review, rules, or Coco's as a system.
- One natural question max. Skip the question when a reaction or direct answer is enough.
- Do not pitch, link, or offer the challenge unless the latest message clearly asks how to join or asks for the link.
- No em dashes.

ISSUES TO FIX:
${repairIssues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

CONTEXT THE ORIGINAL WRITER SAW:
${reviewContextBlocks || '(no context provided)'}

ORIGINAL DRAFT:
${draftText}`;
    const rawText = await callGeminiFallback(
        [{ role: 'user', parts: [{ text: prompt }] }],
        { maxOutputTokens: Math.min(1200, Math.max(500, (maxChunks || MAX_CHUNKS) * 280)), temperature: 0.35 }
    );
    const repaired = normalizeCocosRepairedDraft(rawText, maxChunks || draft.maxChunks || MAX_CHUNKS, leadName);
    if (!repaired.joined || repaired.joined === draftText) return null;
    return repaired;
}

async function persistCocosDraftRepair({ alertId, currentAlertData, draft, repairMeta, challengeOfferWarning }) {
    if (!alertId || !draft?.joined) return currentAlertData || {};
    try {
        const rows = await supabaseQuery(`coach_alerts?select=data&id=eq.${encodeURIComponent(alertId)}&limit=1`);
        const latest = rows[0]?.data || {};
        const merged = {
            ...latest,
            ...(currentAlertData || {}),
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || latest.draft_reply_mode || 'standard',
            draft_max_chunks: draft.maxChunks || latest.draft_max_chunks || MAX_CHUNKS,
            challenge_offer_warning: challengeOfferWarning || null,
            cocos_auto_repair: repairMeta,
        };
        if (repairMeta?.status === 'accepted' && !repairMeta?.auto_hold_code) {
            merged.auto_send_review_hold = null;
        }
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: {
                suggested_message: draft.joined,
                data: merged,
            },
            prefer: 'return=minimal',
        });
        return merged;
    } catch (err) {
        console.warn('[ig-draft] Coco draft repair alert update failed:', err.message);
        return currentAlertData || {};
    }
}

function getCocosAutoContextBypass({ cocosAutoSendLane, contextReview, draft, draftReview, currentMessage }) {
    if (!cocosAutoSendLane || !contextReview?.required) return null;
    const reasons = (Array.isArray(contextReview.reasons) ? contextReview.reasons : [contextReview.reason])
        .filter(Boolean)
        .map(v => String(v));
    if (!reasons.length || reasons.some(reason => !COCOS_SOFT_CONTEXT_REASONS.has(reason))) return null;
    if (!isReviewTimeoutOnly(draftReview)) return null;

    const latestText = normalizeCoachDraftText(currentMessage || contextReview.latest_text || '').trim();
    const draftText = draftTextFromDraft(draft);
    const timeoutOnly = reasons.length === 1 && reasons[0] === 'draft_review_timeout';
    const harmlessTrackedSmallTalk = timeoutOnly
        && contextReview.tracked_outbound_context === true
        && contextReview.context_dependent === false
        && latestText.length <= 160
        && !COCOS_RISKY_REPLY_RE.test(latestText);
    if (!latestText || (!COCOS_SIMPLE_OPENER_RE.test(latestText) && !harmlessTrackedSmallTalk)) return null;
    if (!draftText || draftText.length > 180 || COCOS_RISKY_REPLY_RE.test(draftText)) return null;

    return {
        allowed: true,
        reason: harmlessTrackedSmallTalk ? 'soft_tracked_small_talk' : 'soft_first_text_reply',
        context_reasons: reasons,
        draft_review_reason: 'review_timeout',
    };
}

function getBalanceAutoContextBypass({ balanceAutoSendLane, contextReview, draft, draftReview, currentMessage }) {
    if (!balanceAutoSendLane || !contextReview?.required) return null;
    const reasons = (Array.isArray(contextReview.reasons) ? contextReview.reasons : [contextReview.reason])
        .filter(Boolean)
        .map(v => String(v));
    if (!reasons.length || reasons.some(reason => !BALANCE_SOFT_CONTEXT_REASONS.has(reason))) return null;
    if (!isReviewTimeoutOnly(draftReview)) return null;

    const latestText = normalizeCoachDraftText(currentMessage || contextReview.latest_text || '').trim();
    const draftText = draftTextFromDraft(draft);
    const hasTrackedContext = contextReview.tracked_outbound_context === true;
    const contextIndependent = contextReview.context_dependent === false;
    if (!hasTrackedContext && !contextIndependent) return null;
    if (!latestText || latestText.length > 260 || COCOS_RISKY_REPLY_RE.test(latestText)) return null;
    if (!draftText || draftText.length > 260 || COCOS_RISKY_REPLY_RE.test(draftText)) return null;

    return {
        allowed: true,
        reason: contextIndependent ? 'soft_review_timeout_context_independent' : 'soft_review_timeout_tracked_context',
        context_reasons: reasons,
        draft_review_reason: 'review_timeout',
    };
}

function getAutoDmHoldReason({ mediaReview, contextReview, onboardingPhase, draft, draftReview, challengeOfferWarning, currentMessage, qualifier, leadStage, linkedUserId, meaningfulLeadReplyCount, contextBypass, cocosContextBypass }) {
    const effectiveContextBypass = contextBypass || cocosContextBypass;
    if (mediaReview?.required) {
        return {
            code: 'media_review',
            label: `${mediaReview.label || 'Media'} needs Shannon review`,
        };
    }
    if (contextReview?.required && !effectiveContextBypass?.allowed) {
        return {
            code: 'context_review',
            label: 'tracked DM context may be incomplete',
        };
    }
    if (onboardingPhase?.inOnboarding) {
        return {
            code: 'onboarding',
            label: 'lead is in onboarding/setup',
        };
    }
    if (draft?.error || !draft?.joined) {
        return {
            code: 'draft_unavailable',
            label: 'AI draft was unavailable',
        };
    }
    if (challengeOfferWarning?.required) {
        return {
            code: 'challenge_offer',
            label: `${challengeOfferWarning.label || 'free challenge invite'} needs timing review`,
        };
    }
    if (isUnsafeStockDiscoveryQuestion(draft.joined)) {
        return {
            code: 'stock_question',
            label: 'stock discovery question needs Shannon review',
        };
    }
    if (isPrematureChallengeInvite({ draftText: draft.joined, currentMessage, qualifier, leadStage, linkedUserId, leadReplyCount: meaningfulLeadReplyCount })) {
        return {
            code: 'premature_challenge_invite',
            label: 'free challenge invite needs human readiness first',
        };
    }
    if (draftReview && !isDraftReviewAutoSendSafe(draftReview) && !effectiveContextBypass?.allowed) {
        return {
            code: 'draft_review',
            label: draftReview?.summary || 'AI draft needs Shannon review',
        };
    }
    return null;
}

function clearStoredContextReview(data) {
    const next = { ...(data || {}) };
    delete next.context_review;
    delete next.contextReview;
    return next;
}

function resolveStaleContextAutoHold({ existingAlert, existingData }) {
    if (existingData?.auto_send_review_hold?.code !== 'context_review') return null;
    const refreshedContextReview = buildContextReviewInfo({
        alert_type: existingAlert?.alert_type,
        data: clearStoredContextReview(existingData),
    });
    if (refreshedContextReview.required) return null;
    return {
        refreshedContextReview,
        data: {
            ...clearStoredContextReview(existingData),
            context_review: null,
            contextReview: null,
            auto_send_review_hold: null,
            auto_send_context_hold_cleared_at: new Date().toISOString(),
            auto_send_context_hold_cleared_reason: 'tracked_context_available',
        },
    };
}

async function stampIgAutoSendHoldForReview({ thread, alertId, alertData, reason }) {
    if (!thread?.id || !reason) return alertData || null;
    const heldAt = new Date().toISOString();
    const heldData = {
        ...(alertData || {}),
        auto_send_enabled_at_draft: true,
        auto_send_review_hold: {
            code: reason.code,
            label: reason.label,
            held_at: heldAt,
        },
    };
    if (alertId) {
        try {
            await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                body: { data: heldData },
                prefer: 'return=minimal',
            });
        } catch (e) {
            console.warn('[ig-draft] failed to stamp auto-send hold reason:', e.message);
        }
    }
    return heldData;
}

async function clearIgAutoSendHoldForCurrentDraft({ alertId, alertData, reason = 'current_draft_passed_review' }) {
    if (!alertData?.auto_send_review_hold) return alertData || null;
    const clearedData = {
        ...(alertData || {}),
        auto_send_review_hold: null,
        auto_send_review_hold_cleared_at: new Date().toISOString(),
        auto_send_review_hold_cleared_reason: reason,
    };
    if (alertId) {
        try {
            await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                body: { data: clearedData },
                prefer: 'return=minimal',
            });
        } catch (e) {
            console.warn('[ig-draft] failed to clear stale auto-send hold:', e.message);
        }
    }
    return clearedData;
}

/**
 * Funnel context for leads coming through Shannon's Meta (IG/FB) ads. The ad
 * opens a Click-to-Messenger / Click-to-IG conversation with three quick-reply
 * prompts they can tap, OR they may DM organically asking about coaching.
 * Either way, the AI needs to recognise start/help intent and mirror Shannon's
 * actual qualifier flow.
 *
 * Update this block when the ad's quick-replies or offering structure changes.
 */
const META_AD_FUNNEL_CONTEXT = `
LEAD ACQUISITION CONTEXT:
Shannon finds leads by browsing Instagram/Facebook stories, reels, and posts, then DMs them first. He initiates the conversation. Some leads also come from Shannon's Meta ads or challenge angles. The DM offer right now is the free 30-day Balance Challenge, starting Monday, 8 June, with free entry for new starters, Shannon check-ins, app structure, and a $1,000 first-place cash prize. Interested leads should be encouraged to get into Balance and start with coaching immediately so they are set up before the challenge starts. Paid coaching is the natural follow-up after the 30 days, not the headline. The words below trigger offer-inquiry mode:
  1. "What's actually included?"
  2. "Do I need to already be Plant Based?"
  3. "I'm In - save me a spot!"
Also treat as offer inquiry: "1:1 coaching", "one-on-one coaching", "the challenge", "what's included", "your program" when they clearly mean the offer, "saw your ad", "wanna join", "work with you", "send me the link", "I'm in", or "I need help / I don't know what I'm doing". Do NOT treat vague "keen", "interested", "yeah sounds good", or friendly banter as offer intent unless the same message clearly points at coaching/program/link.

Important: when there is no prior tracked conversation, do NOT assume the lead started the DM. Most first captured lead messages happen because Shannon commented on or replied to their story/post natively, and that opener is not visible in ManyChat. Their reply may be tiny or ambiguous because they are answering that unseen opener. Treat it as an open door, build rapport from whatever signal exists, and ask one light human question unless they are clearly asking about the challenge/link or clearly asking Shannon for help because they feel stuck.

THE OFFERING (for context — never list as a brochure; speak like a friend):
- The FIRST offer is the free 30-day Balance Challenge, not paid coaching, a standalone custom meal plan, workout program, or generic app trial.
- If they are plant-based / vegan / vegetarian-curious, tailor the challenge explanation around plant-based food support.
- If they just want fitness, muscle, weight loss, energy, or consistency with no plant-based signal, tailor the challenge explanation around training, food structure, and consistency.
- When the offer is opened by a direct details/link/"what's included" ask, explain how the app works before sending the next step: Shannon built Balance this year, the app helps set up workouts/meals, their little character levels up as they log, and workouts, meals, weigh-ins, lessons, check-ins, and progress actions earn XP.
- If they only ask "what's Balance?" or "what's your app?" while also saying they are already training hard or feeling good, answer in one plain beat and make any challenge mention a casual throwaway. No feature list, prize, leaderboard, or link unless they ask for details.
- The challenge is 30 days of stacking consistent actions, building XP, and climbing the leaderboard with Shannon checking in. Do not call the character FitGotchi in DMs. Say "little character" or "game-style character".
- Once they start, the Balance app helps set up their workout program and meal plan. Shannon can edit it if needed after they sign up.
- Shannon checks in Monday, Wednesday, Friday. Friday is a weekly review and adjustment check-in.
- The challenge has a $1,000 cash prize for first place, confirmed after the final leaderboard review and fair-play checks.
- Keep it free/no pressure. The paid coaching choice comes later, after they have felt the support.

RESPONSE PATTERNS (mimic Shannon's actual voice for each prompt):
- "What's actually included?" -> explain the free challenge casually: Shannon built Balance this year, the app sets up workouts/meals, their little character levels up as they log, XP builds the leaderboard, Shannon checks in Mon/Wed/Fri, and first place wins the cash prize after review. Don't dump a brochure.
- "What's Balance?" / "what's your app?" -> answer plainly: it is Shannon's fitness app/coaching setup. If their latest training detail gives a natural opening, one casual line is enough: "sounds like you're smashing training tbh, i'm about to start a fitness challenge if you'd be keen?" Do not hardcode that wording, but keep that size and feel. No app feature list or signup link unless they ask what is included or ask for details.
- "Is it in person?" / "I'm looking for a local trainer" / "I already have a PT" -> treat this as a preference or compatibility objection. Answer plainly first: the challenge support is online through Balance. Do not push the link yet. Ask whether online check-ins/accountability would still be useful, or how it would need to fit around their current trainer.
- "Do I need to already be Plant Based?" -> warm reassurance ("not at all, lots of my crew start curious"), then ask their current eating situation, ever cooked plant-based before.
- "I'm In - save me a spot!" / "let's do it" / "send me the link" -> if they have already shared enough context or clearly accepted, send https://future-balance.netlify.app/bio.html with the quick challenge/app handoff. Do NOT ask a Name + Age + Main goal intake bundle.
- "I need help" / "I don't know what I'm doing" / "where do I start?" -> human first: validate the stuck feeling, ask one grounded context question if needed, then softly explain that the free challenge is the easiest starting point because the app gives structure, the character/XP makes consistency visible, and Shannon checks in. Do not sound like a canned invite.
- Warm lead with enough context already shared -> use a low-key bridge instead of endless discovery. Do not write stock lines that say the offer is made for this exact situation. Anchor it to their actual situation in one casual sentence, for example "if a bit of challenge structure would help when you're back, i'm starting one soon". End by asking if they want the details only when they have not already asked. Do not send the link or app feature rundown until they say yes or ask what is included.

When the conversation has clearly moved past intake (qualifier answers received, or they're chatting about something else), drop this context and just chat naturally.`;

/**
 * Parse the model's JSON-formatted draft into message chunks.
 *
 * The IG prompt instructs the model to output `{"messages": [...]}`. When the
 * model complies we split that into chunks for multi-message send (lands as
 * separate IG bubbles, feels less like AI than one wall of text). When it
 * doesn't (occasional plain-text fallback from the fine-tuned model) we still
 * try to recover natural breaks before defaulting to a single chunk.
 */
function parseDraftChunks(rawText, maxChunks = MAX_CHUNKS) {
    if (!rawText) return { chunks: [], joined: '' };
    const trimmed = String(rawText).trim();
    if (!trimmed) return { chunks: [], joined: '' };

    const normalizedChunks = normalizeCoachDraftChunks(trimmed)
        .map(m => typeof m === 'string' ? m.trim() : '')
        .filter(Boolean)
        .slice(0, maxChunks);
    if (normalizedChunks.length > 0 && normalizedChunks.join('\n') !== trimmed) {
        return { chunks: normalizedChunks, joined: normalizedChunks.join('\n') };
    }

    // Strip optional ```json fences before JSON.parse — Gemini hedges
    // with code fences sometimes despite "JSON only" instructions.
    const jsonCandidate = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    try {
        const parsed = JSON.parse(jsonCandidate);
        if (parsed && Array.isArray(parsed.messages)) {
            const chunks = parsed.messages
                .map(m => typeof m === 'string' ? m.trim() : '')
                .filter(Boolean)
                .slice(0, maxChunks);
            if (chunks.length > 0) return { chunks, joined: chunks.join('\n') };
        }
    } catch { /* fall through to plain-text splitting */ }

    const recovered = normalizeCoachDraftText(trimmed);
    if (recovered && recovered !== trimmed) {
        const chunks = splitPlainDraftIntoChunks(recovered, maxChunks);
        return { chunks, joined: chunks.join('\n') };
    }

    const chunks = splitPlainDraftIntoChunks(trimmed, maxChunks);
    return { chunks, joined: chunks.join('\n') };
}

function requireNonEmptyDraftText(text, sourceLabel) {
    if (!String(text || '').trim()) {
        throw new Error(`${sourceLabel} returned empty draft`);
    }
    return text;
}

function splitPlainDraftIntoChunks(text, maxChunks = MAX_CHUNKS) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return [];
    // Plain-text fallback. Honour explicit paragraph or line breaks the model
    // may have used as natural pauses; otherwise treat as one chunk.
    const paragraphs = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
        return paragraphs.slice(0, maxChunks);
    }
    const lines = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.length <= Math.max(4, maxChunks)) {
        return lines.slice(0, maxChunks);
    }
    return [trimmed];
}

function finalizeDraftChunksFromRawText(rawText, {
    maxChunks = MAX_CHUNKS,
    leadName = '',
    currentMessageText = '',
    qualifier = null,
    nativeStoryContextSummary = null,
    knownContextText = '',
    hasDecodedMedia = false,
    allowDailyGreeting = false,
} = {}) {
    const parsed = parseDraftChunks(rawText, maxChunks);
    const baseChunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
    const repairMissingLink = (chunks) => repairMissingChallengeBioLinkChunks(chunks, {
        maxChunks,
        currentMessageText,
        qualifier,
    });
    const cleaned = splitCoachDraftIntoDmBubbles(
        suppressStoryLocationQuestionsInDraftChunks(
            suppressPetSpeciesGuessingInDraftChunks(suppressAlreadyKnownContextQuestionsInDraftChunks(baseChunks, {
                contextText: knownContextText,
            }), {
                currentMessageText,
                qualifier,
                nativeStoryContextSummary,
            }),
            {
                currentMessageText,
                nativeStoryContextSummary,
            }
        )
            .map(c => stripObviousMediaReceiptPreamble(c, { hasDecodedMedia }))
            .map((c, i) => i === 0
                ? stripLeadingGreeting(c, leadName, { allowGreeting: allowDailyGreeting })
                : stripLeadingGreeting(c, leadName))
            .filter(Boolean)
    );
    if (cleaned.length) return repairMissingLink(cleaned).slice(0, maxChunks);

    // Never let a non-empty model response become a blank Needs You card.
    // If a conservative cleaner stripped the whole thing, keep the model's
    // draft and let Shannon's approval/review gate catch the nuance.
    const unfiltered = splitCoachDraftIntoDmBubbles(
        baseChunks
            .map(c => stripObviousMediaReceiptPreamble(c, { hasDecodedMedia }))
            .map((c, i) => i === 0
                ? stripLeadingGreeting(c, leadName, { allowGreeting: allowDailyGreeting })
                : stripLeadingGreeting(c, leadName))
            .filter(Boolean)
    );
    return repairMissingLink(unfiltered).slice(0, maxChunks);
}

function buildEmptyMediaDraftFallbackChunks({ mediaDecode = {}, currentMessageText = '' } = {}) {
    const current = replaceIgMediaMarkers(String(currentMessageText || ''), { photo: 'photo', audio: 'voice note', video: 'video' }).toLowerCase();
    const audioCount = Number(mediaDecode.audio_url_count || mediaDecode.audioUrlCount || 0);
    const photoCount = Number(mediaDecode.photo_url_count || mediaDecode.image_url_count || mediaDecode.photoUrlCount || 0);
    const videoCount = Number(mediaDecode.video_url_count || mediaDecode.videoUrlCount || 0);
    if (audioCount > 0 || /\bvoice note|audio\b/.test(current)) {
        return ['i got your voice note but it didn\'t come through clearly on my end. can you send me the gist quickly?'];
    }
    if (photoCount > 0 || /\bphoto|image|pic|picture\b/.test(current)) {
        return ['that photo didn\'t come through clearly on my end. can you send it again?'];
    }
    if (videoCount > 0 || /\bvideo|reel|clip\b/.test(current)) {
        return ['that video didn\'t come through clearly on my end. can you send it again or type the gist?'];
    }
    return [];
}

async function generateMediaRecoveryDraft({
    mediaParts,
    mediaDecode,
    leadName,
    channelLabel,
    currentMessageText,
    totalConversationText,
    lastShannonText = '',
    replyMode,
    allowDailyGreeting,
    qualifier,
    nativeStoryContextSummary,
} = {}) {
    if (!Array.isArray(mediaParts) || mediaParts.length === 0) return { chunks: [], rawText: '', model: null, error: null };
    const prompt = `The full drafting prompt returned an empty reply. Draft the actual next ${channelLabel || 'IG'} DM now.

Lead: ${leadName || 'Lead'}
Latest message marker: ${replaceIgMediaMarkers(currentMessageText || '', { photo: 'photo', audio: 'voice note', video: 'video' })}
${lastShannonText ? `Shannon's previous message: ${truncate(lastShannonText, 260)}\n` : ''}
Conversation context, oldest to newest:
${truncateTail(totalConversationText || '(no prior tracked context)', 2600)}

Attached media below is from the latest unanswered inbound batch. If a voice note is attached, listen to it and reply to what they said. Do not transcribe it. Do not say you listened to, heard, opened, checked, saw, or watched the media. If the media is genuinely not understandable, write one casual message asking them to resend it or type the gist.

Write in Shannon's casual texting voice with normal phone autocorrect casing. Keep it short unless the audio asks for detailed help. No AI/automation wording. No em-dashes. Never type literal backslash-n escape sequences in the reply text. Use normal punctuation instead.

JSON only:
{"messages":["exact DM text"]}`;
    const contents = [{ role: 'user', parts: [{ text: prompt }, ...mediaParts] }];
    const generationConfig = {
        maxOutputTokens: Math.max(1024, Math.min(Number(replyMode?.maxOutputTokens) || 1536, 2048)),
        temperature: 0.65,
    };
    let lastError = null;
    for (const attempt of [
        { label: 'gemini-media-retry', call: () => callGeminiFallback(contents, generationConfig) },
        { label: 'vertex-gemini-media-retry', call: () => callVertexGeminiMultimodal(contents, generationConfig) },
    ]) {
        try {
            const rawText = requireNonEmptyDraftText(await attempt.call(), attempt.label);
            const chunks = finalizeDraftChunksFromRawText(rawText, {
                maxChunks: replyMode?.maxChunks || MAX_CHUNKS,
                leadName,
                currentMessageText,
                qualifier,
                nativeStoryContextSummary,
                hasDecodedMedia: true,
                allowDailyGreeting,
            });
            if (chunks.length) return { chunks, rawText, model: attempt.label, error: lastError };
            lastError = `${attempt.label}: empty parsed draft`;
        } catch (err) {
            lastError = `${attempt.label}: ${String(err.message || err).slice(0, 200)}`;
            console.warn('[ig-draft] media recovery draft failed:', lastError);
        }
    }
    const fallbackChunks = buildEmptyMediaDraftFallbackChunks({ mediaDecode, currentMessageText });
    return {
        chunks: fallbackChunks,
        rawText: '',
        model: fallbackChunks.length ? 'safe-media-fallback' : null,
        error: lastError,
        usedFallback: fallbackChunks.length > 0,
    };
}

async function loadThread(threadId) {
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier,auto_send_enabled&id=eq.${threadId}&limit=1`
    );
    return rows[0] || null;
}

async function loadIgHistory(threadId, currentText) {
    const rows = await supabaseQuery(
        `ig_messages?select=direction,text,created_at&thread_id=eq.${threadId}&order=created_at.desc&limit=${HISTORY_LIMIT}`
    );
    // Drop the just-inserted current message and reverse to chronological order.
    const prior = rows
        .filter(r => !(r.direction === 'in' && r.text === currentText))
        .reverse();
    return prior;
}

/**
 * Cross-channel: when an IG/FB lead has been linked to an app account,
 * pull recent in-app DMs between coach and client so the IG draft sees
 * the parallel conversation (which might be where the actual onboarding
 * happened, e.g. Shannon DM'd in-app "did you find the challenge yet?",
 * client replies on IG "yes very keen!").
 *
 * Without this, the IG producer's history only has IG messages — and
 * Shannon's IG-side outbounds are usually sent natively (bypassing
 * ManyChat) so the IG-side history misses BOTH halves of recent context.
 *
 * Returns chronologically-ordered messages: { sender_id, message,
 * created_at }, oldest -> newest. Empty array on no link / no rows.
 */
async function loadLinkedNudgesContext(coachId, linkedUserId) {
    if (!coachId || !linkedUserId) return [];
    try {
        const rows = await supabaseQuery(
            `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${coachId},receiver_id.eq.${linkedUserId}),and(sender_id.eq.${linkedUserId},receiver_id.eq.${coachId}))&order=created_at.desc&limit=${HISTORY_LIMIT}`
        );
        return rows.reverse();
    } catch (e) {
        console.warn('[ig-draft] loadLinkedNudgesContext failed:', e.message);
        return [];
    }
}

/**
 * Returns the lead_stage we should ACTUALLY use for prompt routing,
 * promoting stale 'new'/'qualifying'/'invited' to 'in_app' when the
 * thread already has a linked_user_id (i.e. they're an app user — the
 * funnel was already cleared no matter what the column says).
 *
 * Why: ig_threads.lead_stage isn't always updated in lockstep with
 * linked_user_id. When a lead signs up to the app the linked_user_id
 * gets stamped, but lead_stage may still say 'new'. That's how the
 * 2026-04-29 Taylah incident produced an "ask Name + Age + main goal"
 * onboarding-pitch reply for a fully-onboarded client. linked_user_id
 * is the truth — if it's set, treat the thread as in_app regardless.
 */
function qualifierHasProgress(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return false;
    const facts = qualifier.facts || {};
    const relationshipChecklist = facts.relationship_checklist && typeof facts.relationship_checklist === 'object'
        ? Object.values(facts.relationship_checklist).some(Boolean)
        : false;
    const hasFacts = ['relationship_context', 'current_state', 'motivation', 'history_blockers', 'commitment']
        .some(key => !!facts[key]);
    return hasFacts
        || relationshipChecklist
        || (qualifier.stage && qualifier.stage !== 'current_state')
        || Number(qualifier.stage_index || 1) > 1;
}

function historyShowsActiveConversation(history = []) {
    if (!Array.isArray(history) || history.length === 0) return false;
    const inbound = history.filter(m => m.direction === 'in').length;
    const outbound = history.filter(m => m.direction === 'out').length;
    return (inbound >= 2 && outbound >= 1)
        || (inbound >= 1 && outbound >= 2)
        || (history.length >= 6 && inbound > 0 && outbound > 0);
}

function effectiveLeadStageForPrompt(thread, history = []) {
    const raw = thread?.lead_stage || 'new';
    if (thread?.linked_user_id && (raw === 'new' || raw === 'qualifying' || raw === 'invited')) {
        return 'in_app';
    }
    if (raw === 'new' && (qualifierHasProgress(thread?.qualifier) || historyShowsActiveConversation(history))) {
        return 'qualifying';
    }
    return raw;
}

function buildLeadBlock({ profileName, igUsername, customData, leadStage }) {
    const lines = [];
    if (profileName) lines.push(`Name: ${profileName}`);
    if (igUsername) lines.push(`IG handle: ${igUsername}`);
    if (leadStage && leadStage !== 'new') lines.push(`Funnel stage: ${leadStage}`);
    if (customData && typeof customData === 'object') {
        for (const [key, val] of Object.entries(customData)) {
            if (val == null || val === '') continue;
            const rendered = typeof val === 'string' ? val : JSON.stringify(val);
            lines.push(`${key}: ${rendered}`);
        }
    }
    if (lines.length === 0) return '';
    return `\n\nWHAT WE KNOW ABOUT THIS LEAD:\n${lines.join('\n')}`;
}

function pitchHintForStage(stage) {
    if (stage === 'in_app') {
        return "They're already in the app or challenge. Coach them like a normal client. The IG thread is just a parallel channel, same voice, same memory. Default to a short, human reply. Do not ask a new getting-to-know-you question unless it clearly fits. If they ask for program, plan, workout, meal, schedule, or app updates, answer quickly and directly.";
    }
    if (!stage || stage === 'new') {
        return "EARLY in this DM thread. If there are no visible prior messages, assume Shannon's native story/post opener is missing from ManyChat and this is the lead's first captured reply. Just chat. A short reaction is fine. Ask one light follow-up only if their words give you a clear opening. If their first captured reply already names a food, training, energy, body, confidence, or consistency problem, stay with that problem instead of asking unrelated normal-life questions. DO NOT pitch the app, challenge, or coaching from empty friendliness.";
    }
    switch (stage) {
        case 'qualifying':
            return "Conversation is warming up. Keep rapport natural, but make it create momentum. Ask one useful follow-up only when it moves the exact blocker forward. If the current message is simple banter, just banter. If they have already shared a clear food/training/energy/consistency blocker, do not ask another unrelated human-context question. Mention the free 30-day Balance Challenge when they ask how to start, ask for the link/details, clearly ask Shannon for help because they feel stuck, or the qualifier context shows Shannon already has a relationship anchor plus enough goal/blocker context for a soft bridge. When bridging, anchor it to their exact situation and ask if they want details instead of using a stock invite line. A vague warm reply is not a challenge opening by itself. Do not offer to write a standalone meal plan or workout program in DMs. The app helps set those up after they start.";
        case 'invited':
            return "You've already mentioned the free challenge. DON'T re-pitch. Answer their questions plainly. If they're close to signing up, help them across the line. If they are not ready yet, ask one useful question only if it helps the next step.";
        case 'in_app':
            return "They're already in the app. Coach them like a normal client. The IG thread is just a parallel channel — same voice, same memory. Keep it short unless they ask for more. Ask a specific question only when it is actually useful.";
        case 'churned':
            return "They went cold or opted out earlier. Respect the no. Be friendly, no pitch, no follow-up bait.";
        case 'new':
        default:
            return "EARLY in this DM thread. Just chat. Ask one genuine follow-up question that builds on what they said. DO NOT pitch the app, challenge, coaching, or anything else yet — they're a stranger.";
    }
}

function challengeUrlForRoute(route) {
    return ONE_ON_ONE_COACHING_URL;
}

const ONE_ON_ONE_COACHING_URL = 'https://future-balance.netlify.app/bio.html';

function buildOneOnOneCoachingBlock() {
    return `

BALANCE CHALLENGE LINK:
- The DM offer right now is the free 30-day Balance Challenge, starting Monday, 8 June.
- Interested leads can get into Balance and start with coaching immediately so they are ready before the challenge cohort starts.
- Approved challenge link: ${ONE_ON_ONE_COACHING_URL}
- When the latest message asks for the challenge link/details, asks how to start, clearly accepts the offer, or replies positively to Shannon's direct challenge/details invite, send the approved bio link in the draft.
- If the latest message asks to reconnect with Balance, the app/helper, login, password, account access, or any app bug, treat it as support first and do not send the challenge bio link.
- Keep the link handoff light, not a brochure: stoked they are keen, here's the link, it has the quick info on the challenge and how the app works, check it out and download the app, then come back to Shannon here to chat through it.
- Frame it as a free challenge with Shannon check-ins and app structure. Mention XP, leaderboard, or the $1,000 first-place cash prize only when they ask what is included or need the fuller rundown. Paid coaching comes later if the 30 days help.
- If they only ask a general help question and have not asked for challenge details/link, do not send the link yet. Reply to the question and ask a low-pressure permission question if the challenge might fit.
- If they ask whether it is local/in-person or mention they already have a PT/trainer, do not send the link yet. Answer that the challenge support is online through Balance and check whether that would still suit them.`;
}

function buildChallengeNextStepBlock(qualifier, currentMessageText = '') {
    if (!qualifier || typeof qualifier !== 'object') return '';
    if (isAppReconnectOrAccountSupportRequest(currentMessageText)) {
        return `

APP SUPPORT NEXT STEP:
The newest message is about Balance/app/helper reconnection, account access, login, or a tech/workout setup issue. Treat this as support, not a challenge signup moment.
- Do not send the challenge bio link in this reply, even if the lead previously accepted the challenge.
- Acknowledge it simply and ask for the practical detail Shannon needs, such as what screen/error they see or which email/account they used.
- Do not mention AI, automation, or an assistant. Keep the wording as Shannon personally helping them get sorted.`;
    }
    const url = challengeUrlForRoute(qualifier.challenge_route || 'generic');
    if (qualifier.stage === 'won') {
        return `

FREE CHALLENGE ACCEPTED NEXT STEP:
They have accepted the free 30-day Balance Challenge. Do NOT ask more qualifier/intake questions in this reply.
Your reply should:
- Send this exact URL in the draft: ${url}
- If you write "here's the link" or "heres the link", the URL must be visible in the same bubble or the next bubble.
- Keep the explanation tiny: the link has quick info on the challenge and how the Balance app works.
- Say the app is a little different, so they should check it out, download it, then come back to Shannon here and chat through it.
- Use the vibe: "yeah sounds so good, stoked you're keen for the challenge" rather than a brochure.
- Do it in 2-3 short bubbles, not one paragraph.
Do not offer to manually write a meal plan or workout program in DMs before signup.`;
    }
    if (qualifier.stage === 'pitched') {
        return `

FREE CHALLENGE OFFER PITCHED:
The free 30-day Balance Challenge has already been offered. If they sound keen, ask for details/link, ask how to start, or reply positively with "yes / sounds good / keen", send this exact URL in the draft: ${url}. If you write "here's the link" or "heres the link", the URL must be visible in the same bubble or the next bubble. Keep the handoff tight in 2-3 bubbles: stoked they are keen, here's the link, it has the quick challenge/app info, check it out and download the app, then come back here to chat through it. If they are still unsure, answer the concern and keep it easy.`;
    }
    if (hasEarnedChallengeInviteMoment({ qualifier })) {
        return `

EARNED FREE CHALLENGE BRIDGE:
This unlinked lead has enough relationship and goal/blocker context, plus at least 3 meaningful lead replies, for a soft bridge if it fits the newest message. Do not send the link yet. Do not make it a brochure. The move is one casual line anchored to what they just said, with the challenge as a throwaway invite. If they have not asked for the link/details yet, ask if they would be keen or want the details. Save the app feature rundown, XP, leaderboard, and prize for when they ask what is included. If the newest message is a clear no/not-yet signal, hold off and just reply to that.`;
    }
    return '';
}

function buildChallengeOfferWarning({ draftText, qualifier, currentMessage } = {}) {
    if (!isChallengeOfferWarningText(draftText)) return null;
    if (isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage })) {
        return {
            required: false,
            code: 'approved_challenge_bio_link',
            dot: '🟢',
            label: 'approved challenge bio link',
            reason: 'Draft uses the approved bio link after the lead accepted or asked for the challenge next step.',
            detected_at: new Date().toISOString(),
        };
    }
    const route = ['vegan', 'generic'].includes(qualifier?.challenge_route)
        ? qualifier.challenge_route
        : 'undecided';
    const routeLabel = route === 'vegan'
        ? 'plant-based challenge'
        : route === 'generic'
            ? 'free challenge'
            : 'free challenge';
    return {
        required: true,
        code: 'challenge_offer',
        dot: '🟡',
        label: 'free 30-day challenge invite',
        route,
        route_label: routeLabel,
        reason: `Draft appears to offer ${routeLabel} or send the challenge link.`,
        detected_at: new Date().toISOString(),
    };
}

function isSignupLinkHandoffText(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    return /https?:\/\/|future-balance\.netlify\.app|coaching\.html|plantbased-balance\.org\/bio\.html|plantbased-balance\.org\/transform-challenge|apps\.apple\.com\/app\/balance-fitness-gamified|here'?s the link|here is the link|jump in here|get signed up|sign up here|signup here|you can jump in here/i.test(s);
}

function isApprovedChallengeBioLinkText(text) {
    return /https?:\/\/future-balance\.netlify\.app\/bio\.html\b/i.test(String(text || ''));
}

function isPositiveChallengeLinkConfirmationText(text) {
    return /\b(?:yes|yeah|yea|yep|sure|please|pls|sounds good|sounds so good|keen|okay|ok|sweet|let'?s do it|lets do it|do it)\b/i.test(String(text || ''));
}

function hasVisibleUrl(text) {
    return /https?:\/\/\S+/i.test(String(text || ''));
}

function promisesLinkWithoutUrl(text) {
    const s = String(text || '');
    if (!s || hasVisibleUrl(s)) return false;
    return /\b(?:here'?s|heres|here is)\s+(?:the\s+)?link\b/i.test(s)
        || /\b(?:link|url)\s+(?:is|below|here)\b/i.test(s)
        || /\b(?:check it out|grab the app|download the app)\b/i.test(s);
}

function isAppReconnectOrAccountSupportRequest(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/\b(30\s*day|30-day|free challenge|challenge link|sign ?up|signup|join)\b/i.test(s)) return false;
    return /\b(reconnect(?:ed|ing)?|connect(?:ed|ing)? back|app helper|balance helper|balance app helper|account access|app access|login|log in|locked out|password|reset link|face id|face recognition|old email|spam|manual(?:ly)? reset|app glitch|glitched|bug)\b/i.test(s);
}

function repairMissingChallengeBioLinkChunks(chunks, { maxChunks = MAX_CHUNKS, currentMessageText = '', qualifier = null } = {}) {
    const list = Array.isArray(chunks) ? chunks.map(c => String(c || '').trim()).filter(Boolean) : [];
    if (!list.length) return list;
    const joined = list.join('\n');
    if (!promisesLinkWithoutUrl(joined)) return list;
    if (isAppReconnectOrAccountSupportRequest(currentMessageText)) return list;

    const allowed = qualifier?.stage === 'won'
        || hasChallengeInviteReadinessSignal(currentMessageText)
        || (qualifier?.stage === 'pitched' && isPositiveChallengeLinkConfirmationText(currentMessageText));
    if (!allowed) return list;

    const url = challengeUrlForRoute(qualifier?.challenge_route || 'generic');
    if (list.length < maxChunks) return [...list, url];

    const next = [...list];
    next[next.length - 1] = `${next[next.length - 1]}\n${url}`;
    return next;
}

function isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage } = {}) {
    if (!isApprovedChallengeBioLinkText(draftText)) return false;
    if (isAppReconnectOrAccountSupportRequest(currentMessage)) return false;
    if (qualifier?.stage === 'won') return true;
    if (hasChallengeInviteReadinessSignal(currentMessage)) return true;
    return qualifier?.stage === 'pitched' && isPositiveChallengeLinkConfirmationText(currentMessage);
}

function isUnlinkedAcquisitionLeadForLinkGate({ leadStage, linkedUserId } = {}) {
    if (linkedUserId) return false;
    const stage = String(leadStage || 'new').toLowerCase();
    return !['in_app', 'paying', 'churned'].includes(stage);
}

function buildLeadOnboardingHandoffData({ draftText, qualifier, leadStage, linkedUserId, threadId, manychatMessageId, currentMessage }) {
    if (!isUnlinkedAcquisitionLeadForLinkGate({ leadStage, linkedUserId })) return null;
    const draftHasLinkDrop = isSignupLinkHandoffText(draftText);
    const acceptedChallenge = qualifier?.stage === 'won';
    if (!draftHasLinkDrop && !acceptedChallenge) return null;

    if (isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage })) {
        return {
            lead_onboarding_handoff: false,
            needs_you_required: false,
            operator_queue: null,
            style_note: 'Approved bio link handoff can send once the lead has accepted or asked for the challenge next step.',
            signup_link_manual_only: false,
            signup_link_handoff_url: ONE_ON_ONE_COACHING_URL,
            approved_link_auto_sendable: true,
            codex_review: {
                source: 'ig-instant-draft',
                decision: 'approved_challenge_bio_link_handoff',
                queue: null,
                needs_shannon_approval: false,
                reason: 'Approved bio link handoff is allowed for this accepted/ready lead.',
                evidence_ids: [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : ''].filter(Boolean),
                reviewed_at: new Date().toISOString(),
            },
        };
    }

    const reason = draftHasLinkDrop
        ? 'Draft contains a signup/invite link handoff; Shannon must approve or send it manually.'
        : 'Lead appears ready for the signup/invite link; Shannon must approve the handoff before any URL is sent.';
    const evidenceIds = [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : '']
        .filter(Boolean);
    return {
        lead_onboarding_handoff: false,
        needs_you_required: false,
        operator_queue: null,
        client_manager_review_required: true,
        style_note: 'Lead is near a Balance/app link step. Hold automatic sending until the client manager checks readiness and either approves the draft or hands it to Shannon.',
        signup_link_manual_only: true,
        signup_link_handoff_url: ONE_ON_ONE_COACHING_URL,
        codex_review: {
            source: 'ig-instant-draft',
            decision: 'client_manager_review_required',
            queue: null,
            needs_shannon_approval: false,
            reason,
            evidence_ids: evidenceIds,
            reviewed_at: new Date().toISOString(),
        },
    };
}

function normalizeBotAccount(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function isCocosBotAccount(value) {
    return normalizeBotAccount(value) === 'cocos_pt_studio';
}

function isShanSunnyBotAccount(value) {
    return normalizeBotAccount(value) === 'shan_n_sunny';
}

function algorithmForkForBotAccount(botAccount) {
    if (isShanSunnyBotAccount(botAccount)) return 'shan_n_sunny_acquisition_v1';
    return isCocosBotAccount(botAccount) ? 'cocos_acquisition_v1' : 'balance_default_v1';
}

async function loadCocosRewardLearningBlock(botAccount) {
    if (!isCocosBotAccount(botAccount)) return '';
    try {
        const rows = await supabaseQuery(
            'cocos_algorithm_rules?select=rule_text,evidence_count,reward_avg&algorithm_fork=eq.cocos_acquisition_v1&active=eq.true&order=reward_avg.desc,evidence_count.desc&limit=8'
        );
        const rules = (rows || [])
            .map(row => String(row.rule_text || '').trim())
            .filter(Boolean)
            .slice(0, 8);
        if (!rules.length) return '';
        return `

SCOPED OUTCOME RULES:
These rules come only from this account lane's outcomes. Apply them unless the person's current context clearly conflicts.
${rules.map(rule => `- ${rule}`).join('\n')}`;
    } catch (err) {
        if (!/cocos_algorithm_rules|PGRST205|42P01|schema cache/i.test(String(err.message || ''))) {
            console.warn('[cocos-learning] rule load failed:', err.message);
        }
        return '';
    }
}

function buildAccountExperimentBlock(botAccount) {
    if (isShanSunnyBotAccount(botAccount)) {
        return `

SHAN_N_SUNNY LEAD LANE:
This thread belongs to Shannon's personal acquisition account.
- Use the same Shannon voice, same relationship-first logic, and same lead safety gates as Balance.
- Lead-only invite timing: do not pitch clients or linked app users. For unlinked leads, the soft free-challenge bridge usually belongs after 3-6 meaningful lead replies, a normal-life anchor, and at least two useful health/fitness facts.
- Before 3 meaningful lead replies, only move to the free challenge if they directly ask for help, ask how to start, ask what is included, or ask for the link.
- Earn the next response: each reply should answer the direct ask, mirror the sharpest hook, add a tiny useful lens, or ask one precise question about the real blocker/preference. Generic validation plus a broad question is not enough.
- If they want a local/in-person trainer or already have a PT/coach, explore that preference before any invite or link.
- When the earned window opens, stop drifting into pen-pal mode. Ask one casual permission bridge, do not send the link unless they accept.
- Keep everything sounding like Shannon personally texting. Never mention tests, auto-send, algorithms, learning, or system rules.`;
    }
    if (!isCocosBotAccount(botAccount)) return '';
    return `

COCO'S TEST LANE:
This thread belongs to Coco's PT Studio, Shannon's contained acquisition test account.
- Use the same Shannon voice, same relationship-first logic, and same safety review rules as Balance.
- Do not become more cautious just because this lane may run on auto. Trust the conversation algorithm and keep the next message moving.
- Shannon's hesitation/fear of rejection is not part of this lane. If the person gives a real help/start/fitness-frustration/coaching-detail signal, bridge confidently toward the free challenge instead of delaying forever.
- Lead-only invite timing: do not pitch clients or linked app users. For unlinked leads, the soft free-challenge bridge usually belongs after 3-6 meaningful lead replies, a normal-life anchor, and at least two useful health/fitness facts.
- Before 3 meaningful lead replies, only move to the free challenge if they directly ask for help, ask how to start, ask what is included, or ask for the link. Once the earned window opens, stop drifting into pen-pal mode and ask the simple permission bridge.
- Earn the next response: each reply should answer the direct ask, mirror the sharpest hook, add a tiny useful lens, or ask one precise question about the real blocker/preference. Generic validation plus a broad question is not enough.
- If they want a local/in-person trainer or already have a PT/coach, explore that preference before any invite or link.
- Still do not pitch from empty friendliness alone. Banter can stay banter. The point is natural momentum, not pressure.
- Keep everything sounding like Shannon personally texting. Never mention tests, auto-send, algorithms, learning, or Coco's as a system.`;
}

function isSalesAcquisitionThread({ leadStage, linkedUserId } = {}) {
    return !linkedUserId && !['in_app', 'paying', 'churned'].includes(leadStage);
}

function buildAcquisitionMomentumBlock({ botAccount, leadStage, linkedUserId } = {}) {
    if (!isSalesAcquisitionThread({ leadStage, linkedUserId })) return '';
    const laneName = isCocosBotAccount(botAccount) ? "Coco's" : 'shan_n_sunny / Balance';
    return `

ACQUISITION MOMENTUM (${laneName}):
- Rapport is the on-ramp, not the destination. Do not keep the thread alive with more pet/work/weekend/hobby questions once the lead has named a food, training, energy, body, confidence, consistency, or time problem.
- Use this decision order: answer their latest message, notice the strongest blocker or desire, then choose one next move: a tiny useful lens, one precise fit question, a direct free-challenge explanation, or a soft optional challenge bridge.
- No-progression fix: before writing, label the lead's latest signal as one of direct ask, blocker/objection, reciprocal curiosity, early program start, exit/low bandwidth, or pure rapport. The reply must move that exact signal one notch forward.
- Too-generic fix: build the reply from the lead's exact noun plus their constraint plus the consequence. Example: "two little ones + exhausted after work + dinner stress", "new city move + bookstore shifts + quiet/coffee shop", "conflicting info + meal prep time + overwhelm".
- If they ask about Shannon, the app, work, a bug, weekend plans, or another reciprocal personal detail, answer in one short clause, then return the spotlight to their strongest life/health signal. Do not let Shannon's side become the main topic for a second consecutive reply.
- If they object with chaos, moving, busyness, overwhelm, heat, schedule, or "not sure I can commit", do not loop on "totally fair/no pressure". Give one pressure-lowering reframe, then ask the smallest useful fit question or offer one tiny anchor.
- If they say they got the program/app/challenge or just started, do not ask "how are you finding it?" Ask one specific first-friction question: what looks hardest to fit in this week, what has been easiest to start, or what will get in the way first.
- If they are clearly leaving, do not force a question. Close warmly with a soft re-entry handle tied to their topic, like "catch ya, and if the move/work/heat starts messing with food, energy, or training, flick me a message".
- Earn the next response. The reply needs a handle worth answering: a direct answer, their sharpest hook reflected back, a tiny useful lens, or one precise question about their blocker/preference/objection.
- Avoid statement-only dead ends. Unless they are clearly closing the thread, do not finish with only agreement, a personal aside, or "hope it goes well". Give them one specific thing to answer from their exact topic.
- One or two normal-life beats is usually enough. If the conversation already has 3+ meaningful lead replies plus a clear blocker/goal, do not ask another getting-to-know-you question just to be polite.
- Good soft bridge shape: "honestly this is the kind of thing the free challenge can help with: [their exact blocker] without [their exact pain]. want me to send the details?"
- If they ask for practical advice, give the practical answer first. Then bridge only if it still feels natural.
- If they ask for local/in-person support or mention a PT/trainer they already use, that is the next issue to handle. Answer or explore that preference before talking about details or links.
- If there is no real blocker yet, stay human and light, but make the next handle sharper. Let the convo breathe only when they are clearly closing or low-bandwidth. Do not become a pen pal for its own sake.`;
}

function buildAcquisitionStyleBlock({ leadStage, linkedUserId } = {}) {
    if (!isSalesAcquisitionThread({ leadStage, linkedUserId })) return '';
    return `

ACQUISITION STYLE:
- Human first, coach second, but not pen-pal forever. Learn a normal-life anchor when there is no clear help signal yet: where they're based, kids/family, work/life rhythm, cooking situation, training background, why they replied, what they really love, or what genuinely ticks them off/stresses them.
- When a clear food, training, energy, body, confidence, consistency, or time blocker is already visible, stop collecting unrelated human context and move that exact blocker forward.
- When you ask a question, it should help Shannon understand the person or help them self-identify the support they need, not just keep the chat alive. Normal back-and-forth is allowed, but it should create momentum.
- Earn the next response. Every lead reply from Shannon should contain at least one reason for them to answer: a direct answer, their sharpest hook reflected back, a tiny useful lens, or one precise question about their blocker/preference/objection.
- shan_n_sunny weakness to correct: drafts can be too generic and fail to progress. Before finalising, check whether the reply would still fit 100 other leads. If yes, rewrite it around this person's exact thread and add one specific next handle. Do not settle for passive mirroring, generic praise, or "that makes sense" unless the moment is clearly closing.
- Avoid weak generic discovery stems: "what kind of difference would that make?", "what usually makes it feel like such a struggle?", "anything in particular making it hectic?", "how are you finding it so far?", "does that actually help?", and "what does that look like for you?". Replace them with a forked, concrete question from their words: "is dinner harder because the kids reject stuff, or because you're cooked after work?", "is the move messing more with food, sleep, or training?", "what part of the program looks hardest to fit in this week?"
- Do not describe an obvious thing back to them as the whole value. "busy weeks are tough", "sounds like a mission", "that's a tough one to navigate", and "black coffee is a classic" need a specific angle or should be cut.
- Progression does not mean rushing the challenge offer. It means one useful inch forward: a concrete question, a tiny useful lens, a playful specific hook, or an earned soft permission bridge when their own words justify it.
- Avoid statement-only dead ends unless they are clearly closing. If the current topic is food, group classes, a project, or skepticism about wellness fads, move that exact topic one notch deeper before switching to unrelated work/day chat.
- Avoid validation loops. If the last Shannon reply already said "totally fair", "no stress", "that makes sense", or "hope it goes smoothly", the next reply must add a new angle: a micro-tip, a fit question, a reframe, or a soft future handle.
- If they reveal something they love or something that annoys/stresses them, stay with that thread for a beat. Relate only if it is honest and light, then bring the spotlight back to them.
- A relationship question does not have to be the last bubble. If it is sparked by a specific thing they said, ask it while talking about that thing, then continue the reply.
- Do not bundle questions. Never ask name + age + goal + blocker together.
- If the discovery question is about relationship context, ask one light version and stop. Do not tack on a fitness goal in the same reply.
- If they are already asking how to join, accepted the challenge, or clearly want the link, move them forward with the short Balance-app explanation plus the next step instead of slowing them down with more questions.
- If they say they want local/in-person coaching, ask if Shannon's online 1:1 check-ins would still be useful before any invite or link. If they already have a PT/trainer/coach, answer how support could fit around that before pitching.
- Do not drop a free challenge invite just because they are friendly, vaguely interested, or mention fitness/food. This timing rule is for unlinked leads only, not clients/app users. Wait for either a human signal ("I need help", "I dunno what I'm doing", "where do I start?", "what's included?", "send the link", or an obvious join/start request) or enough earned context for a soft bridge. Earned context means Shannon already has a normal-life anchor, useful goal/blocker context, and usually 3-6 meaningful lead replies. In that case explain the app setup first, ask if they want details only if they have not already asked, and do not send the link unless they accept.
- When the soft bridge is right, make it fluid and specific. Avoid generic lines that say the offer is made for this exact situation. Use their words as the entry point: "since you're already [making this change], the challenge gives you the plan in Balance, XP for the daily bits, and me checking in..." or "if a bit of [structure/check-ins] would help, the app makes it a 30-day XP/leaderboard thing instead of a boring spreadsheet...". It should feel like Shannon noticed the opening, not like the funnel fired.
- Once they have shared enough real context plus a clear blocker/goal, do not keep asking getting-to-know-you questions. Use a specific, optional bridge or useful next lens.`;
}

function replaceIgMediaMarkers(text, { photo = '📷 photo', audio = '🎙️ voice note', video = '🎥 video' } = {}) {
    return replaceVideoMarkers(
        replaceAudioMarkers(
            replacePhotoMarkers(normalizeImplicitMediaMarkers(String(text || '')), () => photo),
            () => audio
        ),
        () => video
    );
}

function isIgStoryReplyContextText(text) {
    const raw = String(text || '');
    return /\[IG_STORY_REPLY_CONTEXT\]/i.test(raw)
        || /Raw IG message:\s*replied to your story/i.test(raw)
        || /^\s*replied to your story\b/i.test(raw);
}

function extractIgStoryReplyText(text) {
    const raw = String(text || '');
    if (!isIgStoryReplyContextText(raw)) return '';
    const quotedReply = raw.match(/(?:^|\n)Their reply:\s*"([\s\S]*?)"\s*(?:\n|$)/i);
    if (quotedReply) {
        const reply = String(quotedReply[1] || '').trim();
        if (reply && !/^\(no text\b/i.test(reply)) return reply;
    }
    const rawReply = raw.match(/Raw IG message:\s*replied to your story(?:\s*\([^)]*\))?\s*([\s\S]*)$/i);
    if (rawReply) {
        const reply = String(rawReply[1] || '')
            .replace(/^(?:\[(?:PHOTO|VIDEO):https?:\/\/[^\]]+\]\s*)+/i, '')
            .trim();
        if (reply) return reply;
    }
    const inlineReply = raw.match(/^\s*replied to your story(?:\s*\([^)]*\))?\s+(.+)$/i);
    if (inlineReply) {
        const reply = String(inlineReply[1] || '').trim();
        if (reply) return reply;
    }
    return 'replied to your story';
}

function extractIgStoryContextForPrompt(text) {
    const raw = String(text || '');
    if (!isIgStoryReplyContextText(raw)) return '';
    const body = raw
        .replace(/^\s*\[IG_STORY_REPLY_CONTEXT\]\s*/i, '')
        .split(/\nTheir reply:/i)[0]
        .trim();
    if (!body || /^Raw IG message:/i.test(body)) return '';
    return body;
}

function buildIgStoryReplyPromptContextBlock({ leadName, currentMessage = '', recentInboundMessages = [] } = {}) {
    const rows = [];
    const add = (rawText, label) => {
        const storyContext = extractIgStoryContextForPrompt(rawText);
        if (!storyContext) return;
        const reply = extractIgStoryReplyText(rawText);
        rows.push(`- ${label}${reply ? ` reply: "${truncate(reply, 180)}"` : ''}\n  Shannon story context: ${truncate(storyContext.replace(/\n+/g, ' | '), 900)}`);
    };
    (Array.isArray(recentInboundMessages) ? recentInboundMessages : []).forEach((m, index) => {
        add(m?.text || '', `Prior story reply ${index + 1}`);
    });
    add(currentMessage, 'Current story reply');
    if (!rows.length) return '';
    return `

STORY REPLY CONTEXT:
${rows.join('\n')}

This is Shannon's story/post context, not ${leadName || 'the lead'}'s own message. Use it only to understand what they replied to. Do not write as if ${leadName || 'the lead'} logged, ate, posted, or said those story details unless their actual reply says so. If visible text or a location sticker already names a place, treat that place as known. Do not ask where it is, where they are watching from, or where they are based from that story. If the visual story context already shows beach, ocean, sand, coast, or waterfront, do not ask whether they were on/at the beach.\nIf this is clearly them replying to Shannon's native story opener or a comment Shannon left on their post, that is a normal send-back path. If the context is unclear, the message suggests confusion or AI suspicion, or the inbound includes media that needs inspection, do not guess a reply. Mark it for Needs You instead.`;

}

function compactStoryMemoryText(value, max = 500) {
    return truncate(String(value || '').replace(/\s+/g, ' ').trim(), max);
}

function latestNativeStoryOutreachMemory(thread) {
    const customData = thread?.custom_data && typeof thread.custom_data === 'object'
        ? thread.custom_data
        : {};
    if (customData.last_story_outreach && typeof customData.last_story_outreach === 'object') {
        return customData.last_story_outreach;
    }
    const history = Array.isArray(customData.story_outreach_history)
        ? customData.story_outreach_history.filter(item => item && typeof item === 'object')
        : [];
    return history[history.length - 1] || null;
}

function buildNativeStoryOutreachContextBlock(thread, leadName) {
    const latest = latestNativeStoryOutreachMemory(thread);
    if (!latest) return { block: '', summary: null };

    const handle = compactStoryMemoryText(thread?.ig_username || leadName || latest.ig_username || '', 80);
    const description = compactStoryMemoryText(latest.story_description, 700);
    const visibleText = compactStoryMemoryText(latest.story_visible_text, 700);
    const sentComment = compactStoryMemoryText(latest.sent_comment || latest.draft_comment, 240);
    const contentType = compactStoryMemoryText(latest.story_content_type || 'unknown', 80);
    const sharedFrom = compactStoryMemoryText(latest.shared_from_username, 80);
    const storyUrl = compactStoryMemoryText(latest.story_url, 300);
    const capturedAt = compactStoryMemoryText(latest.captured_at || latest.updated_at, 80);

    const summary = {
        story_url: storyUrl || null,
        story_id: compactStoryMemoryText(latest.story_id, 100) || null,
        story_description: description || null,
        story_visible_text: visibleText || null,
        story_content_type: contentType || null,
        shared_from_username: sharedFrom || null,
        sent_comment: sentComment || null,
        captured_at: capturedAt || null,
    };
    if (!description && !visibleText && !sentComment) return { block: '', summary };

    const lines = [
        `Shannon previously replied to @${handle || 'this lead'}'s native Instagram story before this inbound.`,
    ];
    if (capturedAt) lines.push(`Captured at: ${capturedAt}.`);
    if (description) lines.push(`Story context: ${description}`);
    if (visibleText) lines.push(`Visible story text: ${visibleText}`);
    if (contentType && contentType !== 'unknown') {
        lines.push(`Story type: ${contentType}${sharedFrom ? `, shared from @${sharedFrom}` : ''}.`);
    } else if (sharedFrom) {
        lines.push(`Shared/reshared content appears connected to @${sharedFrom}.`);
    }
    if (sentComment) lines.push(`Shannon's native story reply/comment: "${sentComment}"`);
    if (storyUrl) lines.push(`Story URL: ${storyUrl}`);

    return {
        summary,
        block: `

NATIVE STORY OPENER CONTEXT:
${lines.join('\n')}

Use this if the new message is replying to Shannon's native story opener. Do not pretend ${leadName || 'the lead'} said the story context themselves. If the story context identifies an animal as a cat, dog, rabbit, horse, or another species, keep that species exactly. If the species is unknown, stay neutral and never guess dog, cat, breed, or type from a pet name alone. If visible story text or a location sticker already names a place, treat that place as known and do not ask where it is or where they are watching from. If the visual story context already shows beach, ocean, sand, coast, or waterfront, do not ask whether they were on/at the beach.`,
    };
}

function suppressPetSpeciesGuessingInDraftChunks(chunks, { currentMessageText = '', qualifier = null, nativeStoryContextSummary = null } = {}) {
    const input = Array.isArray(chunks) ? chunks : [];
    const contextText = [
        currentMessageText,
        qualifier?.facts?.relationship_checklist?.pets,
        nativeStoryContextSummary?.story_description,
        nativeStoryContextSummary?.story_visible_text,
        nativeStoryContextSummary?.sent_comment,
    ].filter(Boolean).join(' ').toLowerCase();
    const knownCat = /\b(cat|kitten)\b/i.test(contextText);
    const knownDog = /\b(dog|doggo|puppy)\b/i.test(contextText);
    const knownSpecies = knownCat || knownDog || /\b(rabbit|bunny|horse)\b/i.test(contextText);

    return input
        .map(chunk => {
            let out = String(chunk || '').trim();
            if (!out) return '';
            const asksSpecificSpecies = /\bwhat\s+(?:kind|kinda|type|breed)\s+(?:of\s+)?(?:doggo|dog|puppy|cat|kitten)\b/i;
            if (asksSpecificSpecies.test(out)) {
                const guessedDog = /\b(doggo|dog|puppy)\b/i.test(out);
                const guessedCat = /\b(cat|kitten)\b/i.test(out);
                const contradictsKnownSpecies = (knownCat && guessedDog) || (knownDog && guessedCat);
                if (!knownSpecies || contradictsKnownSpecies) {
                    out = out.replace(asksSpecificSpecies, '').replace(/\s+[?!.]\s*$/, '').trim();
                    return '';
                }
            }
            if (!knownDog && /\bdoggo\b/i.test(out) && !/\bcat|kitten\b/i.test(contextText)) {
                out = out.replace(/\bdoggo\b/ig, 'little one');
            }
            return out;
        })
        .filter(Boolean);
}

const STORY_LOCATION_TYPE_RE = /\b(?:beach|bay|creek|river|lake|mount|mt|mountain|lookout|point|headland|island|park|national\s+park|falls|waterfall|coast|coastal|harbour|harbor|marina|jetty|pier|hotel|resort|cafe|restaurant|bar|pub|club|stadium|arena|airport|station|suburb|city|town|village)\b/i;
const STORY_BEACH_SCENE_RE = /\b(?:beach|ocean|sea|sand|sandy|shore|shoreline|coast|coastal|waterfront|surf|waves?)\b/i;
const STORY_LOCATION_QUESTION_RE = /\b(?:(?:where(?:'s|s| is| was)?\s+(?:this|that|it|the\s+(?:view|beach|spot|place|sunset|sunrise))|where\s+(?:are|were)\s+you(?:\s+(?:watching|seeing|looking\s+at|staying|based))?(?:\s+(?:from|this|that|it))?|where\s+(?:is|was)\s+(?:this|that|it)|what(?:'s|s| is)\s+(?:this|that)\s+(?:place|spot|beach|view)|(?:are|were|was)\s+(?:you|that|this|it)\s+(?:on|at|by|near)\s+(?:the\s+)?(?:beach|ocean|water|waterfront|coast)|did\s+you\s+(?:grab|get|have)\s+(?:a\s+)?view\s+from\s+somewhere))\b[^?!.\n]*\?/i;

function hasKnownStoryLocationContext({ currentMessageText = '', nativeStoryContextSummary = null } = {}) {
    const rawStoryContext = extractIgStoryContextForPrompt(currentMessageText);
    const visibleText = [
        nativeStoryContextSummary?.story_visible_text,
        rawStoryContext,
    ].filter(Boolean).join(' ');
    if (STORY_LOCATION_TYPE_RE.test(visibleText)) return true;

    const broaderContext = [
        nativeStoryContextSummary?.story_description,
        nativeStoryContextSummary?.sent_comment,
    ].filter(Boolean).join(' ');
    if (STORY_BEACH_SCENE_RE.test(broaderContext)) return true;
    return /\b(?:location\s+(?:tag|sticker)|tagged|at)\b.{0,80}/i.test(broaderContext)
        && STORY_LOCATION_TYPE_RE.test(broaderContext);
}

function suppressStoryLocationQuestionsInDraftChunks(chunks, { currentMessageText = '', nativeStoryContextSummary = null } = {}) {
    if (!hasKnownStoryLocationContext({ currentMessageText, nativeStoryContextSummary })) {
        return Array.isArray(chunks) ? chunks : [];
    }
    const input = Array.isArray(chunks) ? chunks : [];
    const cleaned = input
        .map(chunk => {
            const out = stripQuestionSentence(chunk, STORY_LOCATION_QUESTION_RE);
            return out || String(chunk || '').replace(STORY_LOCATION_QUESTION_RE, '').trim();
        })
        .filter(Boolean);
    if (cleaned.length || !input.length) return cleaned;

    const contextText = [
        currentMessageText,
        nativeStoryContextSummary?.story_description,
        nativeStoryContextSummary?.story_visible_text,
    ].filter(Boolean).join(' ');
    return [/\b(?:view|beach|sunset|sunrise|ocean|sea|coast|waterfront)\b/i.test(contextText)
        ? 'that view is unreal'
        : 'looks like a good spot'];
}

const PET_NAME_QUESTION_RE = /\b(?:what(?:'s|s| is)|what are)\s+(?:their|the|your|these|those)\s+names?\b/i;
const HOUSE_SITTING_DURATION_QUESTION_RE = /\bhow\s+long\b[^?\n.!]{0,120}\bhouse\s*sitt(?:ing|ed)?\b[^?\n.!]*\?/i;

function normalizeKnownContextText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasKnownPetNameContext(value) {
    const text = normalizeKnownContextText(value);
    if (!text) return false;
    return PET_NAME_QUESTION_RE.test(text)
        || /\b(?:dog|dogs|puppy|puppies|pet|pets|cat|cats|kitten|kittens)\b.{0,180}\b(?:named|called|names?|specter|ocean|nero)\b/i.test(text)
        || /\b(?:specter|ocean)\b/i.test(text);
}

function hasHouseSittingPetContext(value) {
    const text = normalizeKnownContextText(value);
    if (!text) return false;
    return HOUSE_SITTING_DURATION_QUESTION_RE.test(text)
        || (/\bhouse\s*(?:sat|sitting)\b/i.test(text) && /\b(?:dog|dogs|puppy|puppies|pet|pets|specter|ocean|them)\b/i.test(text));
}

function stripQuestionSentence(text, pattern) {
    const testPattern = new RegExp(pattern.source, 'i');
    return String(text || '')
        .split(/(?<=[.!?])\s+|\n+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence && !testPattern.test(sentence))
        .join(' ')
        .replace(/\s+([,.!?])/g, '$1')
        .replace(/([,.!?]){2,}/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function suppressAlreadyKnownContextQuestionsInDraftChunks(chunks, { contextText = '' } = {}) {
    const knownPetNames = hasKnownPetNameContext(contextText);
    const houseSittingPets = hasHouseSittingPetContext(contextText);
    return (Array.isArray(chunks) ? chunks : [])
        .map(chunk => {
            let out = String(chunk || '').trim();
            if (!out) return '';
            if (knownPetNames && PET_NAME_QUESTION_RE.test(out)) {
                out = stripQuestionSentence(out, PET_NAME_QUESTION_RE);
            }
            if (houseSittingPets && HOUSE_SITTING_DURATION_QUESTION_RE.test(out)) {
                out = stripQuestionSentence(out, HOUSE_SITTING_DURATION_QUESTION_RE);
            }
            return out.trim();
        })
        .filter(Boolean);
}

function normalizedIgLeadMessageKey(text) {
    return replaceIgMediaMarkers(String(text || ''), { photo: 'photo', audio: 'voice note', video: 'video' })
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function sanitizeIgStoryReplyContextText(text) {
    const raw = String(text || '');
    if (!isIgStoryReplyContextText(raw)) return raw;
    const replyText = extractIgStoryReplyText(raw);
    if (replyText) return replyText;
    return raw
        .replace(
            /Raw IG message:\s*replied to your story\s+(?:\[(?:PHOTO|VIDEO):https?:\/\/[^\]]+\]\s*)+/gi,
            'Raw IG message: replied to your story (story media attached; not a separate photo or video from the lead) '
        )
        .replace(
            /^(\s*replied to your story)\s+(?:\[(?:PHOTO|VIDEO):https?:\/\/[^\]]+\]\s*)+/i,
            '$1 (story media attached; not a separate photo or video from the lead) '
        )
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function stripObviousMediaReceiptPreamble(text, { hasDecodedMedia = false } = {}) {
    let out = String(text || '').trim();
    if (!hasDecodedMedia || !out) return out;

    const receiptPatterns = [
        /^(?:yeah\s+|yep\s+|okay\s+|ok\s+)?(?:i\s+)?(?:just\s+)?(?:listened to|heard|played|checked|opened)\s+(?:your|the)?\s*(?:voice\s+note|voice\s+message|audio\s+clip|audio)(?:\s+(?:now|then))?[\s,.!:;-]*/i,
        /^(?:yeah\s+|yep\s+|okay\s+|ok\s+)?(?:i\s+)?(?:just\s+)?(?:looked at|saw|checked|opened)\s+(?:your|the)?\s*(?:photo|pic|picture|image|screenshot)(?:\s+(?:now|then))?[\s,.!:;-]*/i,
        /^(?:yeah\s+|yep\s+|okay\s+|ok\s+)?(?:i\s+)?(?:just\s+)?(?:watched|looked at|saw|checked|opened)\s+(?:your|the)?\s*(?:video|clip|reel)(?:\s+(?:now|then))?[\s,.!:;-]*/i,
        /^(?:yeah\s+|yep\s+|okay\s+|ok\s+)?(?:i\s+)?(?:can\s+)?(?:see|hear)\s+(?:your|the)?\s*(?:voice\s+note|voice\s+message|audio\s+clip|audio|photo|pic|picture|image|screenshot|video|clip|reel)(?:\s+(?:now|there))?[\s,.!:;-]*/i,
    ];

    let changed = true;
    while (changed) {
        changed = false;
        for (const pattern of receiptPatterns) {
            const next = out.replace(pattern, '').trim();
            if (next !== out) {
                out = next;
                changed = true;
            }
        }
    }
    return out.replace(/^[\s,.!:;-]+/, '').trim();
}

function extractIgMessageMedia(rawText) {
    if (isIgStoryReplyContextText(rawText)) return [];
    return [
        ...extractPhotoUrls(rawText).map(url => ({ type: 'photo', url })),
        ...extractAudioUrls(rawText).map(url => ({ type: 'audio', url })),
        ...extractVideoUrls(rawText).map(url => ({ type: 'video', url })),
    ];
}

function formatInboundBatchForDisplay({ recentInboundMessages = [], currentMessage = '', currentCreatedAt = null, maxChars = 2000 }) {
    const rows = [];
    (Array.isArray(recentInboundMessages) ? recentInboundMessages : []).forEach(m => {
        const rawText = sanitizeIgStoryReplyContextText(String(m?.text || '').trim());
        const text = replaceIgMediaMarkers(rawText);
        if (!text) return;
        rows.push({
            text: truncate(text, maxChars),
            media: extractIgMessageMedia(rawText),
            created_at: m?.created_at || null,
            is_current: false,
        });
    });
    const latestRawText = sanitizeIgStoryReplyContextText(String(currentMessage || '').trim());
    const latestText = replaceIgMediaMarkers(latestRawText);
    if (latestText) {
        rows.push({
            text: truncate(latestText, maxChars),
            media: extractIgMessageMedia(latestRawText),
            created_at: currentCreatedAt || null,
            is_current: true,
        });
    }
    return rows;
}

function formatLastOutboundForDisplay({ history = [], linkedNudges = [], linkedUserId = null, channel = 'instagram', maxChars = 1200 }) {
    const candidates = [];
    (Array.isArray(history) ? history : []).forEach(m => {
        if (!m || m.direction !== 'out') return;
        const rawText = String(m.text || '').trim();
        const text = replaceIgMediaMarkers(rawText);
        if (!text) return;
        candidates.push({
            text: truncate(text, maxChars),
            media: extractIgMessageMedia(rawText),
            created_at: m.created_at || null,
            channel,
        });
    });
    (Array.isArray(linkedNudges) ? linkedNudges : []).forEach(m => {
        if (!m || !linkedUserId || m.sender_id === linkedUserId) return;
        const rawText = String(m.message || '').trim();
        const text = replaceIgMediaMarkers(rawText);
        if (!text) return;
        candidates.push({
            text: truncate(text, maxChars),
            media: extractIgMessageMedia(rawText),
            created_at: m.created_at || null,
            channel: 'in_app',
        });
    });
    candidates.sort((a, b) => (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0));
    return candidates[candidates.length - 1] || null;
}

function plainSignalText(text) {
    return replaceIgMediaMarkers(String(text || ''), { photo: 'photo', audio: 'voice note', video: 'video' })
        .replace(/\s+/g, ' ')
        .trim();
}

function countWords(text) {
    return (String(text || '').match(/\b[\w'’]+\b/g) || []).length;
}

function normalizedShortAnswerText(text) {
    return plainSignalText(text)
        .toLowerCase()
        .replace(/[^a-z0-9'\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isShortAnswerMessage(text) {
    const normalized = normalizedShortAnswerText(text);
    if (!normalized) return false;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length > 4) return false;
    return /^(yes|yeah|yep|yup|yeh|no|nah|nope|ok|okay|true|exactly|same|right|correct|sure|perfect|good|nice|maybe|probably|definitely|lol|lmao|haha|hahaha|hahah|i know|thank you|thanks)$/i.test(normalized);
}

function buildCurrentTurnAnchorBlock({ currentMessageText, lastShannonText } = {}) {
    const current = plainSignalText(currentMessageText);
    if (!current) return '';
    const lastShannon = plainSignalText(lastShannonText);
    const shortAnswer = isShortAnswerMessage(current);

    const lines = [
        '',
        'CURRENT TURN ANCHOR:',
        `- Just-arrived message to answer: "${truncate(current, 220)}"`,
    ];
    if (lastShannon) {
        lines.push(`- Shannon's immediately previous message: "${truncate(lastShannon, 220)}"`);
    }
    lines.push('- Write to the just-arrived message first. Use older timeline only as background for this turn, not as a menu of topics to revisit.');
    lines.push('- Do not repeat, paraphrase, or re-send an older Shannon line just because it appears in the timeline. Add the next tiny conversational beat.');
    if (shortAnswer && lastShannon) {
        lines.push("- This is a short answer/confirmation. Treat it as answering Shannon's immediately previous message. A one-liner is usually enough; do not reopen older emotions, app issues, or banter unless the short answer clearly points there.");
    }
    return `\n${lines.join('\n')}`;
}

function hasProgramSupportIntent(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return false;
    const programThing = '(program|plan|meal plan|workout|training|routine|exercise|calories|macros|protein|schedule|app)';
    const changeWord = '(update|change|adjust|tweak|edit|swap|redo|fix|set up|setup|review|make|write)';
    return new RegExp(`\\b${changeWord}\\b.{0,50}\\b${programThing}\\b`, 'i').test(t)
        || new RegExp(`\\b${programThing}\\b.{0,50}\\b${changeWord}\\b`, 'i').test(t)
        || new RegExp(`\\b(how do i|where do i|can you|could you|what should i)\\b.{0,70}\\b${programThing}\\b`, 'i').test(t)
        || new RegExp(`\\b${programThing}\\b.{0,50}\\b(not working|wrong|missing|too hard|too easy|cant|can't|stuck)\\b`, 'i').test(t);
}

function resolveReplyMode({ currentMessageText, recentInboundMessages = [], history = [], leadStage, linkedUserId = null, onboardingPhase = null }) {
    const inboundTexts = [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages : []).map(m => plainSignalText(m?.text)),
        plainSignalText(currentMessageText),
    ].filter(Boolean);
    const combined = inboundTexts.join(' ');
    const charCount = combined.length;
    const wordCount = countWords(combined);
    const inboundCount = inboundTexts.length;
    const relationshipDepth = Array.isArray(history)
        ? history.filter(m => m?.direction === 'in' || m?.direction === 'out').length
        : 0;
    const emotionalSignal = /\b(grief|lost|loss|passed|died|death|trauma|depression|dark|pain|lonely|alone|isolat|sister|father|mum|family|trigger|triggered|apolog|bullied|pathetic|koda|pepper|teddy|baby|babies|soul mate|soulmate)\b/i.test(combined);
    const practicalDepth = /\b(workout|training|exercise|fitness|routine|walks?|challenge|clients?|business|studio|online|community|nutrition|eating|binge|emotional eating)\b/i.test(combined);
    const isDeep =
        wordCount >= 120
        || charCount >= 700
        || (inboundCount >= 2 && wordCount >= 80)
        || (emotionalSignal && wordCount >= 55)
        || (relationshipDepth >= 8 && practicalDepth && wordCount >= 75);

    const isOngoingClient = (!!linkedUserId || ['in_app', 'paying'].includes(leadStage)) && !onboardingPhase?.inOnboarding;
    const programSupportIntent = isOngoingClient && hasProgramSupportIntent(combined);

    if (programSupportIntent && isDeep) {
        return {
            name: 'deep_client_support',
            maxChunks: DEEP_REPLY_MAX_CHUNKS,
            maxOutputTokens: DEEP_REPLY_MAX_OUTPUT_TOKENS,
            intro: 'Draft a detailed',
            chunkRange: '3-4',
            chunkExample: '{"messages": ["chunk 1", "chunk 2", "chunk 3", "chunk 4 (only if needed)"]}',
            chunkRule: '3 to 4 chunks for long support replies. Prefer fewer fuller bubbles with paragraph gaps inside each bubble instead of a pile of tiny separate bubbles.',
            lengthRule: 'Aim for 1800-3600 characters total for long multi-message batches. Go longer if that is what it takes to answer every meaningful question or share.',
            styleRule: 'Detailed support chunks: each message can include 1-3 short paragraphs separated by a blank line, normal phone autocorrect casing, Australian casual.',
            extraBlock: `

DEEP CLIENT SUPPORT MODE:
They are already an app or challenge client, and this is a long, emotional, practical, or multi-topic support message.
- Do not switch into quick support just because they mentioned a program, workout, plan, schedule, or app detail.
- Do not blindly reply to the whole inbound batch in order. Choose the conversational centre of gravity first.
- Prioritize direct questions/requests, vulnerable emotional or health/body-image disclosures, and practical blockers. Use older points only when they still affect that centre.
- Cover multiple threads only when they are all genuinely live. Otherwise a shorter, well-chosen reply is more persuasive than complete coverage.
- If Shannon needs more info before changing something, ask for the one missing detail after acknowledging the rest.
- It is okay for this to be a long set of DM bubbles. Long, thoughtful messages need a properly long reply.`,
        };
    }

    if (programSupportIntent) {
        return {
            name: 'client_support_quick',
            maxChunks: 2,
            maxOutputTokens: 1536,
            intro: 'Draft a quick',
            chunkRange: '1-2',
            chunkExample: '{"messages": ["chunk 1", "chunk 2 (if needed)"]}',
            chunkRule: '1 to 2 chunks. Answer the program, plan, or app need first. Only add a tiny check question if it is genuinely useful.',
            lengthRule: 'Keep the total reply under 350 characters unless they need exact steps.',
            styleRule: 'Quick chunks: direct, helpful, normal phone autocorrect casing, Australian casual.',
            extraBlock: `

QUICK CLIENT SUPPORT MODE:
They are already an app or challenge client and this looks like a program, plan, workout, meal, schedule, or app support request.
- Answer the practical thing first.
- Do not turn it into onboarding or a qualifier question.
- If Shannon needs more info before changing something, ask for the one missing detail.`,
        };
    }

    if (!isDeep) {
        if (isOngoingClient) {
            return {
                name: 'client_rapport_medium',
                maxChunks: MAX_CHUNKS,
                maxOutputTokens: 2048,
                intro: 'Draft a short',
                chunkRange: '1-2',
                chunkExample: '{"messages": ["chunk 1", "chunk 2 (if useful)"]}',
                chunkRule: '1 to 2 chunks. One-liner is often right. Do not add a question unless it is clearly useful right now.',
                lengthRule: 'Aim for 80-280 characters. Go longer only if they asked something detailed or vulnerable.',
                styleRule: 'Short chunks: direct, warm, normal phone autocorrect casing, Australian casual.',
                extraBlock: `

ONGOING CLIENT RAPPORT MODE:
They are past signup/onboarding. Treat this as Shannon getting to know an active challenge or app client, not as a setup flow.
- No intake bundle, no coaching pitch, no "are you ready to start?" framing.
- Do not ask a question every reply. For friendly banter, story replies, pets, travel, birthdays, movies, food photos, or quick updates, a short reaction is often better.
- If they are answering Shannon's previous small question, do not ladder into another tiny question unless the answer is incomplete and Shannon genuinely needs the missing detail. Affirm it and give one simple direction, next step, or clean close.
- Ask one question only when it naturally continues the exact thread they started.
- If they ask for a program, plan, workout, meal, schedule, or app update, switch back to direct practical help.`,
            };
        }
        return {
            name: 'standard',
            maxChunks: MAX_CHUNKS,
            maxOutputTokens: 2048,
            intro: 'Draft a SHORT',
            chunkRange: '1-3',
            chunkExample: '{"messages": ["chunk 1", "chunk 2 (if needed)", "chunk 3 (if needed)"]}',
            chunkRule: '1 to 3 chunks. One-liner is fine, just one item in the array.',
            lengthRule: 'Keep the total reply under 500 characters unless they asked a detailed question.',
            styleRule: 'Tight chunks: each message 1-2 sentences max, normal phone autocorrect casing, Australian casual.',
            extraBlock: '',
        };
    }

    return {
        name: 'deep',
        maxChunks: DEEP_REPLY_MAX_CHUNKS,
        maxOutputTokens: DEEP_REPLY_MAX_OUTPUT_TOKENS,
        intro: 'Draft a thoughtful',
        chunkRange: '3-4',
        chunkExample: '{"messages": ["chunk 1", "chunk 2", "chunk 3", "chunk 4 (only if needed)"]}',
        chunkRule: '3 to 4 chunks for long replies. Prefer fewer fuller bubbles with paragraph gaps inside each bubble instead of a pile of tiny separate bubbles.',
        lengthRule: 'Aim for 1400-2800 characters total when the inbound is long, emotional, or multi-topic. Go longer if several long messages need separate answers.',
        styleRule: 'Thoughtful chunks: each message can include 1-3 short paragraphs separated by a blank line, normal phone autocorrect casing, Australian casual.',
        extraBlock: `

DEEP REPLY MODE:
They sent a long, emotional, or multi-topic message. Do not compress this into a tiny lead reply.
- Choose the conversational centre of gravity first; do not reply to the batch like a checklist.
- Cover the emotional thread first when it is still live, then any practical coaching/business thread, then Shannon's own answer if they asked how he is.
- If an older point has already been answered, is stale banter, or would make the reply feel like a recap, drop it.
- If there is a soft challenge opening, make it feel like a personal invitation, not a pitch.
- Be warm and specific, but do not become a therapist or write polished motivational content.
- Include one thoughtful question only when it naturally continues a detail they shared. It can sit in the middle of the reply near that detail, then Shannon can keep answering the rest. Never several questions.`,
    };
}

async function generateDraft({ leadName, leadBlock, profileBlock, memoryBlock, coachDayContextBlock = '', checkinThreadBlock = '', learningReelContextBlock = '', learningReelReplyAnchorBlock = '', nativeStoryOutreachContext = null, history, currentMessage, recentInboundMessages = [], leadStage, channel, igThreadId, linkedUserId, priorScheduledDrafts, linkedNudges, recentWorkoutEvidence, weeklyAppContext, onboardingPhase, qualifier, qualifierQuestion, botAccount, coachId = null }) {
    // Scope edits to THIS conversation first. Pulls per-IG-thread edits
    // (and per-app-user when a converted lead has been linked) so the AI
    // picks up the specific voice Shannon uses with this person. General
    // edits fill remaining slots when person-specific is sparse.
    const editExamples = await loadEditExamples({
        igThreadId,
        clientId: linkedUserId,
        coachId,
    });
    const coachBio = buildCoachBioBlock();
    const appNavigationGuide = buildAppNavigationGuideBlock();
    const appXpGuide = buildAppXpGuideBlock();
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();
    const shannonDmTuning = buildShannonDmTuningBlock();
    const openAiShannonVoice = buildOpenAIShannonVoiceBlock();
    const isSalesLeadThread = isSalesAcquisitionThread({ leadStage, linkedUserId });
    const accountExperimentBlock = isSalesLeadThread ? buildAccountExperimentBlock(botAccount) : '';
    const acquisitionMomentumBlock = buildAcquisitionMomentumBlock({ botAccount, leadStage, linkedUserId });
    const acquisitionStyleBlock = buildAcquisitionStyleBlock({ leadStage, linkedUserId });
    const cocosRewardLearningBlock = isSalesLeadThread ? await loadCocosRewardLearningBlock(botAccount) : '';

    const priorInboundMessages = Array.isArray(recentInboundMessages) ? recentInboundMessages : [];
    const promptCurrentMessage = sanitizeIgStoryReplyContextText(currentMessage);
    const currentMessageKey = normalizedIgLeadMessageKey(promptCurrentMessage);
    const storyReplyPromptContextBlock = buildIgStoryReplyPromptContextBlock({
        leadName,
        currentMessage,
        recentInboundMessages: priorInboundMessages,
    });
    const sanitizedPriorInboundMessages = priorInboundMessages.map(m => {
        const rawText = String(m?.text || '').trim();
        return {
            ...m,
            storyReplyContext: isIgStoryReplyContextText(rawText),
            text: sanitizeIgStoryReplyContextText(rawText),
        };
    }).filter(m => {
        if (!m.text) return false;
        if (!m.storyReplyContext || !currentMessageKey) return true;
        return normalizedIgLeadMessageKey(m.text) !== currentMessageKey;
    });
    const promptHistory = (Array.isArray(history) ? history : []).filter(m => {
        if (!m || m.direction !== 'in' || !currentMessageKey) return true;
        const rawText = String(m.text || '').trim();
        if (!isIgStoryReplyContextText(rawText)) return true;
        return normalizedIgLeadMessageKey(sanitizeIgStoryReplyContextText(rawText)) !== currentMessageKey;
    });
    const mediaSourceMessages = [
        ...sanitizedPriorInboundMessages.map(m => String(m?.text || '').trim()),
        promptCurrentMessage,
    ];
    // Inline media from the whole unanswered inbound batch, not just the
    // newest text. IG leads often send a voice note/photo/video and then a
    // short follow-up before Shannon reviews the card; coalescing should not
    // make the earlier media disappear from the model's ears/eyes.
    const {
        imageParts,
        audioParts,
        videoParts,
        mediaParts,
        rewrittenMessages,
        photoUrlCount,
        audioUrlCount,
        videoUrlCount,
        reelContextText,
        reelContextCount,
        reelThumbnailCount,
    } = await buildMessageMediaBatchParts(mediaSourceMessages);
    const rewrittenPriorMessages = rewrittenMessages.slice(0, sanitizedPriorInboundMessages.length);
    const rewrittenMessage = rewrittenMessages[rewrittenMessages.length - 1] || promptCurrentMessage;
    // Detect when the message had photo URLs but the fetch failed (Meta CDN
    // rejected us, signed URL expired, image too large, etc). In that case
    // imageParts is empty even though the original message had `[PHOTO:url]`
    // markers — the AI should still know a photo came in so it can reply
    // naturally ("can you re-send that, didn't open for me") instead of
    // producing a confused or empty draft.
    const hadPhotoUrls = photoUrlCount > 0;
    const hadAudioUrls = audioUrlCount > 0;
    const hadVideoUrls = videoUrlCount > 0;
    const hasReelContext = reelContextCount > 0;
    const photoFetchFailed = hadPhotoUrls && imageParts.length === 0;
    const audioFetchFailed = hadAudioUrls && audioParts.length === 0;
    const videoFetchFailed = hadVideoUrls && videoParts.length === 0 && !hasReelContext;
    const mediaFailureNotes = [];
    if (photoFetchFailed) {
        mediaFailureNotes.push('one of the photos in the unanswered batch did not open on my end, ask casually if they can re-send or check if it loaded for them');
    }
    if (audioFetchFailed) {
        mediaFailureNotes.push('one of the voice notes in the unanswered batch did not play on my end, ask casually if they can resend it or type the gist');
    }
    if (videoFetchFailed) {
        mediaFailureNotes.push('one of the videos in the unanswered batch did not open on my end, ask casually if they can resend it or type the gist');
    }
    const mediaDecode = {
        photo_failed: photoFetchFailed,
        audio_failed: audioFetchFailed,
        video_failed: videoFetchFailed,
        photo_url_count: photoUrlCount,
        photo_inline_count: imageParts.length,
        audio_url_count: audioUrlCount,
        audio_inline_count: audioParts.length,
        video_url_count: videoUrlCount,
        video_inline_count: videoParts.length,
        reel_context_count: reelContextCount || 0,
        reel_thumbnail_count: reelThumbnailCount || 0,
    };
    const currentMessageNotes = [];
    if (mediaFailureNotes.length) {
        currentMessageNotes.push(`NOTE: ${mediaFailureNotes.join('. ')}. Don't pretend you saw or heard it.`);
    }
    if (reelContextText) {
        currentMessageNotes.push(
            `INSTAGRAM REEL CONTEXT:\n${reelContextText}`
        );
    }
    const mediaContextPromptBlock = currentMessageNotes.length ? `

CURRENT MESSAGE MEDIA CONTEXT (background for the inbound batch, not ${leadName}'s own typed words):
${currentMessageNotes.join('\n\n')}

MEDIA CONTEXT RULES:
- Treat reel captions, titles, creator/account names, thumbnails, transcripts, and metadata as media evidence only.
- Do not treat questions inside a reel caption or transcript as a question from ${leadName}. If a reel says "what are you up to this weekend?", react to the reel or why ${leadName} shared it, but do not answer with Shannon's weekend/day unless ${leadName} typed that question separately.
- If the reason ${leadName} shared the reel is unclear, keep it short and broad instead of explaining the reel back to them.` : '';
    const learningReelEvidenceBlock = [learningReelReplyAnchorBlock, learningReelContextBlock]
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .join('\n\n');
    const currentMessageText = rewrittenMessage;
    const replyMode = resolveReplyMode({ currentMessageText, recentInboundMessages: sanitizedPriorInboundMessages, history, leadStage, linkedUserId, onboardingPhase });
    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const unansweredBatch = [
        ...sanitizedPriorInboundMessages.map((m, index) => ({
            text: String(rewrittenPriorMessages[index] || m?.text || '').trim(),
            created_at: m?.created_at || null,
            isCurrent: false,
        })),
        {
            text: currentMessageText,
            created_at: promptNow.toISOString(),
            isCurrent: true,
        },
    ].filter(m => m.text);
    const unansweredBatchBlock = unansweredBatch.length <= 1 ? '' : `

UNANSWERED INBOUND BATCH FROM ${leadName} (oldest -> newest):
${unansweredBatch.map((m, i) => `${i + 1}. ${m.text}${m.isCurrent ? ' (latest)' : ''}`).join('\n')}

Use this batch as context, not a checklist. First decide what is still live: direct questions, requests, emotional disclosures, health/body-image risk, or new practical blockers. Answer those. Drop earlier details that Shannon already acknowledged, repeated logistics, or banter that would feel stale. If several items are live, pick the 1-3 that matter most and let the rest sit. If the newest item is a photo or voice note, treat it as extra context for the strongest unresolved words unless it clearly starts a new topic.`;

    const historyText = promptHistory.length === 0
        ? "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)"
        : promptHistory.map((m, i) => {
            const speaker = m.direction === 'in' ? leadName : 'Shannon';
            const cleaned = replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text), { photo: '[photo]', audio: '[voice note]', video: '[video]' });
            return formatTimedConversationLine({
                speaker,
                text: cleaned,
                createdAt: m.created_at,
                previousCreatedAt: promptHistory[i - 1]?.created_at,
                now: promptNow,
            });
        }).join('\n');

    const pitchHint = pitchHintForStage(leadStage);
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    const channelShort = channel === 'messenger' ? 'Messenger' : 'IG';

    // Once a lead is in_app (or paying / churned), the Meta-ad-funnel
    // intake script is actively HARMFUL: it tells the AI to ask Name +
    // Age + main goal + tripped-you-up-before whenever the message
    // matches "I'm In!" intent. For Taylah on 2026-04-29 this produced
    // a fully-onboarded client being asked to onboard from scratch.
    // Linked-user threads are also gated even if lead_stage is somehow
    // still 'new' — linked_user_id is the truth, the column lags.
    const isOnboardedOrPostFunnel = !isSalesLeadThread;
    const funnelContext = isOnboardedOrPostFunnel ? '' : META_AD_FUNNEL_CONTEXT;
    const challengeNextStepBlock = buildChallengeNextStepBlock(qualifier, currentMessageText);
    const oneOnOneCoachingBlock = isOnboardedOrPostFunnel ? '' : buildOneOnOneCoachingBlock();
    const qualifierRelationshipBlock = buildQualifierRelationshipBlock(qualifier);

    // Cross-channel: when this lead is linked to an app user, fold in
    // the in-app DM transcript so the AI sees BOTH sides of recent
    // conversation (Shannon's IG-side outbounds are usually sent
    // natively and don't land in ig_messages). Without this the prompt
    // sees only the inbound IG message with no idea what the client is
    // replying to.
    const linkedHistory = Array.isArray(linkedNudges) ? linkedNudges : [];
    const crossChannelBlock = linkedHistory.length === 0 ? '' : `

CROSS-CHANNEL HISTORY (in-app DMs, older → newer — the parallel conversation Shannon has had with this client inside the Balance app):
${linkedHistory.map((m, i) => {
        const speaker = m.sender_id === linkedUserId ? leadName : 'Shannon';
        const cleaned = replaceIgMediaMarkers(m.message || '', { photo: '[photo]', audio: '[voice note]', video: '[video]' });
        return formatTimedConversationLine({
            speaker,
            text: cleaned,
            createdAt: m.created_at,
            previousCreatedAt: linkedHistory[i - 1]?.created_at,
            now: promptNow,
        });
    }).join('\n')}

Treat this as the SAME relationship as the ${channelLabel} thread below. Don't ask things they've already answered in-app. If Shannon sent an in-app message that the new ${channelShort} reply is clearly answering, use that as the question being answered.`;

    const dailyGreetingPriorMessages = [
        ...(Array.isArray(history) ? history : []).map(m => ({ created_at: m?.created_at })),
        ...(Array.isArray(linkedHistory) ? linkedHistory : []).map(m => ({ created_at: m?.created_at })),
    ];
    const allowDailyGreeting = shouldAllowDailyGreeting({
        priorMessages: dailyGreetingPriorMessages,
        now: promptNow,
    });
    const dailyGreetingPolicyBlock = buildDailyGreetingPolicyBlock({
        priorMessages: dailyGreetingPriorMessages,
        now: promptNow,
        channelLabel: `${channelLabel} / Balance DM`,
    });

    const mergedConversationEvents = [];
    promptHistory.forEach(m => {
        const speaker = m.direction === 'in' ? leadName : 'Shannon';
        mergedConversationEvents.push({
            speaker,
            channel: `${channelLabel} DM`,
            text: replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || ''), { photo: '[photo]', audio: '[voice note]', video: '[video]' }),
            created_at: m.created_at,
        });
    });
    linkedHistory.forEach(m => {
        const speaker = m.sender_id === linkedUserId ? leadName : 'Shannon';
        mergedConversationEvents.push({
            speaker,
            channel: 'in-app DM',
            text: replaceIgMediaMarkers(m.message || '', { photo: '[photo]', audio: '[voice note]', video: '[video]' }),
            created_at: m.created_at,
        });
    });
    if (currentMessageText) {
        mergedConversationEvents.push({
            speaker: leadName,
            channel: `${channelLabel} DM`,
            text: currentMessageText,
            created_at: promptNow.toISOString(),
        });
    }
    mergedConversationEvents.sort((a, b) => {
        const ta = Date.parse(a.created_at || '') || 0;
        const tb = Date.parse(b.created_at || '') || 0;
        return ta - tb;
    });
    const totalConversationText = mergedConversationEvents.length === 0
        ? "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)"
        : mergedConversationEvents.map((event, i) => formatTimedConversationLine({
            speaker: `${event.speaker} (${event.channel})`,
            text: event.text,
            createdAt: event.created_at,
            previousCreatedAt: mergedConversationEvents[i - 1]?.created_at,
            now: promptNow,
        })).join('\n');
    const lastShannonConversationEvent = [...mergedConversationEvents].reverse()
        .find(event => event.speaker === 'Shannon');
    const currentTurnAnchorBlock = buildCurrentTurnAnchorBlock({
        currentMessageText,
        lastShannonText: lastShannonConversationEvent?.text || '',
    });

    // Prior-draft block: when Shannon had a Send-later draft queued and the
    // lead messaged again before it fired, the main handler canceled the
    // scheduled send and passes the canceled text here. Same UX intent as
    // the in-app instant-coach-draft path — the new draft sees Shannon's
    // prior intent so it can fold or pivot.
    const priorScheduled = Array.isArray(priorScheduledDrafts) ? priorScheduledDrafts.filter(Boolean) : [];
    const priorScheduledBlock = priorScheduled.length === 0 ? '' : `

PREVIOUSLY DRAFTED (NOT YET SENT — Shannon had this queued to send later, but ${leadName} messaged again before it fired so we canceled it):
${priorScheduled.map((t, i) => `[draft ${i + 1}] ${t}`).join('\n')}

Treat the canceled draft as Shannon's recent intent. If ${leadName}'s new message continues the same topic, fold the key point into your reply. If they've moved on, drop it. Either way the new chunks must work as fresh messages — never reference "I was about to say" or apologise for the delay.`;

    const isFirstCapturedLeadReply = !isOnboardedOrPostFunnel
        && history.length === 0
        && linkedHistory.length === 0
        && priorScheduled.length === 0;
    const firstCapturedLeadReplyBlock = isFirstCapturedLeadReply ? `

FIRST CAPTURED LEAD REPLY:
There is no reliable prior DM context in the system. Usually Shannon has already commented on or replied to their story/post from Instagram/Facebook, but that native opener was not captured by ManyChat.
- Do not ask what this is about or say you have no context.
- If their message is short or ambiguous, treat it as them replying to unseen story/post context. Match their energy and keep it short. Ask a tiny clarifier only if needed.
- If they clearly ask about the challenge, what is included, plant-based stuff, a signup link, or ask Shannon for help because they feel stuck, answer that directly and keep it casual.
- No coaching intake, no pitch, no name/age/goal bundle on this first captured reply.` : '';

    const mediaInstruction = [
        imageParts.length
            ? `(${imageParts.length} photo${imageParts.length === 1 ? '' : 's'} from the unanswered batch attached below. Use what you see silently and let it shape your reply. Match the numbered photo references in the batch above. If it's food, react to what you see. If it's a body/progress shot, give specific feedback. If it's something casual or funny, react naturally. Do not say you looked at, saw, opened, or checked the photo; they already know they sent it.)`
            : '',
        audioParts.length
            ? `(${audioParts.length} voice note${audioParts.length === 1 ? '' : 's'} from the unanswered batch attached below. Use what they said silently and respond to the content. Match the numbered voice-note references in the batch above. Treat it like a normal DM, not a transcription task. Do not say you listened to, heard, opened, or checked the voice note; they already know they sent it.)`
            : '',
        videoParts.length
            ? `(${videoParts.length} video${videoParts.length === 1 ? '' : 's'} from the unanswered batch attached below. Use what happens in the clip silently and let it shape your reply. Match the numbered video references in the batch above. If the clip is just casual context, react naturally. Do not say you watched, opened, looked at, or checked the video; they already know they sent it.)`
            : '',
    ].filter(Boolean).join(' ');

    const mediaModelLabel = (provider) => {
        const kinds = [];
        if (imageParts.length) kinds.push('vision');
        if (audioParts.length) kinds.push('audio');
        if (videoParts.length) kinds.push('video');
        return `${provider}-${kinds.length > 1 ? 'media' : (kinds[0] || 'media')}`;
    };

    let prompt = `${replyMode.intro} ${channelLabel} DM reply in Shannon's voice, broken into ${replyMode.chunkRange} messages so it lands like real texting (separate bubbles, not one wall of text).

GREETING RULE:
${dailyGreetingPolicyBlock}

This is ${channelShort}. ${replyMode.styleRule} No emojis unless they used one first. No links unless absolutely necessary. Sound like a person texting back, not a brand.
${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}
${shannonDmTuning}
${openAiShannonVoice}
${accountExperimentBlock}
${acquisitionMomentumBlock}
${cocosRewardLearningBlock}
${firstCapturedLeadReplyBlock}
${replyMode.extraBlock}
${nativeStoryOutreachContext?.block || ''}
${currentTurnAnchorBlock}
${checkinThreadBlock}
${learningReelContextBlock}

CONVERSATION RESPONSIBILITY:
- Treat the new message as an answer to Shannon's latest question when that is obvious. Continue that thread before changing topic.
- When that answer completes the small thread, do not turn it into another question by default. A practical steer, acknowledgement, or clean pause is often better for active clients.
- Older messages are not automatically unresolved. Respond to previous statements only when they are still carrying the real ask, emotion, risk, or useful context. Otherwise let them drop.
- If the newest message is light media/banter attached to a heavier earlier message, decide whether the media is just a softener before writing. Do not let a puppy photo or quick joke erase a vulnerable disclosure or practical request.
- If they send a voice note, photo, or video that was decoded, do not open with a receipt like "just listened to your voice note", "saw your photo", or "watched the video". Reply straight to what it means.
- Only add a Shannon day/work/training/pet update when they directly ask what Shannon is doing, how his day is going, or what is on his agenda. If they ask what a topic is like "by you", "near you", or where Shannon is, answer that topic briefly instead of adding a random app/Sunshine/day update. First check whether Shannon already answered that exact personal question in the recent timeline.
- Do not assume the client is currently working, just finished work, on shift, or recovering after a shift from old work-history context. Mention today's shift/work only when the latest message, the current unanswered batch, or a same-day direct answer proves it.
- Do not open with "morning", "afternoon", or "evening" when this is already an active same-day thread or Shannon already greeted them recently.
- If they admit they have been "slacking", off track, missed training, or had a rough week, don't reply with filler like "ahh yeah man" on its own, don't ask "wby"/"what about you", and don't repeat the same broad question. Validate lightly, then ask one concrete follow-up about what got in the way or what small session they can lock in next.
- The funnel should feel invisible. It can take hours or months. One smooth human question beats a forced qualifier or pitch.
- Do not default to a question. Use a question only when it is the most natural next text. If they are bantering, answering a previous question, or sending a quick update, a short reaction can be the whole reply.
- If Shannon asked whether someone was okay after a sad animal/pet story and they reply that they are okay but the animals are not, treat that as the answer. Do not ask "what happened to them" or mine the sad story for details. Acknowledge the cruelty/heartbreak, then if a question is useful bridge through values instead: how long they have been vegan/plant-based, what got them into it, or later how they go with fitness. Once vegan values plus fitness context are warm, a soft free-challenge invite can be earned.
- If they answer a pet-name question with just a name, use the native story context and/or known memory for the species. Do not ask what kind of dog/cat/breed it is unless the species is explicit and that question is genuinely needed. A short reaction like "nero is cute" is enough.
- If dog/pet names, ownership, house-sitting status, or house-sitting timing are already in the timeline, do not ask for them again. Acknowledge the known names or give a clean reaction, then stop or move to a more useful thread.
- Do not comment on their emoji usage as a topic. Emojis are tone only.
- When they send rich personal detail, the natural question often belongs inside the paragraph that reflects that exact detail, not as a final closer. Example shape: "that makes sense, getting lost in cooking would be so therapeutic. do you have a number 1 thing you love making?" then keep responding to the other things they shared or answer what they asked Shannon.
- Keep the spotlight on them unless they directly ask about Shannon.

GROUNDING AND TIMELINE RULES:
- Specific claims must be traceable to the data below: their message, conversation history, client memory, cross-channel notes, or exact app workout logs.
- Only mention exact weights, reps, exercise names, dates, injuries, goals, events, or personal facts when they appear in those sources.
- If the app logs do not show a weight or exercise, keep the workout reference general. Do not invent numbers like "5kg weights".
- Equipment access is not workout performance. If memory says they own equipment but logs/messages do not say they used it, phrase it as available equipment, not something they did.
- Read timestamps. If history shows an event already happened, do not ask when it is. Ask how it went, react to what they sent, or ask what the photo/object is.
- If Shannon already said "happy birthday", "how did the big day go", "how was the party", or similar, treat the party/event as past unless the client clearly introduces a different future event.
- Shannon's own day/training/food/work details must come from SHANNON DAY CONTEXT below when available, and only when the client directly asked about him.

ACTION CLAIMS:
- You are only drafting text. Do not claim Shannon has updated, moved, fixed, re-linked, checked, created, sent, or changed anything unless the conversation or app data below shows that action already happened.
- Never write a sequence like "I'll do that now" and then "done" / "just finished" in the same draft. That is fake and unnatural.
- If the client asks Shannon to change something, either tell them where they can do it in the app, or say Shannon can sort it / will have a look. Do not claim completion.
- If they report a weird food/meal name from the app, correct obvious voice-to-text or typo errors using the conversation and app context instead of repeating the nonsense phrase as a real meal. Example: if the likely plan meal is "Berry Almond Baked Oats", do not call it "very almond mixed oats".
- If they report a calorie/logging discrepancy, acknowledge it as something Shannon should check. Do not promise to manually adjust or log anything unless the app data below proves it has already been done.
${acquisitionStyleBlock}
- For first/early replies to Shannon's story opener, default to asking one light question about their hook. Only skip when they only said thanks/emoji/filler, it is a genuinely short no-response-needed reply, the topic is a current safety/medical/rehab advice situation, or the thread is clearly closing. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is not sensitive by itself. Keep it as light rapport if you can reply without advice. If the context is unclear, the message suggests confusion or AI suspicion, or media needs inspection, stop and hand it to Needs You instead of guessing. A Shannon-side personal aside cannot be the whole reply in this moment. Example: if they reply about InsightTimer filling your cup, ask whether they use it more for meditations or the little reminders.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}
${coachDayContextBlock}
${appNavigationGuide}
${appXpGuide}
${funnelContext}
${challengeNextStepBlock}
${oneOnOneCoachingBlock}
${unansweredBatchBlock}
${storyReplyPromptContextBlock}
${mediaContextPromptBlock}
${learningReelReplyAnchorBlock}

TOTAL CONVERSATION TIMELINE (all known channels, oldest -> newest, includes their new message at the end):
${totalConversationText}

CLIENT NOTES AND APP CONTEXT (read after the conversation timeline, use only when relevant):
LEAD: ${leadName}${profileBlock || ''}${leadBlock}${memoryBlock || ''}${qualifierRelationshipBlock}${priorScheduledBlock}

RECENT APP SNAPSHOT (last 7 days, only use when relevant):
${weeklyAppContext || '(no recent app activity snapshot available)'}

EXACT APP WORKOUT LOGS (only use these details if relevant):
${recentWorkoutEvidence || '(no recent exact workout set logs available)'}

CURRENT TIME (Australia/Brisbane): ${promptNowText}. Use the message timestamps and gaps to judge pace, delays, stale threads, and whether Shannon should acknowledge time passing. Do not mention exact timestamps unless it would feel natural.

THEIR NEW MESSAGE (just arrived around ${promptNowText}):
${currentMessageText}${mediaInstruction ? ` ${mediaInstruction}` : ''}${editExamples}
${qualifierQuestion ? `
IMPORTANT — CONVERSATIONAL DISCOVERY:
Use this question only if it naturally fits this exact reply: "${qualifierQuestion}"
This is guidance, not a command. If the latest message is only thanks/emoji/filler, closing, a genuinely short no-response-needed reply, or a current safety/medical/rehab advice situation, skip it. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is normal rapport when the reply stays non-medical. If it is a first/early story/post reply with anything more than that, use the question or rewrite it around that topic so the reply earns the next response. If you do use it, ask only that one light question. When the reply has several things to answer, weave the question into the reflection that sparked it instead of defaulting to a standalone final bubble. Do not add a goal, age, blocker, or coaching pitch in the same reply.
If the question sounds generic or ignores a fresher detail from their latest message, rewrite it around that detail or skip the question. Never paste a stock line like "what does a normal day look like", "are you much of a cook or more of a takeaway person", "you training at the moment", or "what are your goals" into an auto-DM draft.
` : ''}
OUTPUT FORMAT — JSON only, nothing else:
${replyMode.chunkExample}

Rules:
- ${replyMode.lengthRule}
- 1 to 3 chunks. One-liner is fine — just one item in the array.
- Split where Shannon would naturally pause: new thought, change of topic, follow-up question.
- Do not park every question at the end. If the question belongs to one specific detail, put it with that detail and keep going.
- Make each chunk a paragraph-sized bubble. If a thought is getting long, finish the sentence or paragraph, send that chunk, then continue in the next chunk.
- Don't artificially split a single sentence. Each chunk should stand on its own.
- Never put literal backslash-n escape sequences inside a chunk. Use normal punctuation, or start a new chunk if you need a pause.
- The JSON wrapper is only for the system. The chunk strings must contain only the exact DM text Shannon would send. Never put "json", "messages", "chunk", labels, or formatting instructions inside a chunk.
- No quotes, labels, code-fence, or commentary outside the JSON.`;
    prompt = prompt.replace(
        /- 1 to 3 chunks\.[^\n]*\n- Split where/,
        `- ${replyMode.chunkRule}\n- Split where`
    );

    const inlineMediaParts = videoParts.length > 0
        ? [...mediaParts, { text: prompt }]
        : [{ text: prompt }, ...mediaParts];
    const mediaContents = [{ role: 'user', parts: inlineMediaParts }];
    const hasInlineMedia = mediaParts.length > 0;
    // Text-only contents — used when vision fails OR when there's no image.
    // We rebuild the prompt with the photo-failed hint so the AI knows to
    // ask casually about the photo without pretending it saw it.
    const textOnlyPrompt = hasInlineMedia
        ? prompt.replace(
            'THEIR NEW MESSAGE:\n' + currentMessageText + (mediaInstruction ? ` ${mediaInstruction}` : ''),
            'THEIR NEW MESSAGE:\n' + currentMessageText + (reelContextText
                ? ' (NOTE: use the reel caption/metadata text above if the thumbnail is unavailable in this fallback. Do not claim to have watched the full reel.)'
                : ' (NOTE: attached media could not be decoded in this fallback. If the reply depends on it, casually ask them to resend it or type the gist. Do not pretend you saw or heard it.)')
        )
        : prompt;
    const textContents = [{ role: 'user', parts: [{ text: textOnlyPrompt }] }];
    const generationConfig = {
        maxOutputTokens: replyMode.maxOutputTokens,
        temperature: isShortAnswerMessage(currentMessageText) ? 0.55 : 0.85,
    };

    let rawText = '';
    let model = 'none';
    let lastError = null;

    if (hasInlineMedia) {
        // Vision path: try the public Gemini API first (works fine on a paid
        // tier key, which is what Shannon has now), and fall back to Vertex
        // AI's hosted Gemini if the public API has a hiccup. v7 is text-only
        // fine-tuned so we never send image bytes there -- it's out-of-
        // distribution.
        try {
            rawText = requireNonEmptyDraftText(
                await callGeminiFallback(mediaContents, generationConfig),
                'public Gemini media'
            );
            model = mediaModelLabel('gemini');
        } catch (err) {
            console.warn('[ig-draft] public Gemini media failed, trying Vertex Gemini:', err.message);
            lastError = `public-media: ${err.message.slice(0, 200)}`;
            try {
                rawText = requireNonEmptyDraftText(
                    await callVertexGeminiMultimodal(mediaContents, generationConfig),
                    'Vertex Gemini media'
                );
                model = `${mediaModelLabel('vertex-gemini')}-fallback`;
                lastError = null; // recovered
            } catch (err2) {
                console.warn('[ig-draft] Vertex Gemini media also failed:', err2.message);
                lastError = `${lastError} | vertex-media: ${err2.message.slice(0, 200)}`;
            }
        }
    }

    if (!rawText) {
        // No image OR vision failed -> text-only path. Vertex v7 first
        // (Shannon's voice), Gemini fallback if that errors.
        try {
            rawText = requireNonEmptyDraftText(
                await callVertexAIModel(textContents, generationConfig),
                'Vertex v7'
            );
            model = lastError ? 'vertex-v7+media-failed' : 'vertex-v7';
        } catch (err) {
            console.warn(`[ig-draft] Vertex failed, falling back to Gemini: ${err.message}`);
            lastError = `${lastError ? lastError + ' | ' : ''}vertex: ${err.message.slice(0, 200)}`;
            try {
                rawText = requireNonEmptyDraftText(
                    await callGeminiFallback(textContents, generationConfig),
                    'Gemini text fallback'
                );
                model = lastError ? 'gemini-fallback+media-failed' : 'gemini-2.0-fallback';
            } catch (err2) {
                console.error('[ig-draft] Gemini fallback failed:', err2.message);
                lastError = `${lastError ? lastError + ' | ' : ''}gemini: ${err2.message.slice(0, 200)}`;
                return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length, audioCount: audioParts.length, videoCount: videoParts.length, reelContextCount, reelThumbnailCount, mediaDecode, timeline: totalConversationText, currentTurnAnchorBlock, storyReplyPromptContextBlock, mediaContextPromptBlock, learningReelContextBlock, learningReelReplyAnchorBlock, learningReelEvidenceBlock };
            }
        }
    }

    const hasDecodedMedia = mediaParts.length > 0;
    let emptyDraftRecovery = null;
    let cleanedChunks = finalizeDraftChunksFromRawText(rawText, {
        maxChunks: replyMode.maxChunks,
        leadName,
        currentMessageText,
        qualifier,
        nativeStoryContextSummary: nativeStoryOutreachContext?.summary || null,
        knownContextText: totalConversationText,
        hasDecodedMedia,
        allowDailyGreeting,
    });
    if (!cleanedChunks.length && hasInlineMedia) {
        const lastShannonConversationEvent = [...mergedConversationEvents].reverse()
            .find(event => event.speaker === 'Shannon');
        const recovery = await generateMediaRecoveryDraft({
            mediaParts,
            mediaDecode,
            leadName,
            channelLabel,
            currentMessageText,
            totalConversationText,
            lastShannonText: lastShannonConversationEvent?.text || '',
            replyMode,
            allowDailyGreeting,
            qualifier,
            nativeStoryContextSummary: nativeStoryOutreachContext?.summary || null,
        });
        if (recovery.chunks.length) {
            cleanedChunks = recovery.chunks;
            const baseModel = String(model || 'none');
            model = recovery.usedFallback
                ? `${baseModel}+safe-media-fallback`
                : `${baseModel}+${recovery.model || 'media-retry'}`;
            emptyDraftRecovery = {
                recovered: true,
                via: recovery.usedFallback ? 'safe_media_fallback' : 'media_retry',
                model: recovery.model || null,
                error: recovery.error || null,
                recovered_at: new Date().toISOString(),
            };
            if (recovery.error) {
                lastError = `${lastError ? lastError + ' | ' : ''}${recovery.error}`;
            }
        } else {
            emptyDraftRecovery = {
                recovered: false,
                via: 'media_retry',
                error: recovery.error || 'empty_media_recovery',
                recovered_at: new Date().toISOString(),
            };
        }
    }
    if (!cleanedChunks.length) {
        const fallbackChunks = buildEmptyMediaDraftFallbackChunks({ mediaDecode, currentMessageText });
        if (fallbackChunks.length) {
            cleanedChunks = fallbackChunks;
            model = `${String(model || 'none')}+safe-media-fallback`;
            emptyDraftRecovery = {
                recovered: true,
                via: 'safe_media_fallback',
                model: null,
                error: lastError || 'empty_draft_after_generation',
                recovered_at: new Date().toISOString(),
            };
        }
    }
    const shadowDraftInput = (model === 'vertex-v7' && !hasInlineMedia) ? {
        contents: textContents,
        generationConfig,
        clientName: leadName,
        allowGreeting: allowDailyGreeting,
        maxChunks: replyMode.maxChunks,
    } : null;
    return {
        chunks: cleanedChunks,
        joined: cleanedChunks.join('\n'),
        model,
        shadowDraftInput,
        replyMode: replyMode.name,
        maxChunks: replyMode.maxChunks,
        error: lastError,
        imageCount: imageParts.length,
        audioCount: audioParts.length,
        videoCount: videoParts.length,
        reelContextCount,
        reelThumbnailCount,
        urlCount: photoUrlCount,
        audioUrlCount,
        videoUrlCount,
        mediaDecode,
        timeline: totalConversationText,
        currentTurnAnchorBlock,
        storyReplyPromptContextBlock,
        nativeStoryOutreachContextBlock: nativeStoryOutreachContext?.block || '',
        mediaContextPromptBlock,
        learningReelContextBlock,
        learningReelReplyAnchorBlock,
        learningReelEvidenceBlock,
        emptyDraftRecovery,
    };
}

function _notifyQualifierAdvance({ priorStage, priorFacts, nextQualifier, leadName, channel, coachId, suppress = false }) {
    if (suppress) return;
    if (!coachId || !nextQualifier) return;
    const newStage = nextQualifier.stage;
    const stageLabels = { current_state: 'Current state', motivation: 'Motivation', history_blockers: 'History + blockers', commitment: 'Commitment', pitched: 'Pitched', won: 'Won', lost: 'Lost', paused: 'Paused' };
    const factKeys = ['current_state', 'motivation', 'history_blockers', 'commitment'];
    const newFacts = nextQualifier.facts || {};
    const justAnswered = factKeys.filter(k => !cleanFactValue(priorFacts[k]) && cleanFactValue(newFacts[k]));
    const stageAdvanced = priorStage && newStage && priorStage !== newStage;
    if (justAnswered.length === 0 && !stageAdvanced) return;
    const channelLabel = channel === 'messenger' ? 'FB' : 'IG';
    const completed = factKeys.filter(k => !!cleanFactValue(newFacts[k])).length;
    let title = `📊 ${leadName} (${channelLabel})`;
    let body = '';
    if (justAnswered.length > 0) {
        const answered = justAnswered.map(k => stageLabels[k] || k).join(', ');
        body += `Answered: ${answered}. `;
    }
    if (stageAdvanced) {
        const label = stageLabels[newStage] || newStage;
        body += `Now on stage ${nextQualifier.stage_index || '?'}/4: ${label}. `;
    }
    body += `(${completed}/4 complete)`;
    fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipientId: coachId,
            senderName: title,
            messageText: body,
            type: 'qualifier_advance',
            sourceChannel: channel,
        }),
    }).catch(e => console.warn('[ig-draft] qualifier advance push failed:', e.message));
}

async function sendDraftReadyPush({ adminId, alertId, leadName, leadMessage, draftText, clientId, channel, recentInboundMessages, qualifier, qualifierEligible, lifecycle, mediaReview, contextReview, autoHoldReason, challengeOfferWarning }) {
    if (!adminId) {
        console.warn('[ig-draft] skipping push — no admin coach_id on thread');
        return;
    }
    if (!clientId) {
        // The Android CoachDraftMessagingService rejects pushes with empty
        // clientId (it uses it as the MessagingStyle Person key). For cold
        // ManyChat leads with no linked_user_id we fall back to the
        // subscriber_id — stable per conversation, satisfies the contract.
        console.warn('[ig-draft] no clientId for push — skipping');
        return;
    }
    try {
        // Title is just the lead name now — channel info goes in the
        // subText, which Android renders in the small top-bar slot. Drops
        // the em-dash that used to read as AI-generated, and frees the
        // bold title line for the thing Shannon actually scans for: who
        // messaged him.
        const channelLabel = channel === 'messenger' ? 'Balance FB' : 'Balance IG';
        // Open-button deep link: launches the source app (Instagram or
        // Messenger) directly to the inbox so Shannon can find the
        // conversation natively. Both URLs route to the installed app via
        // intent filter when it's available; the browser is the fallback.
        const openUrl = channel === 'messenger'
            ? 'https://www.messenger.com/'
            : 'https://www.instagram.com/direct/inbox/';
        const hasDraft = !!draftText;
        // Qualifier-aware title/body. When the lead is in the funnel and
        // the AI thinks now's a question moment, body becomes "ask: <q>"
        // so Shannon sees the strategic move from the lock screen — taps
        // through to send the actual draft. When it's just chatting, body
        // is the draft preview as before.
        // Lifecycle dot prefix lets Shannon scan the lock-screen banner and
        // immediately tell whether this is a cold lead, a free-trial member,
        // a paying client, or someone who churned — without expanding the
        // notification or thinking about the lead_stage.
        const titleCore = formatPushTitle({ leadName, qualifier, eligible: qualifierEligible });
        const challengeOfferActive = !!challengeOfferWarning?.required;
        const titlePrefix = challengeOfferActive ? (challengeOfferWarning.dot || '🟡') : lifecycle?.dot;
        const title = autoHoldReason
            ? `🔴 AI stopped · ${titleCore}`
            : (titlePrefix ? `${titlePrefix} ${titleCore}` : titleCore);
        const mediaWarning = mediaReview?.required
            ? `Warning: ${mediaReview.label} sent. Check media before sending.`
            : '';
        const contextWarning = contextReview?.required
            ? 'Context check: tracked DM context may be incomplete. Open IG before sending.'
            : '';
        const autoHoldWarning = autoHoldReason
            ? (autoHoldReason.code === 'challenge_offer'
                ? `${challengeOfferWarning?.label || 'free challenge invite'} in this draft. Review before sending.`
                : `🔴 AI stopped auto-send: ${autoHoldReason.label}. Review before sending.`)
            : '';
        const challengeOfferPushWarning = challengeOfferActive
            ? `${challengeOfferWarning.dot || '🟡'} ${challengeOfferWarning.label || 'free challenge invite'} in this draft. Review before sending.`
            : '';
        const body = autoHoldWarning || mediaWarning || contextWarning || challengeOfferPushWarning || (hasDraft
            ? formatPushBody({ qualifier, draftText: truncate(draftText, 220), eligible: qualifierEligible })
            : `"${truncate(leadMessage, 180)}"`);
        // Strip media markers and truncate so the FCM payload stays
        // under the 4 KB limit even when several long messages stream in.
        const compactLongDraftPush = String(draftText || '').length >= LONG_DRAFT_PUSH_COMPACT_AT;
        const recentInboundForPush = (recentInboundMessages || []).map(m => ({
            text: truncate(replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || '')), compactLongDraftPush ? 90 : 280),
            created_at: m.created_at || null,
        }));
        const clientMessageForPush = compactLongDraftPush
            ? truncate(leadMessage || '', 260)
            : (leadMessage || '');
        // Qualifier sidecar — flat fields the Android coach-draft service
        // and PWA push fallback can render as a strip without parsing the
        // full JSON. Empty strings when the lead isn't qualifier-eligible
        // (in_app, paying, churned).
        const qualifierFields = qualifierEligible ? summarizeForFcmData(qualifier) : {};

        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: clientId,
                senderName: title,
                messageText: body,
                type: 'coach_draft_ready',
                alertId,
                clientId,
                clientName: leadName,
                clientMessage: clientMessageForPush,
                draftText: draftText || '',
                isSimpleReply: false,
                sourceChannel: channel,
                channelLabel,
                openUrl,
                recentInboundMessages: recentInboundForPush,
                challengeOfferWarning: challengeOfferActive ? '1' : '0',
                challengeOfferDot: challengeOfferWarning?.dot || '',
                challengeOfferLabel: challengeOfferWarning?.label || '',
                challengeOfferReason: challengeOfferWarning?.reason || '',
                ...(autoHoldReason ? {
                    actionRequired: true,
                    actionType: `auto_send_${autoHoldReason.code || 'review_hold'}`,
                    actionLabel: '🔴 AI stopped',
                    actionReason: autoHoldReason.label || 'needs Shannon review before sending',
                } : {}),
                ...qualifierFields,
                ...lifecycleForFcmData(lifecycle),
            }),
        }).catch(e => console.warn('[ig-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[ig-draft] push dispatch errored:', err.message);
    }
}

function shouldSendContextCheckNotification({ draftReview, contextReview }) {
    if (contextReview?.required) return true;
    if (draftReview?.notification_required) return true;
    return draftReview?.verdict === 'block';
}

async function sendContextCheckNotification({ adminId, alertId, leadName, clientId, channel, draftReview, contextReview, suppress = false }) {
    if (suppress) return;
    if (!adminId || !alertId) return;
    if (!shouldSendContextCheckNotification({ draftReview, contextReview })) return;
    try {
        const channelLabel = channel === 'messenger' ? 'Balance FB' : 'Balance IG';
        const openUrl = channel === 'messenger'
            ? 'https://www.messenger.com/'
            : 'https://www.instagram.com/direct/inbox/';
        const summary = draftReview?.summary || contextReview?.label || 'tracked DM context may be incomplete';
        const prefix = draftReview?.verdict === 'block' ? 'AI check blocked this draft' : 'Check source DM before sending';
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: clientId || '',
                senderName: `Context check - ${leadName || 'DM'}`,
                messageText: truncate(`${prefix}: ${summary}`, 220),
                type: 'dm_context_check',
                alertId,
                clientId: clientId || '',
                clientName: leadName || '',
                channelLabel,
                openUrl,
                url: './admin-dashboard.html?tab=needs-you',
            }),
        }).catch(e => console.warn('[ig-draft] context-check push failed:', e.message));
    } catch (err) {
        console.warn('[ig-draft] context-check push errored:', err.message);
    }
}

exports._test = {
    isIgStoryReplyContextText,
    sanitizeIgStoryReplyContextText,
    stripObviousMediaReceiptPreamble,
    getCocosAutoContextBypass,
    getBalanceAutoContextBypass,
    getAutoDmHoldReason,
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { threadId, messageText, manychatMessageId } = payload;
    if (!threadId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing threadId or messageText' }) };
    }

    const thread = await loadThread(threadId);
    if (!thread) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Thread not found' }) };
    }
    const threadOptedOut = isAiAutomationOptedOut(thread);
    const linkedUserExcluded = thread.linked_user_id ? await isTestAccount(thread.linked_user_id) : false;
    if (threadOptedOut || linkedUserExcluded) {
        try {
            await cancelPriorScheduledForIgThread({ igThreadId: thread.id });
        } catch (e) {
            console.warn('[ig-draft] opt-out scheduled cancel failed:', e.message);
        }
        console.log(`[ig-draft] skipping thread ${thread.id}: ${threadOptedOut ? 'codex_ai_opt_out' : 'linked_user_excluded'}`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                skipped: 'ai_automation_opt_out',
                thread_id: thread.id,
                linked_user_id: thread.linked_user_id || null,
                reason: threadOptedOut ? 'thread_codex_ai_opt_out' : 'linked_user_excluded',
            }),
        };
    }
    const botAccount = thread.custom_data?.bot_account || thread.custom_data?.instagram_graph?.bot_account || '';
    const algorithmFork = algorithmForkForBotAccount(botAccount);
    const cocosAutoSendLane = isCocosBotAccount(botAccount);
    const balanceAutoSendCandidate = !!thread.auto_send_enabled;
    const autoSendEnabled = cocosAutoSendLane;

    // Idempotency — when ManyChat supplied a message_id, reuse it. Otherwise
    // fall back to thread+timestamp (less robust but better than nothing
    // for ManyChat configs that don't pass message_id through).
    const idempotencyKey = manychatMessageId
        ? `ig_incoming_dm:${manychatMessageId}`
        : `ig_incoming_dm:${threadId}:${Date.now()}`;
    let regenerateExistingBlankAlert = null;

    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id,status,alert_type,priority,client_id,description,suggested_message,scheduled_reply_text,data&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            const existingAlert = existing[0];
            const existingData = existingAlert.data || {};
            const clearedContextHold = resolveStaleContextAutoHold({ existingAlert, existingData });
            const existingScheduleData = clearedContextHold?.data || existingData;
            const canResumeAutoSchedule = autoSendEnabled
                && existingAlert.status === 'pending'
                && (!existingData.auto_send_review_hold || !!clearedContextHold)
                && !existingData.auto_send_stopped;
            const existingReplyText = existingAlert.suggested_message
                || existingAlert.scheduled_reply_text
                || existingData.draft_text
                || '';
            if (existingAlert.status === 'pending' && !existingReplyText) {
                regenerateExistingBlankAlert = existingAlert;
                console.warn(`[ig-draft] duplicate alert ${existingAlert.id} has an empty draft, regenerating`);
            } else {
                if (canResumeAutoSchedule && existingReplyText) {
                    const timingSuggestion = buildIgAutoTimingSuggestion({
                        ...existingAlert,
                        data: existingScheduleData,
                    }, existingReplyText);
                    try {
                        const scheduleResult = await scheduleIgAutoReplyDirect({
                            alertId: existingAlert.id,
                            alertData: existingScheduleData,
                            replyText: existingReplyText,
                            timingSuggestion,
                        });
                        return {
                            statusCode: 200,
                            body: JSON.stringify({
                                skipped: 'duplicate',
                                alert_id: existingAlert.id,
                                auto_resumed: !scheduleResult.alreadyActioned,
                                context_hold_cleared: !!clearedContextHold,
                                status: scheduleResult.alreadyActioned ? existingAlert.status : 'scheduled',
                            }),
                        };
                    } catch (err) {
                        console.warn(`[ig-draft] duplicate auto-schedule resume failed for ${existingAlert.id}:`, err.message);
                    }
                }
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        skipped: 'duplicate',
                        alert_id: existingAlert.id,
                        status: existingAlert.status || null,
                    }),
                };
            }
        }
    } catch (e) { /* continue — partial unique index is the real guarantee */ }

    // Pick the friendliest display name for the push.
    //   - Prefer profile_name if it actually resolved (i.e. no literal
    //     `{{first_name}}` template strings sneaking through)
    //   - Otherwise prefer the IG/Messenger handle
    //   - Last resort: "Lead"
    const isUnresolvedTemplate = (v) => !v || /\{\{[^}]+\}\}/.test(String(v));
    let linkedClientProfile = null;
    if (thread.linked_user_id) {
        try {
            linkedClientProfile = await loadClientProfileFacts(thread.linked_user_id);
        } catch (e) { /* non-critical */ }
    }
    const threadDisplayName = !isUnresolvedTemplate(thread.profile_name)
        ? thread.profile_name
        : (!isUnresolvedTemplate(thread.ig_username) ? thread.ig_username : 'Lead');
    const linkedClientName = !isUnresolvedTemplate(linkedClientProfile?.name)
        ? linkedClientProfile.name
        : '';
    const leadName = linkedClientName || threadDisplayName;
    const permanentNeedsYouClient = isAlwaysNeedsYouPerson({
        name: leadName,
        client_name: leadName,
        profile_name: thread.profile_name,
        ig_username: thread.ig_username,
        username: thread.ig_username,
    });
    const history = await loadIgHistory(threadId, messageText);

    let memoryBlock = '';
    // For converted leads, prefer the in-app client_memory (richer signal,
    // includes workout/mood/diet history alongside conversation).
    if (thread.linked_user_id && thread.coach_id) {
        try {
            const memory = await loadClientMemory(thread.coach_id, thread.linked_user_id);
            memoryBlock = buildMemoryBlock(memory);
        } catch (e) { /* non-critical */ }
    }
    // Fall back to the thread's own running memory (populated by the
    // extract-ig-thread-memory cron) for cold leads who haven't signed up.
    // Same column shape as client_memory so buildMemoryBlock works as-is.
    if (!memoryBlock) {
        memoryBlock = buildMemoryBlock({
            goals: thread.goals,
            communication_style: thread.communication_style,
            running_notes: thread.running_notes,
            injuries_limits: thread.injuries_limits,
            personal_context: thread.personal_context,
            coach_instructions: thread.coach_instructions,
        });
    }

    let profileBlock = '';
    if (thread.linked_user_id) {
        try {
            const profile = linkedClientProfile || await loadClientProfileFacts(thread.linked_user_id);
            profileBlock = buildClientProfileBlock({ clientName: leadName, profile });
        } catch (e) { /* non-critical */ }
    }
    if (!profileBlock) {
        profileBlock = buildClientProfileBlock({
            clientName: leadName,
            profile: { customData: thread.custom_data || {} },
            customData: thread.custom_data || {},
        });
    }

    // Resolve the lead stage we'll actually use for prompt routing.
    // linked_user_id is the truth — once a lead has signed up, the
    // ig_threads.lead_stage column may still say 'new' until something
    // updates it. effectiveLeadStageForPrompt promotes that to 'in_app'
    // so the funnel script doesn't hijack the draft.
    const effectiveLeadStage = effectiveLeadStageForPrompt(thread, history);
    if (!thread.linked_user_id && thread.lead_stage === 'new' && effectiveLeadStage === 'qualifying') {
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: { lead_stage: 'qualifying' },
                prefer: 'return=minimal',
            });
            thread.lead_stage = 'qualifying';
        } catch (e) {
            console.warn('[ig-draft] mature-thread stage promotion failed:', e.message);
        }
    }

    const leadBlock = buildLeadBlock({
        profileName: thread.profile_name,
        igUsername: thread.ig_username,
        customData: thread.custom_data,
        leadStage: effectiveLeadStage,
    });

    // Cancel any prior Send-later drafts queued for this thread — see
    // helper docstring. Run before draft generation so the texts can be
    // folded into the prompt as context.
    let priorScheduledDrafts = [];
    try {
        priorScheduledDrafts = await cancelPriorScheduledForIgThread({ igThreadId: thread.id });
    } catch (e) {
        console.warn('[ig-draft] cancelPriorScheduledForIgThread failed:', e.message);
    }

    // Trailing streak of inbound IG/FB messages BEFORE this current one,
    // since Shannon's last outbound. Same UX as in-app: surface in the
    // notification + admin dashboard so the coach can see every message
    // the draft was generated against (especially after IG coalescing,
    // where multiple inbounds roll into one alert).
    const recentInboundMessages = selectRecentInboundSinceLastReplyIg({
        history,
        currentCreatedAt: new Date().toISOString(),
    });

    // For linked clients, also pull the in-app nudges thread so the AI
    // has both sides of recent conversation. Shannon's IG outbounds
    // usually fly natively (bypassing ManyChat → ig_messages), so without
    // this the prompt would only see the inbound IG message with no idea
    // what it's responding to.
    const linkedNudges = await loadLinkedNudgesContext(thread.coach_id, thread.linked_user_id);
    let recentWorkoutEvidence = '';
    let weeklyAppContext = '';
    if (thread.linked_user_id) {
        try {
            const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
            const workouts = await loadRecentWorkouts(thread.linked_user_id, since14d, 4);
            recentWorkoutEvidence = formatRecentWorkoutEvidence(workouts, 4);
        } catch (e) {
            console.warn('[ig-draft] recent workout evidence failed:', e.message);
        }
        try {
            const appContext = await loadWeeklyAppContext(thread.linked_user_id, { lookbackDays: 7 });
            weeklyAppContext = appContext.text || '';
            if (!recentWorkoutEvidence && appContext.recentWorkoutEvidence) {
                recentWorkoutEvidence = appContext.recentWorkoutEvidence;
            }
        } catch (e) {
            console.warn('[ig-draft] weekly app context failed:', e.message);
        }
    }
    let onboardingPhase = null;
    if (thread.linked_user_id && thread.coach_id) {
        try {
            onboardingPhase = await loadOnboardingPhase(thread.coach_id, thread.linked_user_id);
        } catch (e) {
            console.warn('[ig-draft] onboarding phase lookup failed:', e.message);
        }
    }
    let coachDayContextBlock = '';
    if (thread.coach_id && shouldIncludeCoachDayContext({
        currentMessage: messageText,
        recentInboundMessages,
    })) {
        try {
            coachDayContextBlock = buildCoachDayContextBlock(await loadCoachDayContext(thread.coach_id));
        } catch (e) {
            console.warn('[ig-draft] coach day context lookup failed:', e.message);
        }
    }
    let activeCheckinThread = null;
    let checkinThreadBlock = '';
    if (thread.coach_id && (thread.linked_user_id || thread.id)) {
        try {
            activeCheckinThread = await loadActiveCheckinThreadContext({
                coachId: thread.coach_id,
                clientId: thread.linked_user_id || null,
                igThreadId: thread.id,
            });
            checkinThreadBlock = buildCheckinConversationBlock(activeCheckinThread);
        } catch (e) {
            console.warn('[ig-draft] active check-in thread lookup failed:', e.message);
        }
    }
    const learningReelHistory = normalizeLearningReelHistory(thread).slice(0, 6);
    const learningReelContextBlock = buildLearningReelContextBlock(thread);
    const learningReelReplyAnchorBlock = buildLearningReelReplyAnchorBlock(thread, messageText);
    const learningReelEvidenceBlock = [learningReelReplyAnchorBlock, learningReelContextBlock]
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .join('\n\n');
    const nativeStoryOutreachContext = buildNativeStoryOutreachContextBlock(thread, leadName);

    const channel = thread.channel || 'instagram';
    const graphRecipientId = resolveThreadGraphRecipientId(thread);
    const graphAccountId = resolveThreadGraphAccountId(thread);
    const humanAgentRequired = channel === 'instagram' && !!graphRecipientId && isHumanAgentWindow(thread.last_inbound_at);
    const humanAgentReady = humanAgentRequired && INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED;
    const hasInstagramGraphRoute = channel === 'instagram' && !!graphRecipientId && (!humanAgentRequired || humanAgentReady);
    const isDirectGraphManual = channel === 'instagram'
        && !hasInstagramGraphRoute
        && (
            String(thread.subscriber_id || '').startsWith(GRAPH_SUBSCRIBER_PREFIX)
            || thread.custom_data?.source === 'instagram_graph'
            || thread.custom_data?.source === 'meta_ig_webhook'
            || thread.custom_data?.delivery_channel === 'instagram_graph'
            || thread.custom_data?.manual_ig_required === true
            || thread.custom_data?.instagram_graph?.source === 'instagram_graph'
            || thread.custom_data?.instagram_graph?.source === 'meta_ig_webhook'
            || humanAgentRequired
        );
    const deliveryChannel = hasInstagramGraphRoute ? 'instagram_graph' : (isDirectGraphManual ? 'manual_ig' : channel);
    const manualReason = humanAgentRequired && !humanAgentReady
        ? HUMAN_AGENT_NOT_APPROVED_MESSAGE
        : (isDirectGraphManual ? 'Captured directly from Instagram Graph. Copy/send this in Instagram until direct Graph sending is connected.' : undefined);

    // Qualifier evaluation runs BEFORE draft generation so we can inject
    // the next funnel question into the AI prompt. The model weaves it
    // naturally into its reply as one smooth message instead of bolting
    // it on as a separate bubble.
    const qualifierCurrentMessage = replaceIgMediaMarkers(
        sanitizeIgStoryReplyContextText(messageText),
        { photo: '[photo]', audio: '[voice note]', video: '[video]' }
    );
    const meaningfulLeadReplyCount = countMeaningfulLeadReplies(history, qualifierCurrentMessage);
    const qualifierEligible = isQualifierEligible({
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
    });
    let qualifier = thread.qualifier || null;
    let qualifierEvaluated = false;
    let qualifierError = null;
    let qualifierModel = null;
    const priorStage = qualifier?.stage || null;
    const priorFacts = qualifier?.facts ? { ...qualifier.facts } : {};
    const priorQualifier = qualifier;
    if (qualifierEligible) {
        try {
            const result = await evaluateQualifier({
                thread,
                history,
                currentMessage: qualifierCurrentMessage,
                draftText: '',
                leadName,
                channel,
            });
            qualifierError = result.error || null;
            qualifierModel = result.model || null;
            if (result.evaluated) {
                qualifier = result.qualifier;
                qualifierEvaluated = true;
                const persisted = await persistQualifier(thread.id, qualifier);
                if (!persisted) {
                    console.warn(`[ig-draft] qualifier persist failed for thread ${thread.id}`);
                }
                _notifyQualifierAdvance({
                    priorStage,
                    priorFacts,
                    nextQualifier: qualifier,
                    leadName,
                    channel,
                    coachId: thread.coach_id,
                    suppress: cocosAutoSendLane,
                });
            } else {
                qualifier = priorQualifier;
                console.warn('[ig-draft] qualifier skipped question injection:', result.error || 'evaluation_failed');
            }
        } catch (e) {
            qualifier = priorQualifier;
            qualifierError = e.message;
            console.warn('[ig-draft] qualifier evaluation failed:', e.message);
        }
    }

    const terminalQualifierStage = ['pitched', 'won'].includes(qualifier?.stage);
    const qualifierQuestion = (!terminalQualifierStage && qualifierEligible && qualifierEvaluated && qualifier?.is_question_moment && qualifier?.next_question)
        ? qualifier.next_question.trim()
        : null;

    let draft;
    try {
        draft = await generateDraft({
            leadName,
            leadBlock,
            profileBlock,
            memoryBlock,
            coachDayContextBlock,
            checkinThreadBlock,
            learningReelContextBlock,
            learningReelReplyAnchorBlock,
            nativeStoryOutreachContext,
            history,
            currentMessage: messageText,
            recentInboundMessages,
            leadStage: effectiveLeadStage,
            channel,
            igThreadId: thread.id,
            linkedUserId: thread.linked_user_id || null,
            priorScheduledDrafts,
            linkedNudges,
            recentWorkoutEvidence,
            weeklyAppContext,
            onboardingPhase,
            qualifier,
            qualifierQuestion,
            botAccount,
            coachId: thread.coach_id || null,
        });
    } catch (err) {
        console.error('[ig-draft] draft generation threw after stale-send cleanup:', err.message);
        draft = {
            chunks: [],
            joined: '',
            model: 'none',
            replyMode: 'standard',
            maxChunks: MAX_CHUNKS,
            error: `draft_generation_exception: ${String(err.message || err).slice(0, 240)}`,
            timeline: history.map(m => `${m.direction === 'in' ? leadName : 'Shannon'}: ${replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || ''))}`).join('\n'),
            currentTurnAnchorBlock: '',
            storyReplyPromptContextBlock: '',
            nativeStoryOutreachContextBlock: nativeStoryOutreachContext?.block || '',
            learningReelContextBlock,
            learningReelReplyAnchorBlock,
            learningReelEvidenceBlock,
        };
    }

    // Display-friendly version of the inbound — strips the giant raw
    // `[PHOTO:https://lookaside.fbsbx.com/...]` marker out of anything
    // user-facing (notification body, MessagingStyle bubble, admin
    // description) and replaces it with a clean "📷 photo" tag. The
    // actual URL stays stored in ig_messages.text and alert.data
    // .message_preview so we can still re-fetch / analyse it.
    const displaySourceMessage = sanitizeIgStoryReplyContextText(messageText);
    const displaySourceMessageKey = normalizedIgLeadMessageKey(displaySourceMessage);
    const displayMessage = replaceIgMediaMarkers(displaySourceMessage);
    const displayRecentInboundMessages = recentInboundMessages.map(m => {
        const rawText = String(m?.text || '').trim();
        return {
            ...m,
            storyReplyContext: isIgStoryReplyContextText(rawText),
            text: sanitizeIgStoryReplyContextText(rawText),
        };
    }).filter(m => {
        if (!m.text) return false;
        if (!m.storyReplyContext || !displaySourceMessageKey) return true;
        return normalizedIgLeadMessageKey(m.text) !== displaySourceMessageKey;
    });
    const displayHistory = history.filter(m => {
        if (!m || m.direction !== 'in' || !displaySourceMessageKey) return true;
        const rawText = String(m.text || '').trim();
        if (!isIgStoryReplyContextText(rawText)) return true;
        return normalizedIgLeadMessageKey(sanitizeIgStoryReplyContextText(rawText)) !== displaySourceMessageKey;
    });
    const inboundMessageBatch = formatInboundBatchForDisplay({
        recentInboundMessages: displayRecentInboundMessages,
        currentMessage: displaySourceMessage,
        currentCreatedAt: new Date().toISOString(),
    });
    const lastOutboundMessage = formatLastOutboundForDisplay({
        history,
        linkedNudges,
        linkedUserId: thread.linked_user_id,
        channel,
    });
    const isOnboardedOrPostFunnelForContext = ['in_app', 'paying', 'churned'].includes(effectiveLeadStage)
        || !!thread.linked_user_id;
    const firstCapturedLeadReply = !isOnboardedOrPostFunnelForContext
        && history.length === 0
        && linkedNudges.length === 0
        && priorScheduledDrafts.length === 0;
    const mediaReview = buildMediaReviewInfo({
        message_preview: displaySourceMessage,
        inbound_message_batch: inboundMessageBatch,
        image_url_count: draft.urlCount || 0,
        audio_url_count: draft.audioUrlCount || 0,
        video_url_count: draft.videoUrlCount || 0,
        media_decode: draft.mediaDecode || null,
    });
    const contextReview = buildContextReviewInfo({
        channel,
        ig_thread_id: thread.id,
        manychat_message_id: manychatMessageId || null,
        lead_stage: effectiveLeadStage,
        message_preview: displaySourceMessage,
        inbound_message_batch: inboundMessageBatch,
        recent_inbound_messages: displayRecentInboundMessages,
        last_outbound_message: lastOutboundMessage,
        learning_reels: learningReelHistory,
        first_captured_lead_reply: firstCapturedLeadReply,
        draft_evidence: {
            current_message: displayMessage,
            recent_timeline: draft.timeline || '',
            story_context: draft.storyReplyPromptContextBlock || '',
            learning_reel_context: draft.learningReelEvidenceBlock || draft.learningReelContextBlock || '',
        },
    });
    const proposedActions = detectProposedCoachActions({
        messageText: displayMessage,
        recentInboundMessages: displayRecentInboundMessages.map(m => ({
            text: replaceIgMediaMarkers(m.text || ''),
        })),
    });

    // Lifecycle stage drives the coloured dot on the push + alert card.
    // For IG/FB threads the userId is whatever app account the lead has
    // linked to (post-conversion); cold leads have no userId so we lean
    // on the thread's own lead_stage instead.
    const lifecycle = await resolveLifecycleStage({
        userId: thread.linked_user_id,
        leadStage: effectiveLeadStage,
    });
    let challengeOfferWarning = buildChallengeOfferWarning({ draftText: draft.joined, qualifier, currentMessage: displayMessage });
    const leadOnboardingHandoffData = buildLeadOnboardingHandoffData({
        draftText: draft.joined,
        qualifier,
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
        threadId: thread.id,
        manychatMessageId,
        currentMessage: displayMessage,
    });
    if (leadOnboardingHandoffData?.client_manager_review_required) {
        challengeOfferWarning = {
            ...(challengeOfferWarning || {}),
            required: true,
            code: 'signup_link_manager_review',
            dot: '!',
            label: 'signup link needs manager review',
            reason: leadOnboardingHandoffData.codex_review.reason,
            detected_at: new Date().toISOString(),
        };
    }

    const alertType = channel === 'messenger' ? 'fb_incoming_dm' : 'ig_incoming_dm';
    const channelLabel = channel === 'messenger' ? 'Messenger' : 'Instagram';
    const responseTimingProfile = await loadResponseTimingProfile({
        coachId: thread.coach_id,
        clientId: thread.linked_user_id || null,
        igThreadId: thread.id,
        alertType,
    });

    const alertRow = {
        // client_id stays NULL for cold ManyChat leads (no users.id yet).
        // Once the lead converts (ig_threads.linked_user_id set), it's
        // populated so client-centric admin views still find the alert.
        client_id: thread.linked_user_id || null,
        client_name: leadName,
        coach_id: thread.coach_id || null,
        alert_type: alertType,
        priority: 'high',
        title: `${leadName} just DM'd on ${channelLabel}`,
        description: `"${truncate(displayMessage, 200)}"`,
        suggested_message: draft.joined || null,
        status: 'pending',
        data: {
            client_manager_review_required: permanentNeedsYouClient || undefined,
            needs_you_required: permanentNeedsYouClient || undefined,
            operator_queue: permanentNeedsYouClient ? 'needs_you' : null,
            needs_you_reason: permanentNeedsYouClient ? 'always_needs_you_person' : undefined,
            needs_you_reasons: permanentNeedsYouClient ? ['always_needs_you_person'] : undefined,
            codex_review: permanentNeedsYouClient ? {
                source: 'balance-combined-dm-manager',
                decision: 'client_manager_review_required',
                queue: 'needs_you',
                needs_shannon_approval: true,
                reason: 'always_needs_you_person',
                evidence_ids: [
                    thread.id ? `ig_threads:${thread.id}` : '',
                    thread.linked_user_id ? `users:${thread.linked_user_id}` : '',
                ].filter(Boolean),
                reviewed_at: new Date().toISOString(),
                automation_id: 'balance-combined-dm-manager',
            } : undefined,
            channel,
            delivery_channel: deliveryChannel,
            manual_ig_required: isDirectGraphManual || undefined,
            manual_reason: manualReason,
            human_agent_required: humanAgentRequired || undefined,
            human_agent_approved: humanAgentRequired ? humanAgentReady : undefined,
            manual_ig_handle: isDirectGraphManual ? (thread.ig_username || null) : undefined,
            ig_graph_recipient_id: graphRecipientId || undefined,
            ig_graph_account_id: graphAccountId || undefined,
            instagram_graph: hasInstagramGraphRoute ? {
                ...cleanGraphData(thread.custom_data?.instagram_graph),
                ig_graph_user_id: graphRecipientId,
                ig_account_id: graphAccountId || cleanGraphData(thread.custom_data?.instagram_graph).ig_account_id || null,
                send_ready: true,
                human_agent_required: humanAgentRequired || undefined,
                human_agent_approved: humanAgentRequired ? true : undefined,
            } : undefined,
            subscriber_id: thread.subscriber_id,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || null,
            bot_account: botAccount || null,
            algorithm_scope: botAccount || 'balance_default',
            algorithm_fork: algorithmFork,
            profile_name: thread.profile_name || null,
            thread_display_name: threadDisplayName,
            linked_client_name: linkedClientName || null,
            display_name_source: linkedClientName ? 'linked_user' : 'ig_thread',
            lead_stage: effectiveLeadStage || thread.lead_stage || 'new',
            auto_send_enabled_at_draft: autoSendEnabled,
            auto_send_default_reason: cocosAutoSendLane ? 'cocos_auto_lane' : undefined,
            manychat_message_id: manychatMessageId || null,
            message_preview: truncate(displaySourceMessage, 400),
            last_outbound_message: lastOutboundMessage,
            learning_reels: learningReelHistory.length ? {
                recent: learningReelHistory,
                last_sent: learningReelHistory[0],
            } : null,
            proposed_actions: proposedActions,
            // Multi-message split — `draft_messages` is the array of chunks
            // we want to send as separate IG/Messenger bubbles. `draft_text`
            // is the joined version shown in the push notification (so
            // Shannon can review the whole reply at once). send-ig-reply
            // uses draft_messages when Shannon sends without editing; falls
            // back to single-message send when his edit invalidates the
            // chunk boundaries.
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || 'standard',
            draft_max_chunks: draft.maxChunks || MAX_CHUNKS,
            drafted_at: new Date().toISOString(),
            // Diagnostics so we can see from the DB why a draft failed
            // without needing Netlify function logs.
            draft_error: draft.error || null,
            empty_draft_recovery: draft.emptyDraftRecovery || null,
            image_url_count: draft.urlCount || 0,
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            video_url_count: draft.videoUrlCount || 0,
            video_inline_count: draft.videoCount || 0,
            media_decode: draft.mediaDecode || null,
            media_review: mediaReview.required ? mediaReview : null,
            context_review: contextReview.required ? contextReview : null,
            challenge_offer_warning: challengeOfferWarning,
            ...(leadOnboardingHandoffData || {}),
            first_captured_lead_reply: firstCapturedLeadReply,
            // Trailing inbound streak, same shape as instant-coach-draft.
            // Media in those prior messages gets rendered as clean labels.
            recent_inbound_messages: displayRecentInboundMessages.map(m => ({
                text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                created_at: m.created_at,
            })),
            inbound_message_batch: inboundMessageBatch,
            onboarding_phase: onboardingPhase || null,
            response_timing_profile: responseTimingProfile,
            checkin_thread_context: activeCheckinThread,
            draft_evidence: {
                source_mode: 'saved_at_draft',
                current_message: truncate(displayMessage, 400),
                prior_unanswered: displayRecentInboundMessages.map(m => ({
                    text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                    created_at: m.created_at,
                })),
                recent_workouts: truncate(recentWorkoutEvidence || '', 2000),
                recent_activity: truncate(weeklyAppContext || '', 3000),
                recent_timeline: truncateTail(draft.timeline || '', 4000),
                story_context: truncate(String(draft.storyReplyPromptContextBlock || '').trim(), 1400),
                native_story_context: truncate(String(draft.nativeStoryOutreachContextBlock || '').trim(), 1400),
                media_context: truncate(String(draft.mediaContextPromptBlock || '').trim(), 1800),
                learning_reel_context: truncate(String(draft.learningReelEvidenceBlock || draft.learningReelContextBlock || '').trim(), 1800),
                current_turn_anchor: truncate(String(draft.currentTurnAnchorBlock || '').trim(), 900),
                memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
                shannon_day_context: truncate(coachDayContextBlock.replace(/\n{3,}/g, '\n\n').trim(), 1600),
                checkin_thread_context: truncate(checkinThreadBlock.replace(/\n{3,}/g, '\n\n').trim(), 1800),
                cross_channel_context: linkedNudges.length
                    ? truncate(linkedNudges.slice(-12).map(m => {
                        const speaker = m.sender_id === thread.linked_user_id ? leadName : 'Shannon';
                        return `${speaker}: ${truncate(replaceIgMediaMarkers(m.message || ''), 240)}`;
                    }).join('\n'), 2000)
                    : '',
            },
            // Per-lead qualifier snapshot at the moment this alert was
            // produced — stage, warmth, suggested next question, and the
            // quote-grounded reason for the timing. The admin dashboard
            // alert card reads these to render the strategic strip
            // (stage badge / warmth / next-question / why-now). Null
            // for paying clients and leads outside the funnel window.
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : null,
            qualifier_evaluated: qualifierEvaluated,
            qualifier_error: qualifierError,
            qualifier_model: qualifierModel,
            lifecycle,
        },
    };
    let currentAlertData = alertRow.data;

    // Coalesce pending thread alerts: until Shannon actually sends/dismisses
    // the DM alert, every new inbound belongs on the same review card. Using
    // a wider pending lookback avoids the "two tailored responses for the
    // same ManyChat burst" failure when the webhook, draft worker, and
    // reconcile backstop land a few seconds apart.
    const coalesceCutoffIso = new Date(Date.now() - PENDING_THREAD_COALESCE_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
    let existingPending = null;
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,client_id,data&data->>ig_thread_id=eq.${thread.id}&status=eq.pending&created_at=gte.${encodeURIComponent(coalesceCutoffIso)}&alert_type=in.(ig_incoming_dm,fb_incoming_dm)&order=created_at.desc&limit=1`
        );
        existingPending = rows[0] || null;
    } catch (e) { /* non-critical, fall through to insert */ }

    let alertId = null;
    let coalesced = false;
    let dedupedAlert = false;
    if (existingPending) {
        const previousCount = (existingPending.data && existingPending.data.coalesced_count) || 1;
        const isBlankRegeneration = regenerateExistingBlankAlert?.id === existingPending.id;
        const newCount = isBlankRegeneration ? previousCount : previousCount + 1;
        const mergedData = {
            ...(existingPending.data || alertRow.data),
            message_preview: truncate(messageText, 400),
            last_outbound_message: lastOutboundMessage || existingPending.data?.last_outbound_message || null,
            learning_reels: learningReelHistory.length ? {
                recent: learningReelHistory,
                last_sent: learningReelHistory[0],
            } : (existingPending.data?.learning_reels || null),
            proposed_actions: mergeProposedActions(existingPending.data?.proposed_actions, proposedActions),
            manychat_message_id: manychatMessageId || (existingPending.data && existingPending.data.manychat_message_id) || null,
            lead_stage: effectiveLeadStage || thread.lead_stage || existingPending.data?.lead_stage || 'new',
            channel,
            delivery_channel: deliveryChannel,
            manual_ig_required: isDirectGraphManual || undefined,
            manual_reason: manualReason,
            human_agent_required: humanAgentRequired || undefined,
            human_agent_approved: humanAgentRequired ? humanAgentReady : undefined,
            manual_ig_handle: isDirectGraphManual ? (thread.ig_username || null) : undefined,
            ig_graph_recipient_id: graphRecipientId || existingPending.data?.ig_graph_recipient_id || undefined,
            ig_graph_account_id: graphAccountId || existingPending.data?.ig_graph_account_id || undefined,
            instagram_graph: hasInstagramGraphRoute ? {
                ...cleanGraphData(existingPending.data?.instagram_graph),
                ...cleanGraphData(thread.custom_data?.instagram_graph),
                ig_graph_user_id: graphRecipientId,
                ig_account_id: graphAccountId || cleanGraphData(thread.custom_data?.instagram_graph).ig_account_id || null,
                send_ready: true,
                human_agent_required: humanAgentRequired || undefined,
                human_agent_approved: humanAgentRequired ? true : undefined,
            } : undefined,
            subscriber_id: thread.subscriber_id,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || null,
            bot_account: botAccount || existingPending.data?.bot_account || null,
            algorithm_scope: botAccount || existingPending.data?.algorithm_scope || 'balance_default',
            algorithm_fork: algorithmFork,
            auto_send_enabled_at_draft: autoSendEnabled,
            auto_send_default_reason: cocosAutoSendLane ? 'cocos_auto_lane' : existingPending.data?.auto_send_default_reason,
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || 'standard',
            draft_max_chunks: draft.maxChunks || MAX_CHUNKS,
            drafted_at: new Date().toISOString(),
            coalesced_count: newCount,
            draft_error: draft.error || null,
            empty_draft_recovery: draft.emptyDraftRecovery || null,
            image_url_count: draft.urlCount || 0,
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            video_url_count: draft.videoUrlCount || 0,
            video_inline_count: draft.videoCount || 0,
            media_decode: draft.mediaDecode || existingPending.data?.media_decode || null,
            media_review: mediaReview.required
                ? mediaReview
                : (existingPending.data?.media_review || null),
            context_review: contextReview.required
                ? contextReview
                : (existingPending.data?.context_review || null),
            challenge_offer_warning: challengeOfferWarning,
            ...(leadOnboardingHandoffData || {}),
            first_captured_lead_reply: firstCapturedLeadReply || !!existingPending.data?.first_captured_lead_reply,
            // Refresh on every coalesce — `history` already includes every
            // unanswered inbound up to (but excluding) the current one, so
            // the saved streak grows naturally as messages roll in.
            recent_inbound_messages: displayRecentInboundMessages.map(m => ({
                text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                created_at: m.created_at,
            })),
            inbound_message_batch: inboundMessageBatch,
            onboarding_phase: onboardingPhase || null,
            response_timing_profile: responseTimingProfile,
            checkin_thread_context: activeCheckinThread || existingPending.data?.checkin_thread_context || null,
            draft_evidence: {
                source_mode: 'saved_at_draft',
                current_message: truncate(displayMessage, 400),
                prior_unanswered: displayRecentInboundMessages.map(m => ({
                    text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                    created_at: m.created_at,
                })),
                recent_workouts: truncate(recentWorkoutEvidence || '', 2000),
                recent_activity: truncate(weeklyAppContext || '', 3000),
                recent_timeline: truncateTail(draft.timeline || '', 4000),
                current_turn_anchor: truncate(String(draft.currentTurnAnchorBlock || '').trim(), 900),
                learning_reel_context: truncate(String(draft.learningReelEvidenceBlock || draft.learningReelContextBlock || '').trim(), 1800),
                memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
                checkin_thread_context: truncate(checkinThreadBlock.replace(/\n{3,}/g, '\n\n').trim(), 1800),
                cross_channel_context: linkedNudges.length
                    ? truncate(linkedNudges.slice(-12).map(m => {
                        const speaker = m.sender_id === thread.linked_user_id ? leadName : 'Shannon';
                        return `${speaker}: ${truncate(replaceIgMediaMarkers(m.message || ''), 240)}`;
                    }).join('\n'), 2000)
                    : '',
            },
            // Refresh the qualifier snapshot so the alert card reflects
            // the latest stage/warmth/question after every coalesced
            // message. The full qualifier object also lives on
            // ig_threads.qualifier (single source of truth); this is
            // just the per-alert snapshot for the admin feed.
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : (existingPending.data?.qualifier || null),
            qualifier_evaluated: qualifierEvaluated,
            qualifier_error: qualifierError,
            qualifier_model: qualifierModel,
            lifecycle,
        };
        currentAlertData = mergedData;
        const coalescedSuggestion = draft.joined || null;
        try {
            await supabaseQuery(`coach_alerts?id=eq.${existingPending.id}`, {
                method: 'PATCH',
                body: {
                    client_id: thread.linked_user_id || existingPending.client_id || null,
                    suggested_message: coalescedSuggestion,
                    description: isBlankRegeneration
                        ? alertRow.description
                        : `"${truncate(displayMessage, 200)}" (+${newCount - 1} earlier)`,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            alertId = existingPending.id;
            coalesced = true;
            console.log(`[ig-draft] coalesced into alert ${alertId} (count=${newCount})`);
        } catch (err) {
            console.warn('[ig-draft] coalesce PATCH failed, falling back to insert:', err.message);
            currentAlertData = alertRow.data;
            existingPending = null; // force the insert path below
        }
    }

    if (!existingPending) {
        try {
            const result = await insertCoachAlert(alertRow, idempotencyKey);
            alertId = result.alertId;
            if (result.deduped) {
                dedupedAlert = true;
                if (!autoSendEnabled) {
                    return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: alertId }) };
                }
                console.warn(`[ig-draft] duplicate alert ${alertId}, resuming auto-send handling if still pending`);
            }
        } catch (err) {
            console.error('[ig-draft] alert insert failed:', err.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
        }
    }

    if (alertId && draft.joined && draft.shadowDraftInput) {
        fireCoachDraftShadow({
            alertId,
            alertType,
            primaryDraftText: draft.joined,
            primaryModel: draft.model,
            samplingKey: `${alertType}:${manychatMessageId || thread.id}:${displaySourceMessageKey || displayMessage}`,
            ...draft.shadowDraftInput,
        });
    }

    let draftReview = null;
    let effectiveContextReview = contextReview;
    if (alertId && draft.joined) {
        const priorCount = Array.isArray(displayRecentInboundMessages) ? displayRecentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${leadName}:\n${displayRecentInboundMessages.map(m => `- "${truncate(replaceIgMediaMarkers(m.text || ''), 200)}"`).join('\n')}`
            : '';
        const reviewLatestMessage = replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(displayMessage || ''));
        const reviewLatestForPrompt = reviewLatestMessage.length > 1200
            ? `${truncate(reviewLatestMessage, 850)}\n[latest message ending]: ${truncateTail(reviewLatestMessage, 600)}`
            : reviewLatestMessage;
        const timelineText = displayHistory.length
            ? `\nRecent timestamped ${channelLabel} timeline (newest line is last; older lines are background):\n${truncateTail(displayHistory.slice(-12).map(m => {
                const speaker = m.direction === 'in' ? leadName : 'Shannon';
                return `${speaker} [${formatCoachLocalTimestamp(m.created_at)}]: ${replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || ''))}`;
            }).join('\n'), 2400)}`
            : '';
        const workoutText = recentWorkoutEvidence
            ? `\nExact recent workout logs:\n${truncate(recentWorkoutEvidence, 1200)}`
            : '';
        const memoryText = memoryBlock
            ? `\nMemory/context used:\n${truncate(memoryBlock, 1200)}`
            : '';
        const crossChannelText = linkedNudges.length
            ? `\nRecent in-app messages:\n${truncate(linkedNudges.slice(-8).map(m => {
                const speaker = m.sender_id === thread.linked_user_id ? leadName : 'Shannon';
                return `${speaker}: ${replaceIgMediaMarkers(m.message || '')}`;
            }).join('\n'), 1200)}`
            : '';
        const learningReelReviewText = draft.learningReelEvidenceBlock || learningReelEvidenceBlock || draft.learningReelContextBlock || '';
        const learningReelReviewContext = learningReelReviewText
            ? `\nRecent sent learning reel context:\n${truncate(learningReelReviewText, 1800)}`
            : '';
        const reviewContextBlocks = `LATEST just-arrived ${channelLabel} message from ${leadName} (this is the message the draft must answer): "${reviewLatestForPrompt}"${priorText}${timelineText}${workoutText}${memoryText}${crossChannelText}${learningReelReviewContext}`;
        const reviewTimeoutMs = cocosAutoSendLane ? COCOS_DRAFT_REVIEW_TIMEOUT_MS : IG_DRAFT_REVIEW_TIMEOUT_MS;
        try {
            const reviewResult = await withTimeout(reviewDraftAndUpdateAlert({
                alertId,
                draftText: draft.joined,
                alertType,
                contextBlocks: reviewContextBlocks,
                clientName: leadName,
                channelLabel,
                existingContextReview: contextReview,
            }), reviewTimeoutMs, 'draft review');
            draftReview = reviewResult?.review || null;
            effectiveContextReview = reviewResult?.contextReview || contextReview;
        } catch (err) {
            console.warn('[ig-draft] draft review failed:', err.message);
            const reviewSummary = 'AI draft review did not finish before auto-send scheduling.';
            draftReview = {
                verdict: 'warn',
                confidence: 0,
                summary: reviewSummary,
                issues: ['review_timeout'],
                suggested_fix: 'Open the source DM before sending.',
                context_loss_suspected: false,
                notification_required: true,
                notification_reason: 'review_timeout',
                reviewed_at: new Date().toISOString(),
                reviewer_model: 'gemini-draft-context-review',
            };
            effectiveContextReview = {
                ...(contextReview || {}),
                required: true,
                reasons: [
                    ...new Set([
                        ...((Array.isArray(contextReview?.reasons) ? contextReview.reasons : [contextReview?.reason]).filter(Boolean).map(String)),
                        'draft_review_timeout',
                    ]),
                ],
                label: reviewSummary,
                warning: 'Warning: AI draft review did not finish. Open the source DM before sending.',
                draft_review_verdict: draftReview.verdict,
                draft_review_summary: reviewSummary,
            };
        }
        const repairIssues = collectCocosAutoRepairIssues({
            draft,
            draftReview,
            challengeOfferWarning,
            currentMessage: displayMessage,
            qualifier,
            leadStage: effectiveLeadStage,
            linkedUserId: thread.linked_user_id,
            meaningfulLeadReplyCount,
        });
        if (shouldAttemptCocosDraftRepair({
            cocosAutoSendLane,
            mediaReview,
            baseContextReview: contextReview,
            draft,
            repairIssues,
        })) {
            const originalDraftText = draft.joined;
            const beforeReview = draftReview ? {
                verdict: draftReview.verdict || null,
                confidence: draftReview.confidence ?? null,
                summary: draftReview.summary || null,
                notification_reason: draftReview.notification_reason || null,
            } : null;
            try {
                const repaired = await withTimeout(repairCocosDraftFromReview({
                    draft,
                    repairIssues,
                    reviewContextBlocks,
                    leadName,
                    channelLabel,
                    maxChunks: draft.maxChunks || MAX_CHUNKS,
                }), COCOS_DRAFT_REPAIR_TIMEOUT_MS, 'Coco draft repair');
                if (repaired?.joined) {
                    const repairedReviewResult = await withTimeout(reviewDraftAndUpdateAlert({
                        alertId,
                        draftText: repaired.joined,
                        alertType,
                        contextBlocks: reviewContextBlocks,
                        clientName: leadName,
                        channelLabel,
                        existingContextReview: contextReview,
                    }), IG_DRAFT_REVIEW_TIMEOUT_MS, 'Coco repaired draft review');
                    const repairedReview = repairedReviewResult?.review || null;
                    const acceptRepair = !!repairedReview;
                    if (acceptRepair) {
                        const baseModel = String(draft.model || 'unknown').replace(/\+cocos-repair$/, '');
                        draft = {
                            ...draft,
                            chunks: repaired.chunks,
                            joined: repaired.joined,
                            model: `${baseModel}+cocos-repair`,
                            shadowDraftInput: null,
                        };
                        draftReview = repairedReview;
                        effectiveContextReview = repairedReviewResult?.contextReview || contextReview;
                        challengeOfferWarning = buildChallengeOfferWarning({ draftText: draft.joined, qualifier, currentMessage: displayMessage });
                        const repairMeta = {
                            status: 'accepted',
                            repaired_at: new Date().toISOString(),
                            issues: repairIssues,
                            original_draft_text: truncate(originalDraftText, 1200),
                            before_review: beforeReview,
                            after_review: {
                                verdict: draftReview.verdict || null,
                                confidence: draftReview.confidence ?? null,
                                summary: draftReview.summary || null,
                                notification_reason: draftReview.notification_reason || null,
                            },
                        };
                        currentAlertData = await persistCocosDraftRepair({
                            alertId,
                            currentAlertData: {
                                ...(currentAlertData || {}),
                                draft_review: draftReview,
                                context_review: effectiveContextReview?.required ? effectiveContextReview : null,
                            },
                            draft,
                            repairMeta,
                            challengeOfferWarning,
                        });
                        console.log(`[ig-draft] Coco auto draft repaired and rechecked for alert ${alertId}: ${draftReview.verdict}`);
                    } else {
                        currentAlertData = await persistCocosDraftRepair({
                            alertId,
                            currentAlertData: {
                                ...(currentAlertData || {}),
                                cocos_auto_repair: {
                                    status: 'rejected',
                                    attempted_at: new Date().toISOString(),
                                    issues: repairIssues,
                                    before_review: beforeReview,
                                    after_review: repairedReview ? {
                                        verdict: repairedReview.verdict || null,
                                        confidence: repairedReview.confidence ?? null,
                                        summary: repairedReview.summary || null,
                                        notification_reason: repairedReview.notification_reason || null,
                                    } : null,
                                },
                            },
                            draft,
                            repairMeta: {
                                status: 'rejected',
                                attempted_at: new Date().toISOString(),
                                issues: repairIssues,
                                before_review: beforeReview,
                                after_review: repairedReview ? {
                                    verdict: repairedReview.verdict || null,
                                    confidence: repairedReview.confidence ?? null,
                                    summary: repairedReview.summary || null,
                                    notification_reason: repairedReview.notification_reason || null,
                                } : null,
                            },
                            challengeOfferWarning,
                        });
                    }
                }
            } catch (err) {
                console.warn('[ig-draft] Coco draft repair failed:', err.message);
                currentAlertData = await persistCocosDraftRepair({
                    alertId,
                    currentAlertData: {
                        ...(currentAlertData || {}),
                        cocos_auto_repair: {
                            status: 'failed',
                            attempted_at: new Date().toISOString(),
                            issues: repairIssues,
                            error: truncate(err.message || String(err), 260),
                            before_review: beforeReview,
                        },
                    },
                    draft,
                    repairMeta: {
                        status: 'failed',
                        attempted_at: new Date().toISOString(),
                        issues: repairIssues,
                        error: truncate(err.message || String(err), 260),
                        before_review: beforeReview,
                    },
                    challengeOfferWarning,
                });
            }
        }
        currentAlertData = {
            ...(currentAlertData || {}),
            draft_review: draftReview || undefined,
            context_review: effectiveContextReview?.required
                ? effectiveContextReview
                : null,
        };
        await sendContextCheckNotification({
            adminId: thread.coach_id,
            alertId,
            leadName,
            clientId: thread.linked_user_id || thread.subscriber_id,
            channel,
            draftReview,
            contextReview: effectiveContextReview,
            suppress: cocosAutoSendLane,
        });
    }

    // Direct auto-DM path is only for isolated test lanes. Balance IG/FB
    // replies must first pass through the Codex lead/client manager, which
    // stamps codex_review; the scheduled worker promotes only those approved
    // rows into the auto lane.
    let autoHandled = false;
    const blockedStage = ['churned'].includes(effectiveLeadStage);
    const balanceAutoSendLane = false;
    const cocosContextBypass = getCocosAutoContextBypass({
        cocosAutoSendLane,
        contextReview: effectiveContextReview,
        draft,
        draftReview,
        currentMessage: displayMessage,
    });
    const balanceContextBypass = getBalanceAutoContextBypass({
        balanceAutoSendLane,
        contextReview: effectiveContextReview,
        draft,
        draftReview,
        currentMessage: displayMessage,
    });
    const autoContextBypass = cocosContextBypass || balanceContextBypass;
    if (autoContextBypass?.allowed) {
        currentAlertData = {
            ...(currentAlertData || {}),
            auto_send_context_bypass: {
                ...autoContextBypass,
                allowed_at: new Date().toISOString(),
            },
        };
    }
    let autoHoldReason = autoSendEnabled
        ? getAutoDmHoldReason({
            mediaReview,
            contextReview: effectiveContextReview,
            onboardingPhase,
            draft,
            draftReview,
            challengeOfferWarning,
            currentMessage: displayMessage,
            qualifier,
            leadStage: effectiveLeadStage,
            linkedUserId: thread.linked_user_id,
            meaningfulLeadReplyCount,
            contextBypass: autoContextBypass,
        })
        : null;
    if (!autoHoldReason && autoSendEnabled && blockedStage) {
        autoHoldReason = {
            code: 'blocked_stage',
            label: 'lead is churned',
        };
    }
    if (!autoHoldReason && autoSendEnabled && isDirectGraphManual) {
        autoHoldReason = {
            code: 'manual_ig',
            label: manualReason || 'manual Instagram send required',
        };
    }
    if (autoHoldReason) {
        currentAlertData = await stampIgAutoSendHoldForReview({
            thread,
            alertId,
            alertData: currentAlertData,
            reason: autoHoldReason,
        }) || currentAlertData;
        console.warn(`[ig-draft] auto-send held for thread ${thread.id}: ${autoHoldReason.code}`);
    } else if (autoSendEnabled && currentAlertData?.auto_send_review_hold) {
        currentAlertData = await clearIgAutoSendHoldForCurrentDraft({
            alertId,
            alertData: currentAlertData,
            reason: autoContextBypass?.allowed ? 'soft_context_bypass_passed_review' : 'refreshed_draft_passed_review',
        }) || currentAlertData;
    }

    const igAutoSendAllowedForDelay = autoSendEnabled
        && !isDirectGraphManual
        && !autoHoldReason
        && !blockedStage
        && ['instagram', 'messenger'].includes(channel);
    if (autoSendEnabled && blockedStage) {
        console.warn(`[ig-draft] auto-send blocked for churned thread ${thread.id}`);
    }
    if (igAutoSendAllowedForDelay && alertId && draft.joined) {
        const timingSuggestion = buildIgAutoTimingSuggestion({
            id: alertId,
            status: 'pending',
            alert_type: alertType,
            priority: alertRow.priority,
            client_id: alertRow.client_id,
            description: alertRow.description,
            suggested_message: draft.joined,
            data: currentAlertData,
        }, draft.joined);
        try {
            const scheduleResult = await scheduleIgAutoReplyDirect({
                alertId,
                alertData: currentAlertData,
                replyText: draft.joined,
                timingSuggestion,
            });
            currentAlertData = scheduleResult.data || currentAlertData;
            autoHandled = true;
            if (scheduleResult.alreadyActioned) {
                console.log(`[ig-draft] auto alert ${alertId} already actioned before direct schedule`);
            } else {
                console.log(`[ig-draft] auto-scheduled alert ${alertId} for ${leadName} in ${scheduleResult.timing?.label || timingSuggestion.label}`);
            }
        } catch (e) {
            autoHoldReason = {
                code: 'schedule_error',
                label: 'auto schedule errored',
            };
            currentAlertData = await stampIgAutoSendHoldForReview({
                thread,
                alertId,
                alertData: currentAlertData,
                reason: autoHoldReason,
            }) || currentAlertData;
            console.warn('[ig-draft] auto schedule failed, falling back to approve-gate:', e.message);
        }
    }
    if (!autoHandled && balanceAutoSendCandidate && !cocosAutoSendLane) {
        console.log(`[ig-draft] Balance auto-send deferred to Codex manager review for thread ${thread.id}`);
    }

    // Auto DMs now always schedule through schedule-coach-reply.
    // Auto-send path: only converted IG/FB threads can bypass the approve
    // gate. Cold leads still need Shannon's approval even if a stale admin
    // toggle was left on.
    let autoSent = autoHandled;
    const igAutoSendAllowed = !!thread.linked_user_id
        && ['in_app', 'paying'].includes(effectiveLeadStage);
    if (!autoHandled && autoSendEnabled && !igAutoSendAllowed) {
        console.warn(`[ig-draft] auto-send blocked for cold/non-converted thread ${thread.id}`);
    }
    if (!autoHandled && autoSendEnabled && igAutoSendAllowed && mediaReview.required) {
        console.warn(`[ig-draft] auto-send blocked for media-review thread ${thread.id}`);
    }
    if (!autoHandled && autoSendEnabled && igAutoSendAllowed && effectiveContextReview.required) {
        console.warn(`[ig-draft] auto-send blocked for context-review thread ${thread.id}`);
    }
    if (false && autoSendEnabled && igAutoSendAllowed && !mediaReview.required && !effectiveContextReview.required && alertId && draft.joined) {
        try {
            const replyFn = 'send-ig-reply';
            const res = await fetch(`${SITE_URL}/.netlify/functions/${replyFn}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    alertId,
                    replyText: draft.joined,
                    draftText: draft.joined,
                    source: 'auto_send',
                }),
            });
            if (res.ok) {
                autoSent = true;
                console.log(`[ig-draft] auto-sent alert ${alertId} for ${leadName}`);
                // FYI push so Shannon knows what went out
                fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipientId: thread.coach_id,
                        senderName: `📤 Auto-sent → ${leadName}`,
                        messageText: truncate(draft.joined, 160),
                        type: 'auto_sent_confirmation',
                        sourceChannel: channel,
                    }),
                }).catch(e => console.warn('[ig-draft] auto-send confirmation push failed:', e.message));
            } else {
                console.warn(`[ig-draft] auto-send ${replyFn} returned ${res.status}, falling back to approve-gate`);
            }
        } catch (e) {
            console.warn('[ig-draft] auto-send failed, falling back to approve-gate:', e.message);
        }
    }

    const shouldSendDraftPush = !cocosAutoSendLane || !!autoHoldReason;
    if (!autoSent && shouldSendDraftPush) {
        await sendDraftReadyPush({
            adminId: thread.coach_id,
            alertId,
            leadName,
            leadMessage: displayMessage,
            draftText: draft.joined,
            clientId: thread.linked_user_id || thread.subscriber_id,
            channel,
            recentInboundMessages: displayRecentInboundMessages,
            qualifier: (qualifierEligible && qualifierEvaluated) ? qualifier : null,
            qualifierEligible,
            lifecycle,
            mediaReview,
            contextReview: effectiveContextReview,
            autoHoldReason,
            challengeOfferWarning,
        });
    } else if (!autoSent && cocosAutoSendLane) {
        console.log(`[ig-draft] suppressed normal Coco's push for alert ${alertId}; dashboard still tracks the DM`);
    }

    // For qualifier-eligible leads, qualifier.why_now ALREADY explains the
    // strategic timing — surfacing a second generic reasoning on top would
    // just dilute that signal. Skip those alerts; everything else (warm
    // already-converted leads with no qualifier) gets the generic pass.
    if (alertId && draft.joined && !qualifierEligible) {
        const priorCount = Array.isArray(displayRecentInboundMessages) ? displayRecentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${leadName}:\n${displayRecentInboundMessages.map(m => `- "${truncate(replaceIgMediaMarkers(m.text || ''), 200)}"`).join('\n')}`
            : '';
        const workoutText = recentWorkoutEvidence
            ? `\nExact recent workout logs:\n${truncate(recentWorkoutEvidence, 1200)}`
            : '';
        const memoryText = memoryBlock
            ? `\nMemory/context used:\n${truncate(memoryBlock, 1200)}`
            : '';
        const timelineText = displayHistory.length
            ? `\nRecent timestamped ${channelLabel} timeline:\n${truncate(displayHistory.slice(-20).map(m => {
                const speaker = m.direction === 'in' ? leadName : 'Shannon';
                return `${speaker} [${formatCoachLocalTimestamp(m.created_at)}]: ${replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || ''))}`;
            }).join('\n'), 1600)}`
            : '';
        const crossChannelText = linkedNudges.length
            ? `\nRecent in-app messages:\n${truncate(linkedNudges.slice(-8).map(m => {
                const speaker = m.sender_id === thread.linked_user_id ? leadName : 'Shannon';
                return `${speaker}: ${replaceIgMediaMarkers(m.message || '')}`;
            }).join('\n'), 1200)}`
            : '';
        const learningReelReasoningText = draft.learningReelEvidenceBlock || learningReelEvidenceBlock || draft.learningReelContextBlock || '';
        const learningReelReasoningContext = learningReelReasoningText
            ? `\nRecent sent learning reel context:\n${truncate(learningReelReasoningText, 1400)}`
            : '';
        const contextBlocks = `Just-arrived ${channelLabel} message from ${leadName}: "${truncate(displayMessage, 400)}"${priorText}${timelineText}${workoutText}${memoryText}${crossChannelText}${learningReelReasoningContext}`;
        fireDraftReasoning({
            alertId,
            draftText: draft.joined,
            alertType,
            contextBlocks,
            clientName: leadName,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draft.model,
            draft_generated: !!draft.joined,
            chunk_count: draft.chunks.length,
            coalesced,
            deduped: dedupedAlert,
            draft_review_verdict: draftReview?.verdict || null,
            context_review_required: !!effectiveContextReview?.required,
        }),
    };
};

exports._test = {
    isIgStoryReplyContextText,
    sanitizeIgStoryReplyContextText,
    stripObviousMediaReceiptPreamble,
    buildNativeStoryOutreachContextBlock,
    isSalesAcquisitionThread,
    buildAcquisitionStyleBlock,
    buildAcquisitionMomentumBlock,
    suppressAlreadyKnownContextQuestionsInDraftChunks,
    suppressPetSpeciesGuessingInDraftChunks,
    suppressStoryLocationQuestionsInDraftChunks,
    hasKnownStoryLocationContext,
    getCocosAutoContextBypass,
    getBalanceAutoContextBypass,
    getAutoDmHoldReason,
    collectCocosAutoRepairIssues,
    shouldAttemptCocosDraftRepair,
    normalizeCocosRepairedDraft,
    reviewLooksLikePureContextGap,
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
    finalizeDraftChunksFromRawText,
    repairMissingChallengeBioLinkChunks,
    buildChallengeNextStepBlock,
    buildEmptyMediaDraftFallbackChunks,
};
