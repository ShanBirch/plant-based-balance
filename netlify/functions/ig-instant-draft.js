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
 *   - IG/FB auto-send is opt-in per thread. Normal replies schedule through
 *     the delayed worker; clean paid-Meta replies dispatch immediately after
 *     the alert is atomically claimed so ad conversations stay responsive.
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
    isClientManagerAutoReplyEnabled,
    isClientManagerBrowserDispatchEnabled,
    isAlwaysNeedsYouPerson,
    isKayNeedsYouPerson,
    isProgramUpdateOrAppFixContext,
    getAppProblemAutoSendHoldReason,
    buildShannonDmTuningBlock,
    buildBalanceIdentityElicitationBlock,
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
    callOpenAITextModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    normalizeCoachDraftChunks,
    normalizeCoachDraftText,
    normalizeGeneratedCoachDraftText,
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
    META_APP_PREVIEW_URL,
    buildMetaAppPreviewUrl,
    isMetaAppPreviewUrl,
} = require('./_lib/meta-app-preview-ref');
const { buildExerciseLibrarySupportBlock } = require('./_lib/exercise-library-search');
const { resolveCoachDmManagerScheduledFor } = require('./_lib/coach-dm-working-hours');
const {
    ACQUISITION_MODES,
    resolveIgAcquisitionMode,
    isPaidMetaAcquisitionMode,
    buildAcquisitionModePromptBlock,
} = require('./_lib/ig-acquisition-mode');
const {
    resolveDmLanguageExperiment,
    measureDmLanguageShape,
} = require('./_lib/dm-language-contract');

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
    hasDirectBuyerIntent,
    hasChallengeInviteReadinessSignal,
    countMeaningfulLeadReplies,
    hasEarnedChallengeInviteMoment,
    isPrematureChallengeInvite,
    isUnrequestedOfferInjection,
    isChallengeOfferWarningText,
} = require('./_lib/qualifier-engine');
const {
    detectProposedCoachActions,
    mergeProposedActions,
} = require('./_lib/coach-actions');
const {
    isCocosToShanSunnyVoiceTest,
    inspectVoiceScriptQuality,
    resolveCocosShanSunnyVoiceTestReason,
    resolvePersonalVoiceReplyPlan,
    hasHighSignalGoalBlocker,
} = require('./_lib/elevenlabs-voice-message');
const { recordGrowthOutcome } = require('./_lib/growth-outcomes');
const {
    HEALTH_PROGRESSION_EVENT_TYPES,
    classifyHealthProgressionAnswer,
    progressionMilestones,
} = require('./_lib/lead-health-progression');
const { hasBusinessCallRequest } = require('./_lib/personal-dm-boundary');
const { markDraftAnalysis } = require('./_lib/ig-message-media');
const { buildRelationshipMemoryBlock } = require('./extract-ig-thread-memory');
const { sendInstagramGraphTypingAction } = require('./send-ig-reply');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const HISTORY_LIMIT = 40;
const CONVERSATION_EPISODE_HARD_GAP_MS = 72 * 60 * 60 * 1000;
const CONVERSATION_EPISODE_REOPEN_GAP_MS = 18 * 60 * 60 * 1000;
const STORY_EPISODE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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
const IG_FAST_LANE_DELAY_MS = 4 * 60 * 1000;
const IG_FAST_LANE_MIN_DELAY_MS = 2 * 60 * 1000;
// Paid Meta conversations are already commercial, active threads. Queue them
// as soon as generation and the safety/context review have passed, then claim
// and dispatch that exact alert without waiting for the per-minute cron tick.
const IG_META_AD_FAST_LANE_DELAY_MS = 0;
const IG_DIRECT_CHALLENGE_MIN_DELAY_MS = 0;
const IG_DRAFT_REVIEW_TIMEOUT_MS = 7000;
const IG_PAID_META_TYPING_REFRESH_MS = 4000;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';

function startPaidMetaTypingHeartbeat({ enabled, recipientId, accountId } = {}) {
    if (!enabled || !recipientId) return () => {};
    let stopped = false;
    let inFlight = false;
    const refresh = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
            await sendInstagramGraphTypingAction({
                recipientId,
                accountId,
                action: 'typing_on',
                beforeChunkIndex: 0,
                gapMs: 0,
            });
        } catch (error) {
            console.warn('[ig-draft] paid Meta typing heartbeat failed (non-fatal):', error.message);
        } finally {
            inFlight = false;
        }
    };
    const interval = setInterval(refresh, IG_PAID_META_TYPING_REFRESH_MS);
    interval.unref?.();
    const timeout = setTimeout(() => {
        stopped = true;
        clearInterval(interval);
    }, 45000);
    timeout.unref?.();
    return () => {
        stopped = true;
        clearInterval(interval);
        clearTimeout(timeout);
    };
}
const STORY_OPENER_CONFUSION_RE = /\b(?:i\s+(?:don'?t|do\s+not|didn'?t|did\s+not)\s+(?:understand|get)\s+(?:what\s+you\s+mean|your\s+question|this|that|it)|(?:what|wat)\s+(?:do|did)\s+(?:you|u)\s+mean|what\s+you\s+mean|wdym|i'?m\s+confused|not\s+sure\s+what\s+you\s+mean)\b/i;
const SHORT_STORY_OPENER_CONFUSION_RE = /^(?:sorry|sorry\?|huh\??|pardon\??|what\??|what sorry\??|sorry what\??)$/i;

function resolveIgFastLaneDelayMs({
    metaAdFastLane = false,
    voiceReplyTestLane = false,
    approvedCoachingLinkHandoff = false,
    exerciseConversationFastLane = false,
} = {}) {
    if (metaAdFastLane) return IG_META_AD_FAST_LANE_DELAY_MS;
    if (voiceReplyTestLane || approvedCoachingLinkHandoff || exerciseConversationFastLane) {
        return IG_FAST_LANE_DELAY_MS;
    }
    return undefined;
}

async function recordHealthProgressionAnswer({ thread, currentMessage, manychatMessageId, botAccount, acquisitionMode, offerFlowVariant }) {
    if (!thread?.id || thread.linked_user_id) return null;
    const recent = await supabaseQuery(
        `growth_outcome_events?select=id,event_key,event_type,occurred_at,attribution&ig_thread_id=eq.${encodeURIComponent(thread.id)}&event_type=in.(${HEALTH_PROGRESSION_EVENT_TYPES.attempted},${HEALTH_PROGRESSION_EVENT_TYPES.answered})&order=occurred_at.desc&limit=8`
    );
    const latestAttempt = recent.find(row => row.event_type === HEALTH_PROGRESSION_EVENT_TYPES.attempted);
    if (!latestAttempt) return null;
    const alreadyAnswered = recent.some(row => (
        row.event_type === HEALTH_PROGRESSION_EVENT_TYPES.answered
        && row.attribution?.attempt_event_id === latestAttempt.id
    ));
    if (alreadyAnswered) return null;

    const classification = classifyHealthProgressionAnswer(currentMessage, latestAttempt.attribution || {});
    if (!classification.is_answer) return null;
    return recordGrowthOutcome({
        eventType: HEALTH_PROGRESSION_EVENT_TYPES.answered,
        eventKey: `balance_dm_manager:${HEALTH_PROGRESSION_EVENT_TYPES.answered}:${latestAttempt.id}`,
        eventFamily: 'sales',
        sourceSystem: 'balance_dm_manager',
        botAccount: botAccount || 'shan_n_sunny',
        fromUsername: thread.ig_username,
        igThreadId: thread.id,
        eventStatus: 'lead_replied',
        occurredAt: new Date().toISOString(),
        score: 0,
        attribution: {
            attempt_event_id: latestAttempt.id,
            attempt_event_key: latestAttempt.event_key,
            attempt_topics: latestAttempt.attribution?.topics || [],
            answer_topics: classification.topics,
            answer_type: classification.answer_type,
            acquisition_mode: acquisitionMode || resolveIgAcquisitionMode({ customData: thread.custom_data }),
            offer_flow_variant: offerFlowVariant || null,
        },
        rawPayload: {
            inbound_message_id: manychatMessageId || null,
            inbound_evidence: classification.evidence,
        },
    }, supabaseQuery);
}

async function recordQualifierProgressionMilestones({ thread, priorQualifier, nextQualifier, botAccount, acquisitionMode, offerFlowVariant }) {
    if (!thread?.id || thread.linked_user_id) return [];
    const milestones = progressionMilestones(priorQualifier || {}, nextQualifier || {});
    if (!milestones.length) return [];
    return Promise.all(milestones.map(milestone => recordGrowthOutcome({
        eventType: milestone.type,
        eventKey: `ig_qualifier:${milestone.type}:${thread.id}`,
        eventFamily: 'sales',
        sourceSystem: 'ig_qualifier',
        botAccount: botAccount || 'shan_n_sunny',
        fromUsername: thread.ig_username,
        igThreadId: thread.id,
        eventStatus: 'identified',
        occurredAt: new Date().toISOString(),
        score: 0,
        attribution: {
            qualifier_stage: nextQualifier?.stage || null,
            commercial_stage: nextQualifier?.commercial_stage || null,
            acquisition_mode: acquisitionMode || resolveIgAcquisitionMode({ customData: thread.custom_data }),
            offer_flow_variant: offerFlowVariant || null,
        },
        rawPayload: { evidence: milestone.evidence },
    }, supabaseQuery)));
}

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

function cleanPromptString(value, max = 1000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeIgHandle(value) {
    return cleanPromptString(value, 160).replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
}

function isExerciseCommentContext(context = {}) {
    return /exercise|form|workout/i.test(String(context.source_lane || context.funnel || context.content_type || ''))
        || Boolean(context.exercise);
}

function isScienceCommentContext(context = {}) {
    return /science|study|paper|research/i.test(String(context.source_lane || context.funnel || context.topic || context.paper_title || ''));
}

function buildCommentResourceContextFromFulfillment(row = {}) {
    const rawPayload = safeObject(row.raw_payload);
    const leadContext = safeObject(rawPayload.lead_context);
    const automation = safeObject(rawPayload.automation);
    const sourcePost = safeObject(rawPayload.source_post);
    const sourceLane = cleanPromptString(
        leadContext.source_lane
        || sourcePost.source_lane
        || (sourcePost.exercise ? 'exercise_comment_flow' : '')
        || (sourcePost.paper_title || sourcePost.paper_authors ? 'science_comment_resource' : 'comment_resource'),
        120
    );
    const funnel = cleanPromptString(
        leadContext.funnel
        || sourcePost.funnel
        || (/exercise/i.test(sourceLane) ? 'exercise_form_fix' : '')
        || (/science|study|paper/i.test(sourceLane) ? 'free_challenge' : '')
        || 'comment_resource',
        120
    );
    const status = cleanPromptString(row.status || leadContext.status, 40);
    return {
        source_lane: sourceLane,
        funnel,
        link_sent: leadContext.link_sent === true || ['sent', 'dry_run'].includes(status) || Boolean(row.private_reply_id),
        link_sent_via: leadContext.link_sent_via || 'instagram_private_reply',
        status,
        fulfillment_id: row.id || leadContext.fulfillment_id || null,
        automation_id: row.automation_id || leadContext.automation_id || automation.id || null,
        post_slug: cleanPromptString(leadContext.post_slug || automation.post_slug || sourcePost.slug, 180) || null,
        post_title: cleanPromptString(leadContext.post_title || sourcePost.title, 240) || null,
        topic: cleanPromptString(leadContext.topic || sourcePost.topic, 240) || null,
        headline: cleanPromptString(leadContext.headline || sourcePost.headline, 240) || null,
        content_type: cleanPromptString(leadContext.content_type || sourcePost.content_type, 120) || null,
        exercise: cleanPromptString(leadContext.exercise || sourcePost.exercise, 180) || null,
        main_mistake: cleanPromptString(leadContext.main_mistake || sourcePost.main_mistake, 500) || null,
        context_summary: cleanPromptString(leadContext.context_summary || sourcePost.context_summary, 900) || null,
        reply_guidance: cleanPromptString(leadContext.reply_guidance || sourcePost.reply_guidance, 1200) || null,
        suggested_next_question: cleanPromptString(leadContext.suggested_next_question || sourcePost.suggested_next_question, 300) || null,
        full_script: cleanPromptString(leadContext.full_script || sourcePost.full_script, 3000) || null,
        coaching_points: Array.isArray(leadContext.coaching_points)
            ? leadContext.coaching_points
            : (Array.isArray(sourcePost.coaching_points) ? sourcePost.coaching_points : []),
        paper_title: cleanPromptString(leadContext.paper_title || sourcePost.paper_title, 300) || null,
        paper_authors: cleanPromptString(leadContext.paper_authors || sourcePost.paper_authors, 240) || null,
        paper_year: leadContext.paper_year || sourcePost.paper_year || null,
        keyword: cleanPromptString(row.matched_keyword || leadContext.keyword || automation.keyword, 120) || null,
        landing_url: cleanPromptString(row.landing_url || leadContext.landing_url, 800) || null,
        private_reply_id: cleanPromptString(row.private_reply_id || leadContext.private_reply_id, 180) || null,
        private_reply_message: cleanPromptString(row.private_reply_message || leadContext.private_reply_message, 900) || null,
        ig_media_id: cleanPromptString(row.ig_media_id || leadContext.ig_media_id, 180) || null,
        comment_id: cleanPromptString(row.comment_id || leadContext.comment_id, 180) || null,
        from_ig_user_id: cleanPromptString(row.from_ig_user_id || leadContext.from_ig_user_id, 180) || null,
        from_username: normalizeIgHandle(row.from_username || leadContext.from_username),
        sent_at: row.sent_at || leadContext.sent_at || null,
        created_at: row.created_at || leadContext.recorded_at || null,
        next_step: cleanPromptString(leadContext.next_step || sourcePost.next_step, 600) || null,
    };
}

function buildCommentResourceHandoffBlock(context = {}) {
    if (!context || typeof context !== 'object' || !context.link_sent) return '';
    const topic = context.exercise || context.topic || context.headline || context.post_title || context.post_slug || 'the reel';
    const cueList = Array.isArray(context.coaching_points) && context.coaching_points.length
        ? context.coaching_points.map(point => `  - ${point}`).join('\n')
        : '';
    if (isExerciseCommentContext(context)) {
        return `

EXERCISE COMMENT-TO-DM HANDOFF:
- ${context.from_username ? `@${context.from_username}` : 'This lead'} recently commented "${context.keyword || 'the keyword'}" on Shannon's exercise reel about ${topic}.
- They have already been sent the private reply/checklist by IG private reply${context.sent_at ? ` at ${context.sent_at}` : ''}${context.landing_url ? `: ${context.landing_url}` : '.'}
- Do not ask what this is about if their reply is short or vague. Treat replies like "yes", "send it", "back", "hams", "balance", "form", or "what do you mean" as replies to this exercise comment flow.
- Continue the conversation from the reel topic. Do not reveal automation, tracking, source payloads, or that a comment-flow handoff exists.
${context.context_summary ? `- Reel context: ${context.context_summary}` : ''}
${context.main_mistake ? `- Main mistake Shannon was fixing: ${context.main_mistake}` : ''}
${cueList ? `- Coaching cues from the reel:\n${cueList}` : ''}
${context.reply_guidance ? `- Reply guidance: ${context.reply_guidance}` : ''}
${context.suggested_next_question ? `- Useful next question if they need help: ${context.suggested_next_question}` : ''}
${context.full_script ? `- Reel script context: ${truncate(context.full_script, 900)}` : ''}`;
    }
    if (!isScienceCommentContext(context)) {
        return `

COMMENT-TO-DM HANDOFF:
- ${context.from_username ? `@${context.from_username}` : 'This lead'} recently commented "${context.keyword || 'the keyword'}" on Shannon's reel about ${topic}.
- They have already been sent the private reply${context.sent_at ? ` at ${context.sent_at}` : ''}${context.landing_url ? `: ${context.landing_url}` : '.'}
- Do not ask what this is about if their reply is short or vague. Continue from this comment-flow context.
- Do not reveal automation, tracking, source payloads, or that a comment-flow handoff exists.
${context.context_summary ? `- Context: ${context.context_summary}` : ''}
${context.reply_guidance ? `- Reply guidance: ${context.reply_guidance}` : ''}
- Next step: ${context.next_step || 'Use the comment-flow context first, then continue naturally.'}`;
    }
    const paper = [context.paper_title, context.paper_year].filter(Boolean).join(', ');
    return `

SCIENCE COMMENT RESOURCE HANDOFF:
- ${context.from_username ? `@${context.from_username}` : 'This lead'} recently commented "${context.keyword || 'the keyword'}" on Shannon's science reel about ${topic}.
- They have already been sent the resource/study link by IG private reply${context.sent_at ? ` at ${context.sent_at}` : ''}: ${context.landing_url || '(link not stored)'}.
- Do not ask if they want the resource link again unless they say they did not get it. If they ask for the study/resource, acknowledge it was sent and resend the same link only if useful.
- Treat this as a normal Plant-Based Fitness Founders Pass DM path now, but their first intent was education/trust, not automatic signup.
- If they reply with thanks, curiosity, or a question about the paper, answer the science point briefly and ask one practical bridge question about training, food, weight loss, consistency, or the behaviour the reel discussed.
${paper ? `- Paper/resource: ${paper}.` : ''}
${context.context_summary ? `- Context: ${context.context_summary}` : ''}
- Next step: ${context.next_step || 'Use the resource topic as context, then continue the normal Plant-Based Fitness Founders Pass DM path when they show help/start intent.'}`;
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

function normalizeIgAutoTimingSuggestion({ timingSuggestion, delayMs, timingLabel, fastLaneDelayMs = null }) {
    const requestedFastLaneDelayMs = Number(fastLaneDelayMs);
    const directChallengeDelayMs = timingSuggestion?.signals?.direct_challenge_question === true
        ? Number(timingSuggestion?.delay_ms)
        : NaN;
    const activeExchangeDelayMs = timingSuggestion?.signals?.active_back_and_forth === true
        ? Number(timingSuggestion?.delay_ms)
        : NaN;
    const liveFitnessHelpDelayMs = timingSuggestion?.signals?.live_fitness_help_intent === true
        ? Number(timingSuggestion?.delay_ms)
        : NaN;
    const hasExplicitFastLaneDelay = fastLaneDelayMs !== null
        && fastLaneDelayMs !== undefined
        && fastLaneDelayMs !== '';
    const useExplicitFastLane = hasExplicitFastLaneDelay
        && Number.isFinite(requestedFastLaneDelayMs)
        && requestedFastLaneDelayMs >= 0;
    const useActiveExchangeFastLane = Number.isFinite(activeExchangeDelayMs) && activeExchangeDelayMs > 0;
    const useLiveFitnessHelpFastLane = Number.isFinite(liveFitnessHelpDelayMs) && liveFitnessHelpDelayMs > 0;
    const useDirectChallengeLane = timingSuggestion?.signals?.direct_challenge_question === true
        && Number.isFinite(directChallengeDelayMs)
        && directChallengeDelayMs >= 0;
    const useFastLaneDelay = useDirectChallengeLane || useExplicitFastLane || useActiveExchangeFastLane || useLiveFitnessHelpFastLane;
    const rawDelay = useDirectChallengeLane
        ? directChallengeDelayMs
        : useFastLaneDelay
        ? (useExplicitFastLane
            ? requestedFastLaneDelayMs
            : (useActiveExchangeFastLane ? activeExchangeDelayMs : liveFitnessHelpDelayMs))
        : Number(timingSuggestion?.delay_ms ?? delayMs ?? IG_AUTO_SEND_DEFAULT_DELAY_MS);
    const minDelayMs = useDirectChallengeLane || (useExplicitFastLane && requestedFastLaneDelayMs === 0)
        ? IG_DIRECT_CHALLENGE_MIN_DELAY_MS
        : (useFastLaneDelay ? IG_FAST_LANE_MIN_DELAY_MS : IG_AUTO_SEND_MIN_DELAY_MS);
    const normalizedDelayMs = Number.isFinite(rawDelay)
        ? Math.min(IG_AUTO_SEND_MAX_DELAY_MS, Math.max(minDelayMs, Math.round(rawDelay)))
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

function shouldDispatchMetaAdReplyImmediately({ alertData, normalizedTiming, scheduleResolution } = {}) {
    const review = alertData?.draft_review || {};
    const safeSanitizedStyleWarning = alertData?.meta_ad_style_warning_safe_after_sanitize === true
        && isNonBlockingDraftStyleWarning(review);
    return alertData?.meta_ad_fast_lane === true
        && normalizedTiming?.action === 'send_now'
        && scheduleResolution?.deferredForWorkingHours !== true
        && (String(review.verdict || '').toLowerCase() === 'pass' || safeSanitizedStyleWarning)
        && review.notification_required !== true
        && review.context_loss_suspected !== true
        && !alertData?.auto_send_review_hold
        && alertData?.needs_you_required !== true
        && alertData?.needs_shannon_approval !== true;
}

function isCodexLivePaidMetaThread({ linkedUserId = null, customData = {}, acquisitionMode = '' } = {}) {
    return !linkedUserId
        && customData?.codex_live_chat_enabled !== false
        && isPaidMetaAcquisitionMode(acquisitionMode);
}

function hasImmediateMetaDispatchFailure(scheduleResult = {}) {
    return !!scheduleResult?.immediateDispatch
        && scheduleResult.immediateDispatch.ok !== true
        && scheduleResult.immediateDispatch.reason !== 'claim_lost';
}

async function dispatchScheduledMetaAdReplyNow({ alertId, scheduledFor, replyText }) {
    const claimedRows = await supabaseQuery(
        `coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.scheduled&scheduled_for=eq.${encodeURIComponent(scheduledFor)}`,
        {
            method: 'PATCH',
            body: { status: 'pending' },
            prefer: 'return=representation',
        }
    );
    if (!claimedRows?.[0]) {
        return { attempted: false, ok: false, reason: 'claim_lost' };
    }

    const response = await fetch(`${SITE_URL}/.netlify/functions/send-coach-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            alertId,
            replyTextUtf8Base64: Buffer.from(replyText, 'utf8').toString('base64'),
            draftTextUtf8Base64: Buffer.from(replyText, 'utf8').toString('base64'),
            source: 'scheduled_worker',
        }),
    });
    const responseText = await response.text();
    if (!response.ok) {
        console.error(`[ig-draft] immediate Meta ad dispatch ${response.status} for ${alertId}: ${responseText.slice(0, 240)}`);
        return { attempted: true, ok: false, status: response.status };
    }
    return { attempted: true, ok: true, status: response.status };
}

async function scheduleIgAutoReplyDirect({ alertId, alertData, replyText, delayMs, timingLabel, timingSuggestion }) {
    if (!alertId || !replyText) throw new Error('missing alertId or replyText');
    const normalizedTiming = normalizeIgAutoTimingSuggestion({
        timingSuggestion,
        delayMs,
        timingLabel,
        fastLaneDelayMs: alertData?.auto_send_fast_lane_delay_ms,
    });
    const scheduledAt = new Date();
    const scheduleResolution = resolveCoachDmManagerScheduledFor(scheduledAt, normalizedTiming.delay_ms);
    const scheduledFor = scheduleResolution.scheduledFor;
    const actualDelayMs = scheduledFor.getTime() - scheduledAt.getTime();
    const mergedData = {
        ...(alertData || {}),
        scheduled_via: 'auto_send',
        scheduled_was_edited: false,
        scheduled_send_in_ms: actualDelayMs,
        requested_send_in_ms: normalizedTiming.delay_ms,
        scheduled_working_hours_deferred: scheduleResolution.deferredForWorkingHours,
        scheduled_requested_for: scheduleResolution.requestedFor.toISOString(),
        scheduled_at: scheduledAt.toISOString(),
        schedule_reason: normalizedTiming.action === 'send_now'
            ? 'Auto DM recommended sending now; queued for worker dispatch.'
            : scheduleResolution.deferredForWorkingHours
                ? 'Auto DM delayed using contextual timing, then moved to the next coach DM working slot.'
                : 'Auto DM enabled; delayed using contextual timing.',
        reply_timing_choice: {
            action: normalizedTiming.action,
            chosen_delay_ms: actualDelayMs,
            requested_delay_ms: normalizedTiming.delay_ms,
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
        let immediateDispatch = null;
        if (shouldDispatchMetaAdReplyImmediately({
            alertData: mergedData,
            normalizedTiming,
            scheduleResolution,
        })) {
            immediateDispatch = await dispatchScheduledMetaAdReplyNow({
                alertId,
                scheduledFor: scheduledFor.toISOString(),
                replyText: normalizeCoachDraftText(replyText || '').trim(),
            });
        }
        return {
            scheduledFor: scheduledFor.toISOString(),
            data: mergedData,
            alreadyActioned: immediateDispatch?.ok === true || immediateDispatch?.reason === 'claim_lost',
            timing: normalizedTiming,
            immediateDispatch,
        };
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
const BALANCE_SOFT_CONTEXT_REASONS = new Set([
    'first_captured_reply_with_hidden_context',
    'draft_review_timeout',
]);

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

function isVerifiedBroadPaidMetaGoalToBlockerMove({
    draft,
    currentMessage = '',
    flowVariant = '',
    metaAdConversationFastLane = false,
} = {}) {
    const reply = draftTextFromDraft(draft);
    return metaAdConversationFastLane === true
        && flowVariant === 'broad_pain'
        && PAID_META_FITNESS_GOAL_RE.test(String(currentMessage || ''))
        && paidMetaOutboundAskedForBlocker(reply)
        && (reply.match(/\?/g) || []).length === 1
        && !/https?:\/\//i.test(reply)
        && !/\b(?:checkout|pay|payment|join|sign up)\b/i.test(reply);
}

function collectCocosAutoRepairIssues({ draft, draftReview, challengeOfferWarning, currentMessage, qualifier, leadStage, linkedUserId, meaningfulLeadReplyCount, voiceNoteMode = false, metaAdConversationFastLane = false, flowVariant = '' }) {
    const issues = [];
    const draftText = draftTextFromDraft(draft);
    const verifiedPaidMetaProgression = /^deterministic_paid_meta_conversation_v\d+/i.test(String(draft?.model || ''))
        && ['campaign_sales_progression', 'campaign_buyer_handoff', 'campaign_app_preview_handoff'].includes(String(draft?.replyMode || ''));
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
        issues.push('Draft appears to offer or link coaching. Remove the pitch unless the latest message clearly asks how to start or asks for the link.');
    }
    if (isUnsafeStockDiscoveryQuestion(draftText) && !isVerifiedBroadPaidMetaGoalToBlockerMove({
        draft,
        currentMessage,
        flowVariant,
        metaAdConversationFastLane,
    })) {
        issues.push('Draft uses a stock discovery question. Replace it with a specific reply to the latest detail, or no question if a reaction is enough.');
    }
    if (prematureChallengeInvite && !verifiedPaidMetaProgression) {
        issues.push('Draft invites coaching before the person has shown enough readiness or 3 meaningful lead replies. Keep rapport moving instead.');
    }
    if (voiceNoteMode) {
        const voiceQuality = inspectVoiceScriptQuality(draftText);
        voiceQuality.issues.forEach(issue => {
            issues.push(`Voice-note quality: ${issue}. Rewrite it with at least 34 natural spoken words and the approved imperfect spoken cadence.`);
        });
    }
    return [...new Set(issues.map(issue => truncate(String(issue || '').replace(/\s+/g, ' ').trim(), 220)).filter(Boolean))];
}

function shouldAttemptCocosDraftRepair({ cocosAutoSendLane, balanceAutoSendLane, mediaReview, baseContextReview, draft, repairIssues }) {
    if (!cocosAutoSendLane && !balanceAutoSendLane) return false;
    if (!draftTextFromDraft(draft)) return false;
    if (mediaReview?.required) return false;
    if (baseContextReview?.required) return false;
    return Array.isArray(repairIssues) && repairIssues.length > 0;
}

function isNonBlockingDraftStyleWarning(draftReview) {
    return String(draftReview?.verdict || '').toLowerCase() === 'warn'
        && draftReview?.notification_required !== true
        && draftReview?.context_loss_suspected !== true;
}

const META_AD_OPTION_MENU_WARNING_RE = /\b(?:choice menu|multiple[- ]choice|multi[- ]option|multiple options?|option list|stack(?:ed|ing)? questions?|too many questions?|second question|extra question|answer options?)\b/i;
function draftParrotsLatestInbound(replyText, currentMessage) {
    const normalize = value => String(value || '')
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9']+/g, ' ')
        .trim();
    const inbound = normalize(currentMessage);
    const reply = normalize(replyText);
    return inbound.length >= 18 && inbound.split(/\s+/).length >= 5 && reply.includes(inbound);
}

function buildSafeMetaAdStyleFallback({ draft, draftReview, currentMessage } = {}) {
    if (!isNonBlockingDraftStyleWarning(draftReview)) return null;
    const reviewText = [
        draftReview?.summary,
        draftReview?.suggested_fix,
        ...(Array.isArray(draftReview?.issues) ? draftReview.issues : []),
    ].filter(Boolean).join(' ');
    const optionMenuWarning = META_AD_OPTION_MENU_WARNING_RE.test(reviewText);
    if (!optionMenuWarning) return null;

    const originalText = draftTextFromDraft(draft);
    if (!originalText) return null;
    const firstQuestionEnd = originalText.indexOf('?');
    const hasAnotherQuestion = firstQuestionEnd >= 0 && originalText.indexOf('?', firstQuestionEnd + 1) >= 0;
    const replacement = hasAnotherQuestion ? originalText.slice(0, firstQuestionEnd + 1).trim() : '';
    if (!replacement || replacement === originalText || (replacement.match(/\?/g) || []).length > 1) return null;
    if (draftParrotsLatestInbound(replacement, currentMessage)) return null;
    if (/https?:\/\/|www\.|\b(?:sign\s*up|checkout|buy now)\b/i.test(replacement)) return null;
    return {
        ...draft,
        chunks: [replacement],
        joined: replacement,
    };
}

function repairRequiresQuestionFreeReply(repairIssues) {
    const issueText = (Array.isArray(repairIssues) ? repairIssues : [])
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return /\b(question fatigue|extra question|new question|follow-up question|fresh question|repeats? (?:a |the )?(?:prior |previous )?question|already (?:answered|explained)|reaction(?:\/acknowledgement)? (?:would be|is) enough|simple reaction(?:\/acknowledgement)?(?: would be| is)? enough)\b/.test(issueText);
}

function hasFirstPersonHealthClaim(text) {
    return /\b(?:i|i'm|i’ve|i've|ive|my)\b[^.!?\n]{0,90}\b(?:back|injur(?:y|ed|ies)?|pain|hurt(?:ing)?|sore|flar(?:e|ing)|medical|diagnos(?:is|ed)|surgery|rehab)\b/i.test(String(text || ''));
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

function normalizeQuestionFreeRepairedDraft(repaired) {
    const chunks = (Array.isArray(repaired?.chunks) ? repaired.chunks : [])
        .flatMap(chunk => String(chunk || '').split(/\n+/))
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => chunk
            .split(/(?<=[.!?])\s+/)
            .map(sentence => sentence.trim())
            .filter(sentence => sentence && !isQuestionLikeText(sentence))
            .join(' ')
            .trim())
        .filter(Boolean);
    return { chunks, joined: chunks.join('\n') };
}

async function repairCocosDraftFromReview({ draft, repairIssues, reviewContextBlocks, leadName, channelLabel, maxChunks, currentMessage, qualifier, businessName = "Coco's PT Studio", paidMetaMode = false }) {
    const draftText = draftTextFromDraft(draft);
    if (!draftText || !repairIssues?.length) return null;
    const questionFreeRepair = repairRequiresQuestionFreeReply(repairIssues);
    const questionRule = questionFreeRepair
        ? '- Do not ask a question or add a continuation hook. End after the direct answer, clarification, reaction, or acknowledgement.'
        : '- One natural question max. Skip the question when a reaction or direct answer is enough.';
    const followUpRule = questionFreeRepair
        ? '- The reviewer identified question fatigue or an already-answered point. Do not use a question mark anywhere in the repaired reply.'
        : '- Shannon follow-up shape: tiny acknowledgement plus one concrete question from their exact newest detail, for example "why by April?", "how long has this been going on for?", "when did that start?", "what part first?", or "how did that go?". Keep it open enough for them to answer naturally, never a choice menu. Avoid broad therapist-style questions.';
    const prompt = `You are repairing a ${businessName} ${channelLabel || 'IG'} DM draft before it can auto-send for Shannon.

Return ONLY valid JSON in this format:
{"messages":["chunk 1","chunk 2 if needed"]}

Repair rules:
- Fix every issue below, then keep the reply natural enough that Shannon would be happy sending it untouched.
- Answer the latest inbound message first. If the latest message is simple, a short simple reply is better than a coaching paragraph.
- Keep Shannon's casual phone-typed style. Use normal autocorrect casing unless the person-specific native examples show a stable different habit. No corporate tone, no AI talk, and no mention of auto-send, review, rules, or the business as a system.
- Preserve every concrete detail the original draft got right while fixing the listed issues. Never repair one omission by dropping a different supplied detail. If the current turn gives an exact duration or number, keep that exact value in the reply.
- Do not add a fresh hello, hey, mate, or time-of-day greeting during a repair. Continue the live conversation naturally.
- Never invent a first-person health, injury, pain, body, medical, family, pet, location, experience, or preference fact about Shannon. If it is not explicitly verified in the supplied context, leave it out.
${questionRule}
${followUpRule}
- Do not pitch, link, or offer the challenge unless the latest message clearly asks how to join/asks for the link, OR the issues explicitly say an earned paid-Meta offer is missing required facts because a goal and blocker are already known. In that earned case, include the verified offer facts but do not send a checkout URL.
- No em dashes.

ISSUES TO FIX:
${repairIssues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

CONTEXT THE ORIGINAL WRITER SAW:
${reviewContextBlocks || '(no context provided)'}

ORIGINAL DRAFT:
${draftText}`;
    const repairContents = [{ role: 'user', parts: [{ text: prompt }] }];
    const repairConfig = { maxOutputTokens: Math.min(1200, Math.max(500, (maxChunks || MAX_CHUNKS) * 280)), temperature: 0.35 };
    const rawText = paidMetaMode
        ? await callOpenAITextModel(repairContents, repairConfig, {
            profile: 'coach_fallback',
            label: 'openai-paid-meta-repair',
            models: ['gpt-5.4-mini'],
        })
        : await callGeminiFallback(repairContents, repairConfig);
    let repaired = normalizeCocosRepairedDraft(rawText, maxChunks || draft.maxChunks || MAX_CHUNKS, leadName);
    if (questionFreeRepair) {
        repaired = normalizeQuestionFreeRepairedDraft(repaired);
    }
    if (!repaired.joined || repaired.joined === draftText) return null;
    const earnedPaidMetaOfferRepair = repairIssues.some(issue => /Earned paid-Meta offer is missing/i.test(String(issue || '')));
    if (!earnedPaidMetaOfferRepair && isUnrequestedOfferInjection({
        originalDraft: draftText,
        repairedDraft: repaired.joined,
        currentMessage,
        qualifier,
    })) {
        return null;
    }
    return repaired;
}

async function persistCocosDraftRepair({ alertId, currentAlertData, draft, repairMeta, challengeOfferWarning, repairField = 'cocos_auto_repair' }) {
    if (!alertId || !draft?.joined) return currentAlertData || {};
    try {
        const rows = await supabaseQuery(`coach_alerts?select=data&id=eq.${encodeURIComponent(alertId)}&limit=1`);
        const latest = rows[0]?.data || {};
        const merged = {
            ...latest,
            ...(currentAlertData || {}),
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            ...buildDraftVideoAttachmentData(draft),
            ...buildDraftImageAttachmentData(draft),
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || latest.draft_reply_mode || 'standard',
            draft_max_chunks: draft.maxChunks || latest.draft_max_chunks || MAX_CHUNKS,
            challenge_offer_warning: challengeOfferWarning || null,
            [repairField]: repairMeta,
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
        console.warn('[ig-draft] draft repair alert update failed:', err.message);
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

    const latestText = normalizeCoachDraftText(currentMessage || contextReview.latest_text || '').trim();
    const draftText = draftTextFromDraft(draft);
    const simpleFirstCapturedReply = reasons.includes('first_captured_reply_with_hidden_context')
        && COCOS_SIMPLE_OPENER_RE.test(latestText)
        && String(draftReview?.verdict || '').toLowerCase() === 'pass'
        && !(Array.isArray(draftReview?.issues) && draftReview.issues.filter(Boolean).length);
    const onlySoftReasons = reasons.length > 0
        && reasons.every(reason => BALANCE_SOFT_CONTEXT_REASONS.has(reason));
    const reviewTimeoutOnly = isReviewTimeoutOnly(draftReview);
    if (!simpleFirstCapturedReply && !(onlySoftReasons && reviewTimeoutOnly)) return null;
    const hasTrackedContext = contextReview.tracked_outbound_context === true;
    const contextIndependent = contextReview.context_dependent === false;
    if (!simpleFirstCapturedReply && !hasTrackedContext && !contextIndependent) return null;
    if (!latestText || latestText.length > 260 || COCOS_RISKY_REPLY_RE.test(latestText)) return null;
    if (!draftText || draftText.length > 260 || COCOS_RISKY_REPLY_RE.test(draftText)) return null;

    return {
        allowed: true,
        reason: simpleFirstCapturedReply
            ? 'safe_first_captured_opener'
            : (contextIndependent ? 'soft_review_timeout_context_independent' : 'soft_review_timeout_tracked_context'),
        context_reasons: reasons,
        draft_review_reason: simpleFirstCapturedReply ? 'passed_safe_opener' : 'review_timeout',
    };
}

function isPaidMetaBuyerIntentOfferReplyAllowed({ alertData, challengeOfferWarning, currentMessage, draft, draftReview, linkedUserId } = {}) {
    const replyText = draftTextFromDraft(draft);
    return !linkedUserId
        && alertData?.meta_ad_fast_lane === true
        && challengeOfferWarning?.required === true
        && hasDirectBuyerIntent(currentMessage)
        && !!replyText
        && !isSignupLinkHandoffText(replyText)
        && String(draftReview?.verdict || '').toLowerCase() === 'pass'
        && draftReview?.notification_required !== true
        && draftReview?.context_loss_suspected !== true;
}

const PAID_META_CONTEXTUAL_OFFER_VIEW_RE = /^(?:can|could) i (?:see|look at|check out) (?:it|this|that|the (?:pass|details|program))(?: please)?[.!?\s]*$/i;
const PAID_META_FOUNDERS_PASS_SELECTION_RE = /^(?:(?:the\s+)?(?:founders?\s+pass|balance\s+foundations)(?:\s+please)?|(?:i\s+think\s+)?(?:the\s+)?(?:fixed\s+(?:six|6)[ -]?week\s+)?(?:founders?\s+pass|balance\s+foundations)\s+(?:is|sounds|looks)\b.{0,90}\b(?:best|right|fit|one)|(?:i(?:'ll| will|'d| would)|let(?:'s| us))\s+(?:go with|choose|take|start with|do)\s+(?:the\s+)?(?:founders?\s+pass|balance\s+foundations))\b[.!?\s\S]{0,100}$/i;

function isPaidMetaFoundersPassSelection(value = '') {
    return PAID_META_FOUNDERS_PASS_SELECTION_RE.test(String(value || '').replace(/\s+/g, ' ').trim());
}

function isBarePaidMetaFoundersPassSelection(value = '') {
    return /^(?:the\s+)?(?:founders?\s+pass|balance\s+foundations)(?:\s+please)?[.!?\s]*$/i
        .test(String(value || '').replace(/\s+/g, ' ').trim());
}

function isPaidMetaContextualCheckoutIntent(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    return hasDirectPaidMetaCheckoutIntent(message)
        || isBarePaidMetaFoundersPassSelection(message);
}

function isContextualMetaAdOfferLinkRequest({ currentMessage = '', qualifier = {}, history = [] } = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (String(qualifier?.commercial_stage || '').toLowerCase() !== 'buyer_intent') return false;
    const recentOutbound = (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-4);
    if (isPaidMetaFoundersPassSelection(message)) {
        if (!isBarePaidMetaFoundersPassSelection(message)
            && !hasDirectPaidMetaCheckoutIntent(message)) return false;
        return recentOutbound.some(item => {
            const text = String(item?.text || '');
            return /\b(?:founders? pass|balance foundations)\b/i.test(text)
                && /\b(?:which (?:one|option) do you want to start with|\$149|six-week|doesn['’]?t renew|full breakdown)\b/i.test(text);
        });
    }
    return false;
}

function buildContextualMetaAdOfferLinkReply({ checkoutUrl = '', flowVariant = 'plant_based_control', currentMessage = '' } = {}) {
    const url = String(checkoutUrl || '').trim();
    if (!isApprovedChallengeBioLinkText(url)) return null;
    if (isPaidMetaFoundersPassSelection(currentMessage)) {
        if (!isBarePaidMetaFoundersPassSelection(currentMessage)
            && !hasDirectPaidMetaCheckoutIntent(currentMessage)) return null;
        const joined = `Perfect, it's one $149 payment for the full six weeks. Here's the link: ${url}`;
        return {
            chunks: [joined],
            joined,
            checkoutUrl: url,
            flowVariant,
            model: 'deterministic_paid_meta_conversation_v2',
            replyMode: 'campaign_buyer_handoff',
            maxChunks: 1,
        };
    }
    const joined = `Yeah for sure, have a look here: ${url}\n\nHave a quick look and tell me, does that feel like the kind of support you need?`;
    return {
        chunks: [joined],
        joined,
        checkoutUrl: url,
        flowVariant,
        model: 'deterministic_meta_ad_contextual_link_v1',
        replyMode: 'standard',
        maxChunks: MAX_CHUNKS,
    };
}

function qualifierHasKnownMetaAdBlocker(qualifier = {}) {
    const facts = qualifier?.facts && typeof qualifier.facts === 'object' ? qualifier.facts : {};
    const relationshipChecklist = facts.relationship_checklist && typeof facts.relationship_checklist === 'object'
        ? facts.relationship_checklist
        : {};
    return [
        facts.history_blockers,
        facts.relationship_context,
        relationshipChecklist.stressors_frustrations,
    ].some(value => String(value || '').trim().length >= 4);
}

function ensureMetaAdSalesProgressionQuestion({
    draft = {},
    currentMessage = '',
    qualifier = {},
    leadStage = '',
    linkedUserId = null,
} = {}) {
    // The paid-Meta writer owns the complete conversational reply. Validation
    // may hold or repair a weak draft, but code must never bolt a stock question
    // onto wording written for the lead's actual newest turn.
    return draft;
}

function resolveMetaAdEarlyTypingDelayMs({ lastInboundAt = '', seed = '', nowMs = Date.now(), firstReply = false } = {}) {
    const key = String(seed || 'balance');
    let hash = 0;
    for (let index = 0; index < key.length; index += 1) {
        hash = ((hash * 31) + key.charCodeAt(index)) >>> 0;
    }
    const targetDelayMs = firstReply
        ? 500 + (hash % 1001)
        : 350 + (hash % 851);
    const inboundAtMs = Date.parse(lastInboundAt || '');
    if (!Number.isFinite(inboundAtMs)) return targetDelayMs;
    const elapsedMs = Math.max(0, Number(nowMs) - inboundAtMs);
    return Math.max(0, targetDelayMs - elapsedMs);
}

const PAID_META_GOAL_SIGNAL_RE = /\b(?:lose|drop|reduce|gain|build|improve|get|feel|become|want|need|goal|stronger|fitter|leaner|healthier|weight|fat|muscle|strength|fitness|energy|confidence)\b/i;
const PAID_META_BLOCKER_SIGNAL_RE = /\b(?:stop(?:ping)? and start(?:ing)?|stop[- ]start|keep stopping|keep restarting|always restart|fall(?:ing)? off|drop(?:ping)? off|never stick|can(?:'t| not) stick|inconsisten|discourag\w*|lose motivation|no motivation|no time|too busy|overwhelm|cravings?|weekends?|chocolate|emotional(?:ly)? eat\w*|having (?:it|chocolate|snacks?) around|accountab|stay on track|follow through|miss(?:ed|ing) (?:a )?(?:workout|session)|shifts? change|changing shifts?|family stuff|things? (?:just )?get(?:s)? in the way|work (?:and|&) (?:the )?kids|kids (?:and|&) work|busy with (?:work|kids|family))\b/i;
const PAID_META_FITNESS_GOAL_RE = /\b(?:lose|losing|weight|body fat|fat loss|fit|fitter|fitness|strong|stronger|strength|muscle|energy|health|healthier|tone|toned|confidence|run|running|training|workout)\b/i;
const PAID_META_CONCRETE_BLOCKER_RE = /\b(?:no time|not enough time|run out of time|too busy|work gets busy|prep|prepar\w*|routine|shift|roster|schedule|craving|weekend|chocolate|emotional(?:ly)? eat\w*|having (?:it|chocolate|snacks?) around|motivat\w*|inconsisten\w*|consisten\w*|stick|fall(?:ing)? off|drop(?:ping)?|stop(?:ping)?|restart|follow[ -]?through|accountab\w*|miss(?:ed|ing)? (?:a )?(?:workout|session)|random(?:ly)?|never know|no (?:proper )?(?:workout )?(?:plan|program)|don['\u2019]?t (?:have|know) (?:a |what )?(?:proper )?(?:workout )?(?:plan|program|to do)|overwhelm\w*|too much information|pain|injur\w*|cost|money|confidence)\b/i;
const PAID_META_STRONG_BLOCKER_RE = /\b(?:no time|not enough time|run out of time|too busy|work gets busy|prep|prepar\w*|routine|shift|roster|schedule|craving|weekend|chocolate|emotional(?:ly)? eat\w*|having (?:it|chocolate|snacks?) around|lose motivation|no motivation|inconsisten\w*|can['\u2019]?t stick|fall(?:ing)? off|drop(?:ping)? off|stop(?:ping)?|restart|follow[ -]?through|miss(?:ed|ing)? (?:a )?(?:workout|session)|random(?:ly)?|never know|no (?:proper )?(?:workout )?(?:plan|program)|don['\u2019]?t (?:have|know) (?:a |what )?(?:proper )?(?:workout )?(?:plan|program|to do)|overwhelm\w*|too much information|pain|injur\w*|cost|money)\b/i;
const PAID_META_FOOD_CONFUSION_RE = /\b(?:(?:i\s+)?(?:don['\u2019]?t|do not|dont)\s+know|(?:i\s+)?(?:dunno|dunn)|not sure|unsure|confused)\b[^.!?\n]{0,48}\b(?:what|how)\b[^.!?\n]{0,32}\b(?:eat|eating|meal|meals|food|protein)\b|\b(?:what|how)\b[^.!?\n]{0,32}\b(?:eat|eating|meal|meals|food|protein)\b[^.!?\n]{0,48}\b(?:confus|unsure|not sure)\w*/i;
const PAID_META_BROAD_BLOCKER_RE = /^(?:i\s+)?(?:dunno\s+)?(?:i\s+)?just\s+can['\u2019]?t\s+do\s+it[.!\s]*$|^(?:all|every)(?:\s+of)?\s+(?:it|that)[.!\s]*$|^everything[.!\s]*$/i;
const PAID_META_NEXT_STEP_RE = /^(?:okay[, ]*)?(?:so[, ]*)?(?:what (?:do i do|should i do|now)|what(?:'s| is) next|where (?:do i|should i) start|how (?:do i|should i) start)(?: now)?[.!?\s]*$/i;
const PAID_META_POSITIVE_FIT_RE = /^(?:(?:yes|yeah|yep|okay|ok|definitely|absolutely)\b(?!.*\b(?:but\s+(?:not|no)|don['’]?t|do not)\b)|probably\b|i think so\b|that would (?:really )?help\b|that sounds (?:really )?good\b|sounds (?:really )?good\b|i(?:'m| am) keen\b|keen\b|i(?:'d| would) (?:definitely )?like to (?:have )?(?:a )?(?:look|check(?: it)? out)\b)[\s\S]{0,160}$/i;
const PAID_META_APP_INCLUSIONS_RE = /\b(?:what(?:'s| is| was) (?:actually )?(?:included in|in|inside)|what do (?:i|you) get (?:in|inside)) (?:the )?(?:balance(?: app)?|app)\b/i;
const PAID_META_PROGRAM_WORKS_RE = /\bhow does (?:the |your )?(?:program|founders pass|course|coaching) work\b|\bwhat (?:is|comes) included\b/i;

function isPaidMetaConcreteBlocker(value = '') {
    const text = String(value || '');
    return PAID_META_CONCRETE_BLOCKER_RE.test(text) || PAID_META_FOOD_CONFUSION_RE.test(text);
}

function isPaidMetaStrongBlocker(value = '') {
    const text = String(value || '');
    return PAID_META_STRONG_BLOCKER_RE.test(text) || PAID_META_FOOD_CONFUSION_RE.test(text);
}

function isPaidMetaBroadBlockerAnswer(value = '', history = []) {
    if (!PAID_META_BROAD_BLOCKER_RE.test(String(value || '').trim())) return false;
    return (Array.isArray(history) ? history : [])
        .filter(message => String(message?.direction || '').toLowerCase() === 'out')
        .slice(-4)
        .some(message => paidMetaOutboundAskedForBlocker(String(message?.text || ''))
            || /\b(?:food|workouts?|sticking|consisten)\b[^?\n]{0,120}\?/i.test(String(message?.text || '')));
}
const PAID_META_OFFER_INFO_RE = /^(?:(?:thanks?|thank you)[\s,.!]*)?(?:just to confirm[\s,.!]*)?(?:i (?:want|need|wanted) to know )?(?:how much|(?:your )?prices?(?: and what i get)?|pricing|cost|what(?:'s| is) (?:actually )?included|what do i get|what are the (?:details|prices)|tell me (?:the|about the) (?:price|pricing|details|inclusions))(?:\b|[?!.])/i;

function buildPaidMetaBlockerReflection(message = '') {
    const text = String(message || '');
    if (/\b(?:pain|injur\w*|sore)\b/i.test(text)) {
        return 'When pain keeps interrupting the plan, trying to force the same week over and over usually makes it harder.';
    }
    if (/\b(?:anxi\w*|nervous|self-conscious|embarrass\w*|confidence|gym anxiety)\b/i.test(text)) {
        return 'When confidence is the thing getting in the way, having a plan that feels manageable matters more than trying to be perfect.';
    }
    if (/\b(?:crav\w*|weekends?|food keeps?)\b/i.test(text)) {
        return 'When food is the part that keeps pulling things off track, a simple structure is usually much easier to come back to.';
    }
    if (/\b(?:energy|fatigue\w*|exhaust\w*|sleep|stress\w*|motivat\w*|overwhelm\w*)\b/i.test(text)) {
        return 'When your energy or headspace keeps changing, expecting every week to look the same just sets you up to feel behind.';
    }
    if (/\b(?:shift work|rotating shifts?|shifts? change|changing shifts?|schedule|no time|too busy|caregiv\w*|kids?|children|family commitments?|family stuff|travel)\b/i.test(text)) {
        return 'When life keeps crowding the week, training and food are usually the first things to get pushed around.';
    }
    if (/\b(?:don['’]?t know (?:what|how|where)|not sure (?:what|how|where)|stuck)\b/i.test(text)) {
        return 'When you are not sure what the right next step is, it is easy to stay stuck even when the goal matters to you.';
    }
    return 'When something keeps knocking the plan off course, every restart can feel harder than the last one.';
}

function hasDirectPaidMetaCheckoutIntent(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    return /^(?:please )?(?:send (?:me )?(?:the )?link|can you send (?:me )?(?:the )?link|how do i (?:join|sign up|start|get started)|where do i (?:join|sign up|start|get started)|where can i (?:join|sign up|start|get started)|i(?:'m| am) ready to (?:join|sign up|start|get started)|i want to (?:join|sign up|start|get started)|i(?:'m| am) in,? send (?:me )?(?:the )?link)[.!?\s]*$/i.test(message)
        || /(?:^|[.!?]\s+)(?:please\s+)?(?:send (?:me )?(?:the )?(?:checkout )?link|can you send (?:me )?(?:the )?(?:checkout )?link|i(?:'m| am) ready to (?:join|sign up|start|get started)|i want to (?:join|sign up|start|get started))[.!?\s]*$/i.test(message);
}

function hasRecentPaidMetaSupportQuestion(history = []) {
    return (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-4)
        .some(item => {
            const text = String(item?.text || '');
            return /\b(?:would (?:having me|that kind of support)|would that help|accountability help|help you stay on track|make it easier|are you keen to (?:have|take) a look|would you like (?:me to show you|to (?:have|take)) (?:a )?(?:quick )?(?:look|preview)|do you want (?:a )?(?:free )?(?:personalised )?(?:quick )?(?:look|preview)|(?:do you )?want me to (?:show you|set up|create|put together)\b[^?\n]{0,120}\b(?:look|preview)|want me to send you (?:access|the link)|want to (?:have|take) a look|should i send (?:you )?(?:access|the link)|is that something you(?:'d| would) want)\b/i.test(text)
                || (/\b(?:six|6)[- ]week\b/i.test(text)
                    && /\b(?:meal plan|workout|training program)\b/i.test(text)
                    && /\b(?:send|access|look|link)\b[^?\n]{0,100}\?/i.test(text))
                || /\b(?:set yourself up in the app|set yourself up before you pay|check it out before any payment|once you(?:'ve| have) seen it, we can take payment)\b[\s\S]{0,260}\b(?:how does that sound|have a look first, then decide)\b/i.test(text);
        });
}

function isExplicitPaidMetaPreviewAcceptance(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    if (!message || /\b(?:not now|no thanks|don['\u2019]?t|do not|not interested|can['\u2019]?t)\b/i.test(message)) return false;
    return /^(?:yes|yeah|yep|definitely|absolutely|sure|okay|ok|keen)\b[\s\S]{0,180}$/i.test(message)
        || /^(?:that|it) sounds (?:really )?(?:good|great|perfect)\b[\s\S]{0,120}$/i.test(message)
        || /^(?:i(?:'d| would) like|give me|send me|let me|can i|i want)\b[\s\S]{0,120}\b(?:look|access|link|check it out|see it)\b[\s\S]{0,60}$/i.test(message);
}

function hasPaidMetaPreviewOrPriceDecline(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    return /\b(?:don['\u2019]?t|do not)\s+send\s+(?:me\s+)?(?:a|the|that)?\s*(?:preview|link)\b/i.test(message)
        || /\b(?:not now|no thanks|not interested)\b/i.test(message)
        || /\b(?:\$?\s*149|price|cost|it|that)\b[\s\S]{0,45}\b(?:too (?:much|expensive)|can['\u2019]?t afford|cannot afford|not (?:in|within) (?:my )?budget)\b/i.test(message);
}

function isExplicitPaidMetaPreviewRequest(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    if (!message || /\b(?:not now|no thanks|don['\u2019]?t|do not|not interested|can['\u2019]?t)\b/i.test(message)) return false;
    return /\b(?:can|could|may) i (?:see|view|open|try|look at) (?:it|the app|the preview|my preview|the program|the setup)\b/i.test(message)
        || /\b(?:show|send|open|give) me (?:the |my )?(?:app )?preview\b/i.test(message)
        || /\bi want to (?:see|view|open|try|look at) (?:it|the app|the preview|the program|the setup)\b/i.test(message);
}

function hasRecentCompletePaidMetaOffer(history = []) {
    const recentOutbound = (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-4);
    // Instagram can split one Graph API send into multiple native bubbles.
    // Treat the recent outbound run as one offer so a short "Yes" still
    // reaches the promised app preview instead of falling back to the writer.
    const text = recentOutbound.map(item => String(item?.text || '')).join(' ');
    return hasCompletePaidMetaOfferText(text);
}

function hasCompletePaidMetaOfferText(text = '') {
    const value = String(text || '');
    return /\b(?:six|6)[- ]week\b/i.test(value)
        && /\b(?:workout|training program)\b/i.test(value)
        && /\bmeal plan\b/i.test(value)
        && /\$\s*149\b/i.test(value)
        && /\b(?:no subscription|no auto-renewal|does not auto-renew|doesn't auto-renew)\b/i.test(value)
        && /\bbefore (?:(?:you )?pay|making a payment)/i.test(value);
}

function buildPaidMetaTailoredOfferText(blockerText = '', goalText = '', flowVariant = 'plant_based_control') {
    return buildPaidMetaTailoredOfferChunks(blockerText, goalText, flowVariant).join('\n\n');
}

function buildPaidMetaTailoredOfferChunks(blockerText = '', goalText = '', flowVariant = 'plant_based_control') {
    const turn = String(blockerText || '');
    const goal = String(goalText || '');
    const asksForMealPlan = /\bdo you (?:offer|have|provide|include) (?:a |any )?(?:plant[ -]?based )?meal plans?\b|\bis (?:a |the )?meal plan included\b/i.test(turn);
    const asksWhetherDietaryFitWorks = /\b(?:gluten[ -]?free|dietary (?:need|needs|preference|preferences|restriction|restrictions)|food side)\b[\s\S]{0,80}\b(?:work|fit|suit|okay|ok|possible|do you do that)\b/i.test(turn)
        || /\b(?:would|will|can|does)\b[\s\S]{0,60}\b(?:food side|meal plan|nutrition)\b[\s\S]{0,50}\b(?:work|fit|suit)\b/i.test(turn);
    let acknowledgement = 'Yeah, that makes sense.';
    if (PAID_META_BROAD_BLOCKER_RE.test(turn)) {
        acknowledgement = 'Yeah, if the food, workouts and consistency all feel hard at once, the answer is not more pressure. It needs to be one simple plan built around your week.';
    } else if (PAID_META_FOOD_CONFUSION_RE.test(turn)) {
        const weightTarget = goal.match(/\b(?:lose|losing)\s+(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?)\b/i)?.[1] || '';
        acknowledgement = /\b(?:muscle|strong|strength)\b/i.test(goal)
            ? 'Yeah, if you want to build muscle but don\'t know what to eat, the food side needs to make meals and protein simple instead of leaving you guessing.'
            : /\b(?:lose|losing|weight|fat)\b/i.test(goal)
                ? `Yeah, if you want to ${weightTarget ? `lose ${weightTarget} kilos` : 'lose weight'} but don't know what to eat, the food side needs to make meals simple instead of leaving you guessing.`
            : 'Yeah, if you don\'t know what to eat, the food side needs to make each meal simple instead of leaving you guessing.';
    } else if (/\b(?:shifts?|roster|schedule)\b/i.test(turn)) {
        acknowledgement = 'Yeah, with your week changing all the time, the plan needs to flex around your schedule.';
    } else if (/\b(?:food|prep|prepar|run out of time)\b/i.test(turn)) {
        acknowledgement = 'Yeah, if time and food prep are where it falls apart, the food side needs to stay simple on busy days.';
    } else if (/\b(?:accountab|follow[ -]?through|fall off|stop|restart|consisten)\b/i.test(turn)) {
        acknowledgement = 'Yeah, if follow-through is the hard part, a clear plan and someone checking in can make a big difference.';
    } else if (/\b(?:overwhelm|too much information)\b/i.test(turn)) {
        acknowledgement = 'Yeah, if too much information leaves you doing nothing, the next step needs to be obvious and simple.';
    } else if (/\b(?:random|workout|program|what to do next)\b/i.test(turn)) {
        acknowledgement = 'Yeah, if you never know which workout comes next, a clear program would take the guesswork out.';
    } else if (/\b(?:craving|weekend|chocolate|emotional(?:ly)? eat\w*|having (?:it|chocolate|snacks?) around)\b/i.test(turn)) {
        acknowledgement = 'Yeah, if cravings and weekends are where it slips, the food plan needs to be flexible enough for real life.';
    }
    if (asksForMealPlan) {
        const directAnswerDetail = acknowledgement.replace(/^Yeah,\s*/i, '');
        acknowledgement = `Yeah, I do. ${directAnswerDetail.charAt(0).toUpperCase()}${directAnswerDetail.slice(1)}`;
    } else if (flowVariant === 'broad_pain' && asksWhetherDietaryFitWorks) {
        const dietaryAnswer = /\bgluten[ -]?free\b/i.test(turn)
            ? 'Yep, gluten-free works.'
            : 'Yep, the food side can fit your dietary preferences.';
        acknowledgement = `${dietaryAnswer} ${acknowledgement.replace(/^Yeah,\s*/i, '')}`;
    }
    const mealPlanCopy = flowVariant === 'broad_pain'
        ? 'a meal plan fitted to your dietary preferences'
        : 'a plant-based meal plan';
    if (flowVariant === 'broad_pain') {
        const compactAcknowledgement = /\b(?:shifts?|roster|schedule)\b/i.test(turn)
            ? (asksWhetherDietaryFitWorks && /\bgluten[ -]?free\b/i.test(turn)
                ? 'Yep, gluten-free works. With a changing roster,'
                : 'With a changing roster,')
            : acknowledgement;
        return [
            `${compactAcknowledgement} Balance gives you a six-week workout program around your week, ${mealPlanCopy}, six weeks of app and community access, and one weekly training and food review and adjustment.`,
            "It's one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. Want me to open your free personalised preview before you pay?",
        ];
    }
    return [
        acknowledgement,
        `Balance Foundations is a six-week course with your workout program built around your week, ${mealPlanCopy}, and one weekly check-in where I review your training and food and adjust things.`,
        "It's one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. Want me to open your free personalised preview so you can see your meal plan and workout program before making a payment?",
    ];
}

function addPaidMetaProofVideoToOfferChunks(chunks = [], history = []) {
    const offerChunks = (Array.isArray(chunks) ? chunks : []).map(chunk => String(chunk || '').trim());
    if (!offerChunks.length || hasRecentPaidMetaProofVideo(history)) {
        return { chunks: offerChunks, videoAttachmentUrl: null };
    }
    const finalIndex = offerChunks.length - 1;
    offerChunks[finalIndex] = offerChunks[finalIndex].replace(
        /Want me to open your free personalised preview[^?]*\?$/i,
        "Here's a quick video showing you how it works inside Balance. Want me to open your free personalised preview before making a payment?"
    );
    return {
        chunks: offerChunks,
        videoAttachmentUrl: resolveBalanceFoundationsAppProofVideoUrl(),
    };
}

function buildPaidMetaGoalToBlockerText(goalText = '', transformationProof = null) {
    const turn = String(goalText || '');
    let acknowledgement = 'Yeah, that’s a clear goal.';
    if (/\b(?:8\s*kg|lose.+(?:kg|weight|fat)|body fat)\b/i.test(turn) && /\b(?:fit|fitter|energy)\b/i.test(turn)) {
        acknowledgement = 'Yeah, losing the weight and feeling fitter is a really clear goal.';
    } else if (/\b(?:muscle|strong|strength)\b/i.test(turn)) {
        acknowledgement = 'Yeah, building muscle and getting stronger is a solid goal.';
    } else if (/\b(?:5\s*km|run|running)\b/i.test(turn)) {
        acknowledgement = 'Yeah, getting comfortable over 5km is a really clear target.';
    } else if (/\b(?:pregnan|postpartum|after (?:having )?(?:a )?baby)\b/i.test(turn)) {
        acknowledgement = 'Yeah, getting fitter and feeling more like yourself again is a really solid goal.';
    } else if (/\benergy\b/i.test(turn)) {
        acknowledgement = 'Yeah, having more energy and feeling fitter is a solid goal.';
    }
    const proofLine = String(transformationProof?.introduction || '').trim();
    return `${acknowledgement}${proofLine ? ` ${proofLine}` : ''} What usually gets in the way of making that happen consistently?`;
}

function paidMetaHistoryHasConcreteBlocker(history = []) {
    const messages = Array.isArray(history) ? history : [];
    return messages.some((message, index) => String(message?.direction || '').toLowerCase() === 'in'
        && (isPaidMetaConcreteBlocker(String(message?.text || ''))
            || isPaidMetaBroadBlockerAnswer(String(message?.text || ''), messages.slice(0, index))));
}

function paidMetaLatestConcreteBlockerText(history = []) {
    const messages = Array.isArray(history) ? history : [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (String(message?.direction || '').toLowerCase() !== 'in') continue;
        const text = String(message?.text || '').trim();
        if (isPaidMetaConcreteBlocker(text)
            || isPaidMetaBroadBlockerAnswer(text, messages.slice(0, index))) return text;
    }
    return '';
}

function isApprovedPaidMetaAppPreviewMoment({ currentMessage = '', qualifier = {} } = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    return (PAID_META_BLOCKER_SIGNAL_RE.test(message)
            || hasHighSignalGoalBlocker(message)
            || PAID_META_POSITIVE_FIT_RE.test(message))
        && qualifierHasKnownMetaAdBlocker(qualifier)
        && !!String(qualifier?.facts?.current_state || qualifier?.facts?.motivation || '').trim();
}

function hasRecentPaidMetaGoalQuestion(history = []) {
    return (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-3)
        .some(item => /\bwhat are you mainly trying to change(?: at the moment)?\b/i.test(String(item?.text || '')));
}

function hasRecentPaidMetaProofVideo(history = []) {
    return (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-8)
        .some(item => /\b(?:quick video|showing you how it works inside Balance)\b|balance-foundations-app-proof-v(?:5|6)/i
            .test(String(item?.text || '')));
}

function isExplicitPaidMetaProofVideoRetry({ currentMessage = '', history = [] } = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    const directVideoRequest = /\b(?:show|send)\s+me\s+(?:the\s+)?(?:vid|video)(?:\s+again)?\b/i.test(message)
        || /\b(?:vid|video)\s+(?:again|please|pls|plz)\b/i.test(message);
    const failedDelivery = /\b(?:can(?:not|'t)|couldn(?:'t)?|didn(?:'t)?)\s+(?:see|watch|open|load)\s+(?:it|the\s+(?:vid|video))\b/i.test(message)
        || /\b(?:it|the\s+(?:vid|video))\s+(?:isn't|is\s+not|didn't)\s+(?:showing|loading|coming\s+through)\b/i.test(message);
    if (directVideoRequest) return true;
    if (!failedDelivery) return false;

    const recentOutbound = (Array.isArray(history) ? history : [])
        .filter(item => String(item?.direction || '').toLowerCase() === 'out')
        .slice(-6)
        .map(item => String(item?.text || ''))
        .join(' ');
    return /\b(?:video|vid|quick\s+(?:look|video)|watch(?:ed)?|here\s+it\s+is)\b/i.test(recentOutbound);
}

function buildPaidMetaProofVideoRetryReply(currentMessage = '') {
    const failedDelivery = /\b(?:can(?:not|'t)|couldn(?:'t)?|didn(?:'t)?)\s+(?:see|watch|open|load)\s+(?:it|the\s+(?:vid|video))\b/i.test(String(currentMessage || ''));
    const joined = failedDelivery
        ? `Ah sorry, it didn't come through properly. I've sent the video again, can you see it now?`
        : `Yep, here it is again. Can you see it now?`;
    return {
        chunks: [joined],
        joined,
        videoAttachmentUrl: resolveBalanceFoundationsAppProofVideoUrl(),
        model: 'deterministic_paid_meta_video_retry_v1',
        replyMode: 'campaign_native_video_retry',
        maxChunks: 1,
        error: null,
    };
}

function buildPaidMetaVoiceGoalPhrase(facts = {}) {
    const rawGoal = String(facts.current_state || facts.motivation || '').replace(/\s+/g, ' ').trim();
    const kgGoal = rawGoal.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:kg|kgs|kilograms?)\b/i)?.[1] || '';
    const weightGoal = /\b(?:lose|losing|weight|fat|leaner|tone)\b/i.test(rawGoal);
    const fitnessGoal = /\b(?:fit|fitter|fitness|energy)\b/i.test(rawGoal);
    if (kgGoal && weightGoal && fitnessGoal) return `losing ${kgGoal} kilos and feeling fitter`;
    if (kgGoal && weightGoal) return `losing ${kgGoal} kilos`;
    if (weightGoal) return 'your weight-loss goal';
    if (/\b(?:strong|stronger|strength|muscle)\b/i.test(rawGoal)) return 'getting stronger';
    if (fitnessGoal) return 'feeling fitter';
    return 'your goal';
}

function hasRecentPaidMetaPlantBasedQuestion(history = []) {
    return /currently plant-based|interested in (?:eating more )?plant-based/i.test(
        String(lastPaidMetaOutbound(history)?.text || '')
    );
}

function hasRecentPaidMetaPlantReasonQuestion(history = []) {
    return /\bwhat made you (?:decide to |want to )?(?:go |become )?(?:vegan|vegetarian|plant[ -]?based)\b|\bwhy did you (?:go|become) (?:vegan|vegetarian|plant[ -]?based)\b/i.test(
        String(lastPaidMetaOutbound(history)?.text || '')
    );
}

function buildPaidMetaPlantReasonToGoalText(reasonText = '') {
    const reason = String(reasonText || '');
    const asksShannonBack = /\b(?:how|what) about you\b/i.test(reason);
    let acknowledgement = 'Yeah, that makes sense.';
    if (/\b(?:animal|ethic\w*|cruel|welfare)\b/i.test(reason)) {
        acknowledgement = 'Yeah, I get that. I\'ve been vegan for five years now.';
    } else if (/\b(?:environment|planet|climate|sustainab)\w*\b/i.test(reason)) {
        acknowledgement = 'Yeah, I get that. The environmental side matters a lot.';
    } else if (/\b(?:health|feel better|energy|digestion|cholesterol)\b/i.test(reason)) {
        acknowledgement = 'Yeah, that makes sense. Feeling better day to day is a solid reason.';
    }
    if (asksShannonBack && !/\b(?:five|5) years?\b/i.test(acknowledgement)) {
        acknowledgement += ' I\'ve been vegan for five years now.';
    }
    return `${acknowledgement} What's your main health or fitness goal at the moment?`;
}

function isAdaptivePaidMetaPlantBasedIdentityTurn({
    currentMessage = '',
    history = [],
    flowVariant = 'plant_based_control',
} = {}) {
    if (flowVariant !== 'plant_based_control' || !hasRecentPaidMetaPlantBasedQuestion(history)) return false;
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!message || META_AD_FIRST_REPLY_OPT_OUT_RE.test(message) || META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE.test(message)) {
        return false;
    }
    if (PAID_META_OFFER_INFO_RE.test(message)
        || PAID_META_PROGRAM_WORKS_RE.test(message)
        || PAID_META_APP_INCLUSIONS_RE.test(message)
        || hasDirectPaidMetaCheckoutIntent(message)) return false;
    return /\b(?:plant[ -]?based|vegan|vegetarian|not fully|not yet|already|currently|transition\w*|adopt\w*|curious|trying|want to (?:go|eat|be) more|eat\w* .{0,24}(?:times?|days?) (?:a|per) week|once|twice|few times|yes|yeah|yep|no|nah)\b/i.test(message);
}

function buildPaidMetaPlantBasedIdentityProgression({
    currentMessage = '',
    history = [],
    flowVariant = 'plant_based_control',
} = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    const simpleConfirmedIdentity = message.split(/\s+/).length <= 7
        && /\b(?:vegan|vegetarian|plant[ -]?based)\b/i.test(message)
        && !/\b(?:not|yet|trying|interested|adopt|transition|because|since|for\s+\d|years?|months?|weeks?)\b/i.test(message)
        && !/\?/.test(message);
    const experiencedVeganIdentity = /\b(?:vegan|plant[ -]?based)\b/i.test(message)
        && /\b(?:vegan|plant[ -]?based)\b.{0,28}\bfor\s+(?:years?|\d+\s+years?)\b/i.test(message)
        && !/\b(?:not|yet|trying|interested|adopt|transition|because|since)\b/i.test(message);
    const asksShannonBack = /\b(?:how|what)\s+about\s+you\b|\bare\s+you\b.*\b(?:vegan|plant[ -]?based)\b/i.test(message);
    // A confirmed vegan identity, including a supplied duration or reciprocal
    // question, has one verified next step in the paid-ad script. Answer the
    // Shannon fact directly and advance without waiting on two model calls.
    if ((!simpleConfirmedIdentity && !experiencedVeganIdentity) || flowVariant !== 'plant_based_control') return null;
    const joined = experiencedVeganIdentity || asksShannonBack
        ? 'I\'ve been vegan for five years too. What made you go vegan?'
        : /\bvegetarian\b/i.test(message)
            ? 'Nice. How long have you been vegetarian, and what made you go vegetarian?'
            : /\bvegan\b/i.test(message)
                ? 'Awesome. How long have you been vegan, and what made you go vegan?'
                : 'Nice. How long have you been plant-based, and what made you go plant-based?';
    return {
        chunks: [joined],
        joined,
        model: 'deterministic_paid_meta_guided_sales_v1',
        replyMode: 'campaign_sales_progression',
        maxChunks: 1,
        error: null,
        flowVariant,
    };
}

function buildDeterministicPaidMetaConversationReply({
    currentMessage = '',
    qualifier = {},
    history = [],
    flowVariant = 'plant_based_control',
    checkoutUrl = '',
    appPreviewUrl = META_APP_PREVIEW_URL,
    personalVoiceNoteMode = false,
    allowVideoAttachment = false,
} = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!message
        || META_AD_FIRST_REPLY_OPT_OUT_RE.test(message)
        || META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE.test(message)) return null;

    // This is a conversational identity turn, not a fixed funnel-copy turn.
    // Leave it with the model so it can reflect the person's exact habit,
    // duration, or reason before asking the next useful question.
    if (isAdaptivePaidMetaPlantBasedIdentityTurn({ currentMessage: message, history, flowVariant })
        && !(isExplicitPaidMetaPreviewAcceptance(message) && hasRecentCompletePaidMetaOffer(history))) {
        return buildPaidMetaPlantBasedIdentityProgression({ currentMessage: message, history, flowVariant });
    }

    if (flowVariant === 'plant_based_control'
        && hasRecentPaidMetaPlantReasonQuestion(history)
        && !hasDirectPaidMetaCheckoutIntent(message)) {
        const joined = buildPaidMetaPlantReasonToGoalText(message);
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_guided_sales_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    const facts = qualifier?.facts && typeof qualifier.facts === 'object' ? qualifier.facts : {};
    const commercialStage = String(qualifier?.commercial_stage || '').toLowerCase();
    const hasGoal = !!String(facts.current_state || facts.motivation || '').trim();
    const hasBlocker = qualifierHasKnownMetaAdBlocker(qualifier);
    const voiceGoalPhrase = buildPaidMetaVoiceGoalPhrase(facts);
    const broadFlow = flowVariant === 'broad_pain';
    const recentProofVideo = hasRecentPaidMetaProofVideo(history);
    const askedWhetherProofWasShannonsClient = (Array.isArray(history) ? history : [])
        .slice(-5)
        .some(item => item?.direction === 'in'
            && /\b(?:was|is) (?:this|that|she|he) (?:one of )?your clients?\b/i.test(String(item?.text || '')));
    const approvedCheckoutUrl = isApprovedChallengeBioLinkText(checkoutUrl) ? String(checkoutUrl).trim() : '';
    const priorHistoryHasGoal = paidMetaHistoryHasFitnessGoal(history);
    const historyHasGoal = hasGoal || priorHistoryHasGoal;
    const historyHasBlocker = hasBlocker || paidMetaHistoryHasConcreteBlocker(history);

    if (broadFlow && hasPaidMetaPreviewOrPriceDecline(message)) {
        const joined = /\b(?:too (?:much|expensive)|can['\u2019]?t afford|cannot afford|not (?:in|within) (?:my )?budget)\b/i.test(message)
            ? 'That’s completely fair. If $149 is too much right now, leave it there. I won’t send the link.'
            : 'No worries. I won’t send the preview or link.';
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_autonomy_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    // Only exact transport handoffs are deterministic. Normal identity, goal,
    // blocker, FAQ, objection and offer wording belongs to the live writer.
    if (hasDirectPaidMetaCheckoutIntent(message) && approvedCheckoutUrl) {
        const joined = `Yep, you can get started here: ${approvedCheckoutUrl}`;
        return {
            chunks: [joined],
            joined,
            checkoutUrl: approvedCheckoutUrl,
            model: 'deterministic_paid_meta_handoff_v1',
            replyMode: 'campaign_buyer_handoff',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }
    const directPreviewRequest = broadFlow && isExplicitPaidMetaPreviewRequest(message);
    const acceptedExplicitPreviewInvitation = isExplicitPaidMetaPreviewAcceptance(message)
        && hasRecentPaidMetaSupportQuestion(history);
    const acceptedPreviewHandoff = directPreviewRequest
        || acceptedExplicitPreviewInvitation
        || (!hasPaidMetaPreviewOrPriceDecline(message)
            && PAID_META_POSITIVE_FIT_RE.test(message)
            && hasRecentCompletePaidMetaOffer(history));
    if (acceptedPreviewHandoff
        && appPreviewUrl
        && (directPreviewRequest || acceptedExplicitPreviewInvitation || (historyHasGoal && historyHasBlocker))) {
        const mealPlanCopy = broadFlow ? 'meal plan fitted to your dietary preferences' : 'plant-based meal plan';
        const joined = `Yep, I can set you up in the app so you can check out your workout program and ${mealPlanCopy} before paying. Here you go: ${appPreviewUrl}`;
        return {
            chunks: [joined],
            joined,
            appPreviewHandoff: true,
            appPreviewUrl,
            model: 'deterministic_paid_meta_handoff_v1',
            replyMode: 'campaign_app_preview_handoff',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }
    if (!priorHistoryHasGoal
        && PAID_META_FITNESS_GOAL_RE.test(message)
        && !isPaidMetaStrongBlocker(message)) {
        const transformationProof = resolvePaidMetaTransformationProof({ goalText: message });
        const joined = buildPaidMetaGoalToBlockerText(message, transformationProof);
        return {
            chunks: splitCoachDraftIntoDmBubbles([joined]).slice(0, MAX_CHUNKS),
            joined,
            model: 'deterministic_paid_meta_guided_sales_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: MAX_CHUNKS,
            error: null,
            flowVariant,
            imageAttachmentUrl: broadFlow ? null : (transformationProof?.imageUrl || null),
        };
    }
    if (historyHasGoal
        && (isPaidMetaConcreteBlocker(message) || isPaidMetaBroadBlockerAnswer(message, history))) {
        const offer = addPaidMetaProofVideoToOfferChunks(buildPaidMetaTailoredOfferChunks(
            message,
            facts.motivation || facts.current_state || paidMetaLatestFitnessGoalText(history),
            flowVariant
        ), history);
        const chunks = offer.chunks;
        const joined = chunks.join('\n\n');
        return {
            chunks,
            joined,
            model: 'deterministic_paid_meta_guided_sales_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: MAX_CHUNKS,
            error: null,
            flowVariant,
            videoAttachmentUrl: offer.videoAttachmentUrl,
        };
    }
    if (historyHasGoal
        && historyHasBlocker
        && PAID_META_POSITIVE_FIT_RE.test(message)
        && !hasRecentCompletePaidMetaOffer(history)) {
        const blockerText = paidMetaLatestConcreteBlockerText(history);
        const offer = addPaidMetaProofVideoToOfferChunks(buildPaidMetaTailoredOfferChunks(
            blockerText,
            facts.motivation || facts.current_state || paidMetaLatestFitnessGoalText(history),
            flowVariant
        ), history);
        const chunks = offer.chunks;
        return {
            chunks,
            joined: chunks.join('\n\n'),
            model: 'deterministic_paid_meta_guided_sales_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: MAX_CHUNKS,
            error: null,
            flowVariant,
            videoAttachmentUrl: offer.videoAttachmentUrl,
        };
    }
    return null;

    /* Legacy conversational templates below are unreachable while retained
       temporarily for migration diff clarity. They must not regain authority. */
    if (META_AD_QUESTION_FATIGUE_RE.test(message)) {
        const joined = `Yep, you're right. You already answered that. I shouldn't have asked you again.`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (resolveMetaAdFirstReplyIntent(message) === 'personalised_coaching') {
        const knownProblem = hasGoal && hasBlocker;
        const body = personalVoiceNoteMode && knownProblem
            ? `Yeah, I do. Ummmm... honestly, Balance Foundations gives you a clear six-week starting plan inside the app.\n\nYou can set yourself up before you pay and see your weekly goals, starter workouts, meal plan, community, and my welcome note in your Inbox.\n\nYou've also got me there once a week to review how training and food are actually going.\n\nIt's one hundred and forty-nine dollars once for the full six weeks, and it doesn't renew.\n\nHave a look first, then decide.`
            : knownProblem
            ? `Yeah, I do. Balance Foundations gives you a six-week curriculum inside the app, plus one weekly check-in where I review and adjust your training and food around what's actually happening.`
            : `Yeah, I do. Balance Foundations gives you a six-week curriculum inside the app, plus one weekly check-in where I review and adjust your training and food.`;
        const nextAsk = knownProblem
            ? (personalVoiceNoteMode ? 'How does that sound?' : 'Are you keen to have a quick look inside the app?')
            : 'What are you mainly trying to change at the moment?';
        const joined = `${body}\n\n${nextAsk}`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
            voiceThoughtPausesMs: personalVoiceNoteMode && knownProblem ? [1700, 2300, 1500, 1100, 800] : [],
            voiceRenderMode: personalVoiceNoteMode && knownProblem ? 'single_performance_aligned_pauses_v1' : '',
        };
    }

    if (PAID_META_APP_INCLUSIONS_RE.test(message)) {
        const muscleGoal = /\b(?:muscle|strength|stronger)\b/i.test(String(facts.current_state || facts.motivation || ''));
        const appContents = broadFlow
            ? 'workouts with video demos, meal planning and daily targets, weekly goals, progress tracking, and the community'
            : 'workouts with video demos, plant-based meal plans and daily targets, weekly goals, progress tracking, and the plant-based community';
        const supportOffer = broadFlow ? 'The six-week Balance kickstart' : 'The Balance Foundations program';
        const nextAsk = muscleGoal
            ? 'Want me to show you what the muscle-building side would look like for you?'
            : 'Want me to show you what a first week could look like for your goal?';
        const joined = `Yeah, inside Balance you get ${appContents}. ${supportOffer} adds six weeks of support from me on top.\n\n${nextAsk}`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (PAID_META_PROGRAM_WORKS_RE.test(message)) {
        const goalText = voiceGoalPhrase ? ` around ${voiceGoalPhrase}` : '';
        const communityCopy = broadFlow ? 'the Balance app and community' : 'the Balance app and plant-based community';
        const offerName = broadFlow ? 'The six-week Balance kickstart' : 'Balance Foundations';
        const joined = `${offerName} gives you a clear six-week curriculum${goalText} inside the app, with workouts and video demos, meal planning, progress tracking and six weeks of ${communityCopy}. You also get one weekly check-in where I review and adjust your training and food. It finishes after six weeks and doesn't renew automatically.\n\nAre you keen to have a quick look inside the app?`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (PAID_META_OFFER_INFO_RE.test(message)) {
        const communityCopy = broadFlow ? 'the Balance app and community' : 'the Balance app and plant-based community';
        const offerName = broadFlow ? 'The six-week Balance kickstart' : 'Balance Foundations';
        const selectedFixedStart = /\b(?:founders pass|balance foundations|fixed (?:six|6)[ -]?week)\b/i.test(message);
        const nextAsk = selectedFixedStart
            ? 'Would you like me to send you the checkout link?'
            : 'Want me to show you how the first week would work around your goal?';
        const joined = `${offerName} is one $149 payment for the full six weeks. You get the complete six-week curriculum, six weeks of ${communityCopy}, and one weekly check-in and plan review with me. It doesn't renew automatically.\n\n${nextAsk}`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (isPaidMetaFoundersPassSelection(message) && !hasDirectPaidMetaCheckoutIntent(message)) {
        const joined = `Yeah, Balance Foundations sounds like the right fit. It's one $149 payment for the full six weeks, and it doesn't renew automatically.\n\nWould you like me to send you the checkout link?`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (hasDirectPaidMetaCheckoutIntent(message) && approvedCheckoutUrl) {
        const joined = `Yep, you can get started here: ${approvedCheckoutUrl}\n\nOnce you're in, tell me and I'll help you make the first week simple.`;
        return {
            chunks: [joined],
            joined,
            checkoutUrl: approvedCheckoutUrl,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_buyer_handoff',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (PAID_META_NEXT_STEP_RE.test(message) && hasGoal && hasBlocker) {
        const offerName = broadFlow ? 'the six-week Balance kickstart' : 'Balance Foundations';
        if (!broadFlow) {
            const joined = `${offerName} is one $149 payment for the complete six-week curriculum, with one weekly check-in and plan review from me.\n\nIf you're keen, I can give you access to the app so you can check it out before any payment. Are you keen to have a look?`;
            return {
                chunks: [joined],
                joined,
                model: 'deterministic_paid_meta_conversation_v2',
                replyMode: 'campaign_sales_progression',
                maxChunks: 1,
                error: null,
                flowVariant,
            };
        }
        const nextAsk = recentProofVideo || !FOUNDERS_PASS_APP_PREVIEW_URL
            ? 'Want me to send you the full breakdown?'
            : 'Want me to send you the quick video so you can see how it works?';
        const joined = `Based on what you've told me, ${offerName} is probably the best starting point. It gives you a clear week to follow and support from me when that stop-start pattern kicks in.\n\n${nextAsk}`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (PAID_META_POSITIVE_FIT_RE.test(message) && hasRecentPaidMetaSupportQuestion(history)) {
        if (!broadFlow && appPreviewUrl && hasGoal && hasBlocker) {
            const joined = `Yeah, for sure. Here you go. You can set yourself up and look through the app before any payment: ${appPreviewUrl}`;
            return {
                chunks: [joined],
                joined,
                appPreviewHandoff: true,
                appPreviewUrl,
                model: 'deterministic_paid_meta_conversation_v3',
                replyMode: 'campaign_app_preview_handoff',
                maxChunks: 1,
                error: null,
                flowVariant,
            };
        }
        const offerName = broadFlow ? 'the six-week Balance kickstart' : 'Balance Foundations';
        const canSendProofVideo = Boolean(FOUNDERS_PASS_APP_PREVIEW_URL) && allowVideoAttachment && !broadFlow && !recentProofVideo;
        const nextAsk = recentProofVideo
            ? 'Want me to send you the full breakdown?'
            : (canSendProofVideo
                ? 'Want me to give you the full breakdown?'
                : 'Want me to show you what the first week would look like?');
        const proofBridge = canSendProofVideo
            ? ` Here's a quick video showing you how it works inside Balance.`
            : '';
        const body = `Yeah, that's exactly what ${offerName} is for. You get the structure for the week, plus support from me when things start slipping.${proofBridge}`;
        const chunks = canSendProofVideo ? [body, nextAsk] : [`${body}\n\n${nextAsk}`];
        const joined = chunks.join('\n\n');
        return {
            chunks,
            joined,
            videoAttachmentUrl: canSendProofVideo ? FOUNDERS_PASS_APP_PREVIEW_URL : null,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: chunks.length,
            error: null,
            flowVariant,
        };
    }

    if ((PAID_META_BLOCKER_SIGNAL_RE.test(message) || hasHighSignalGoalBlocker(message)) && hasGoal) {
        const lifeLoadBlocker = /\b(?:things? (?:just )?get(?:s)? in the way|work (?:and|&) (?:the )?kids|kids (?:and|&) work|busy with (?:work|kids|family))\b/i.test(message);
        const blockerReflection = buildPaidMetaBlockerReflection(message);
        const reflection = lifeLoadBlocker
            ? 'Work and the kids can wreck the best intentions, hey.'
            : blockerReflection;
        const proofAnswer = askedWhetherProofWasShannonsClient
            ? `Yeah, she's one of my clients. `
            : '';
        if (askedWhetherProofWasShannonsClient) {
            const joined = `${proofAnswer}And that makes sense. Knowing what to do probably isn't the problem, it's keeping it going when the week changes. What usually drops off first for you, the training, the food, or both?`;
            return {
                chunks: [joined],
                joined,
                model: 'deterministic_paid_meta_conversation_v3',
                replyMode: 'campaign_sales_progression',
                maxChunks: 1,
                error: null,
                flowVariant,
            };
        }
        if (broadFlow) {
            const broadJoined = personalVoiceNoteMode
                ? `${proofAnswer}Yeah, so that makes total sense. ${reflection} Um, honestly, that's what this program is designed for. It's about having me check in, keep you accountable, and adjust the week with you so we can keep the ball rolling. Would that kind of support help you keep moving toward ${voiceGoalPhrase}?`
                : `${proofAnswer}Yeah, that makes sense. ${reflection}\n\nWould having a clear plan and me checking in help you stay on track?`;
            return {
                chunks: [broadJoined],
                joined: broadJoined,
                model: 'deterministic_paid_meta_conversation_v1',
                replyMode: 'campaign_sales_progression',
                maxChunks: 1,
                error: null,
                flowVariant,
            };
        }
        const joined = personalVoiceNoteMode
            ? [
                `${proofAnswer}Yeah, that makes total sense. ${reflection}`,
                `Ummmm... honestly, Balance is built for weeks like that. It gives you a simple starter plan around ${voiceGoalPhrase}, and we can adjust it when life changes.`,
                `You can set yourself up before you pay. You'll see your weekly goals, starter workouts, meal plan, community, and my welcome note in your Inbox.`,
                `It's one hundred and forty-nine dollars once for the full six weeks, and it doesn't renew.`,
                `Have a look first, then decide. How does that sound?`,
            ].join('\n\n')
            : [
                `${proofAnswer}Yeah, I get you. ${reflection} A rigid plan just becomes another thing to fall behind on when it doesn't fit around real life.`,
                `That's how I'd set Balance up for you. You'd get the six-week Foundations course, a workout program built around your week, meal-plan support that fits your dietary needs, and one weekly check-in with me where I review your training and food and adjust things. It's one $149 payment for the full six weeks, with no subscription or auto-renewal.`,
                `I can let you set it all up and look through the app before you pay. Want me to send you access?`,
            ].join('\n\n');
        return {
            chunks: [joined],
            joined,
            appPreviewHandoff: false,
            appPreviewUrl: null,
            voiceCompanionText: '',
            // The paid Meta voice skill keeps one continuous performance, then
            // inserts real silence at aligned thought boundaries.
            voiceThoughtPausesMs: personalVoiceNoteMode
                ? [1700, 2400, 1500, 1000]
                : [],
            voiceRenderMode: personalVoiceNoteMode ? 'single_performance_aligned_pauses_v1' : '',
            model: 'deterministic_paid_meta_conversation_v2',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    if (PAID_META_GOAL_SIGNAL_RE.test(message)
        && hasGoal
        && (!hasBlocker || hasRecentPaidMetaGoalQuestion(history))) {
        const proofReply = buildMetaAdGoalProofReply(message, { flowVariant });
        if (!allowVideoAttachment || broadFlow) proofReply.videoAttachmentUrl = null;
        if (!allowVideoAttachment) proofReply.imageAttachmentUrl = null;
        return proofReply;
    }

    if (['problem_qualified', 'offer_ready'].includes(commercialStage) && PAID_META_NEXT_STEP_RE.test(message)) {
        const joined = broadFlow
            ? `The next step is getting the right level of support around the problem you've just described.\n\nWould you prefer a guided six-week kickstart, or hands-on plan changes every week?`
            : `Balance Foundations is the best starting point here. It's one $149 payment for the complete six-week curriculum, with one weekly check-in and plan review from me.\n\nAre you keen to have a quick look inside the app?`;
        return {
            chunks: [joined],
            joined,
            model: 'deterministic_paid_meta_conversation_v1',
            replyMode: 'campaign_sales_progression',
            maxChunks: 1,
            error: null,
            flowVariant,
        };
    }

    return null;
}

function shouldApplyDeterministicPaidMetaReplyOverride(draft = null) {
    if (!draft) return false;
    // Only exact destinations are deterministic. Ordinary conversation copy is
    // model-written from the complete episode and current unanswered batch.
    return draft.replyMode === 'campaign_buyer_handoff'
        || draft.replyMode === 'campaign_app_preview_handoff';
}

function shouldUseOutboundSyntheticVoice({ personalVoicePlan = {}, metaAdConversationFastLane = false } = {}) {
    // Paid Facebook/Instagram ad conversations stay in text. Synthetic voice
    // added friction and made the sales bridge harder to review. Client and
    // organic-lead voice lanes remain unchanged.
    if (metaAdConversationFastLane) return false;
    return personalVoicePlan.syntheticVoiceForbidden !== true
        && personalVoicePlan.useSyntheticVoice === true;
}

function restoreCoalescedPaidMetaVoiceDraft({
    draft,
    existingPendingData = {},
    outboundVoiceMessage = false,
    metaAdConversationFastLane = false,
    metaAdOpeningTurn = false,
    metaAdGoalReplyTurn = false,
    currentMessage = '',
    qualifier = {},
    history = [],
    flowVariant = 'plant_based_control',
    checkoutUrl = '',
    appPreviewUrl = '',
    allowVideoAttachment = false,
} = {}) {
    if (metaAdConversationFastLane) return draft;
    const inheritedVoice = existingPendingData?.outbound_voice_message === true;
    if (!inheritedVoice
        || outboundVoiceMessage
        || !metaAdConversationFastLane
        || metaAdOpeningTurn
        || metaAdGoalReplyTurn) {
        return draft;
    }

    const restored = buildDeterministicPaidMetaConversationReply({
        currentMessage,
        qualifier,
        history,
        flowVariant,
        checkoutUrl,
        appPreviewUrl,
        personalVoiceNoteMode: true,
        allowVideoAttachment,
    });
    return Array.isArray(restored?.voiceThoughtPausesMs) && restored.voiceThoughtPausesMs.length
        ? restored
        : draft;
}

function removePaidMetaBlockerVoiceGreeting({
    draft,
    outboundVoiceMessage = false,
    outboundVoiceMessageReason = '',
    metaAdConversationFastLane = false,
    flowVariant = 'plant_based_control',
} = {}) {
    if (!draft
        || !outboundVoiceMessage
        || !metaAdConversationFastLane
        || flowVariant !== 'plant_based_control'
        || !['lead_shared_goal_blocker', 'lead_shared_consistency_blocker'].includes(String(outboundVoiceMessageReason || ''))) {
        return draft;
    }

    const joined = String(draft.joined || '').trim();
    if (!joined) return draft;
    const greetingPattern = /^(?:Hey,?\s+)?(?:how are ya|how are you|how(?:'s| is) it going|how ya going)[.!?]*\s*(?:\n\s*\n|\s+)/i;
    const withoutGreeting = joined.replace(greetingPattern, '').trim();
    if (withoutGreeting === joined) return draft;
    const chunks = Array.isArray(draft.chunks) && draft.chunks.length
        ? [String(draft.chunks[0] || '').replace(greetingPattern, '').trim(), ...draft.chunks.slice(1)]
        : [withoutGreeting];
    return {
        ...draft,
        chunks,
        joined: withoutGreeting,
        voiceThoughtPausesMs: Array.isArray(draft.voiceThoughtPausesMs) && draft.voiceThoughtPausesMs.length
            ? draft.voiceThoughtPausesMs.slice(1)
            : draft.voiceThoughtPausesMs,
    };
}

function getAutoDmHoldReason({ mediaReview, contextReview, onboardingPhase, draft, draftReview, challengeOfferWarning, currentMessage, qualifier, leadStage, linkedUserId, meaningfulLeadReplyCount, contextBypass, cocosContextBypass, alertData, allowTestLaneDraftReviewWarning = false, allowBalanceLeadDraftReviewWarning = false }) {
    const effectiveContextBypass = contextBypass || cocosContextBypass;
    const verifiedPaidMetaProgression = /^deterministic_paid_meta_(?:conversation|guided_sales|handoff)_v\d+/i.test(String(draft?.model || ''))
        && ['campaign_sales_progression', 'campaign_buyer_handoff', 'campaign_app_preview_handoff'].includes(String(draft?.replyMode || ''));
    const verifiedGuaranteedPaidMetaOffer = draft?.paidMetaGuaranteedContract === true
        && draft?.replyMode === 'campaign_sales_progression';
    const metaAdSensitiveHold = getMetaAdSensitiveHoldReason({ alertData, currentMessage });
    if (metaAdSensitiveHold) return metaAdSensitiveHold;
    const appProblemHold = getAppProblemAutoSendHoldReason({
        currentMessage,
        draftText: draft?.joined || '',
        alertData,
    });
    if (appProblemHold) return appProblemHold;
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
    const activeChallengeOfferWarning = challengeOfferWarning?.code === 'challenge_offer'
        && !isChallengeOfferWarningText(draft?.joined || '')
        ? null
        : challengeOfferWarning;
    if (activeChallengeOfferWarning?.required && !isPaidMetaBuyerIntentOfferReplyAllowed({
        alertData,
        challengeOfferWarning: activeChallengeOfferWarning,
        currentMessage,
        draft,
        draftReview,
        linkedUserId,
    })) {
        return {
            code: 'challenge_offer',
            label: `${activeChallengeOfferWarning.label || 'coaching invite'} needs timing review`,
        };
    }
    const verifiedBroadPaidMetaGoalToBlocker = isVerifiedBroadPaidMetaGoalToBlockerMove({
        draft,
        currentMessage,
        flowVariant: String(alertData?.offer_flow_variant || ''),
        metaAdConversationFastLane: alertData?.meta_ad_conversation_fast_lane === true,
    });
    if (isUnsafeStockDiscoveryQuestion(draft.joined) && !verifiedBroadPaidMetaGoalToBlocker) {
        return {
            code: 'stock_question',
            label: 'stock discovery question needs Shannon review',
        };
    }
    if (!verifiedPaidMetaProgression
        && !verifiedGuaranteedPaidMetaOffer
        && draft?.appPreviewHandoff !== true
        && isPrematureChallengeInvite({ draftText: draft.joined, currentMessage, qualifier, leadStage, linkedUserId, leadReplyCount: meaningfulLeadReplyCount })) {
        return {
            code: 'premature_challenge_invite',
            label: 'coaching invite needs human readiness first',
        };
    }
    const nonBlockingStyleWarning = (allowTestLaneDraftReviewWarning
        || allowBalanceLeadDraftReviewWarning
        || alertData?.meta_ad_style_warning_safe_after_sanitize === true)
        && isNonBlockingDraftStyleWarning(draftReview);
    if (draftReview
        && !isDraftReviewAutoSendSafe(draftReview)
        && !effectiveContextBypass?.allowed
        && !nonBlockingStyleWarning
        && !verifiedPaidMetaProgression
        && !verifiedGuaranteedPaidMetaOffer) {
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
// The retired $99 lifetime-preview export remains disabled. The current
// Foundations proof video is offer-agnostic and is attached separately.
const FOUNDERS_PASS_APP_PREVIEW_URL = '';
const {
    ALLY_WEIGHT_LOSS_PROOF_URL,
    GEN_STRENGTH_CONFIDENCE_PROOF_URL,
    BEC_KIRSTY_SHARED_MOMENTUM_PROOF_URL,
    DANI_RECOMPOSITION_PROOF_URL,
    BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
    isBalanceFoundationsAppProofVideoUrl,
    maySendDraftImageAttachment,
    maySendDraftVideoAttachment,
    resolveBalanceFoundationsAppProofVideoUrl,
    resolvePaidMetaTransformationProof,
} = require('./_lib/paid-meta-proof-media');
const FOUNDERS_PASS_CHECKOUT_URL = 'https://plantbased-balance.org/founders';
const FOUNDERS_PASS_BROAD_CHECKOUT_URL = 'https://future-balance.netlify.app/fitness';
function buildDraftVideoAttachmentData(draft = {}) {
    const url = String(draft?.videoAttachmentUrl || '').trim();
    return {
        draft_video_attachment_url: /^https:\/\/[^\s]+\.mp4(?:[?#][^\s]*)?$/i.test(url)
            ? url
            : undefined,
    };
}

function buildDraftImageAttachmentData(draft = {}) {
    const url = String(draft?.imageAttachmentUrl || '').trim();
    return {
        draft_image_attachment_url: /^https:\/\/[^\s]+\.(?:png|jpe?g|webp)(?:[?#][^\s]*)?$/i.test(url)
            ? url
            : undefined,
    };
}

function resolveMetaAdFlowVariant({ customData = {}, currentMessage = '', acquisitionMode = '' } = {}) {
    const resolvedAcquisitionMode = acquisitionMode || resolveIgAcquisitionMode({ customData });
    if (!isPaidMetaAcquisitionMode(resolvedAcquisitionMode)) return 'plant_based_control';
    // There is one live paid-Meta conversation route. Legacy stored variants,
    // referral wording and ad IDs remain attribution evidence only and must not
    // revive the retired plant-based control path.
    return 'broad_pain';
}

function buildMetaAdCheckoutUrl({ customData = {}, flowVariant = '', currentMessage = '', acquisitionMode = '' } = {}) {
    const resolvedAcquisitionMode = acquisitionMode || resolveIgAcquisitionMode({ customData });
    const resolvedVariant = isPaidMetaAcquisitionMode(resolvedAcquisitionMode)
        ? 'broad_pain'
        : 'plant_based_control';
    const baseUrl = resolvedVariant === 'broad_pain'
        ? FOUNDERS_PASS_BROAD_CHECKOUT_URL
        : FOUNDERS_PASS_CHECKOUT_URL;
    const routing = customData?.current_inbound_routing || {};
    const attribution = customData?.meta_ad_attribution || {};
    const adId = String(routing.ad_id || attribution.ad_id || '').trim();
    if (!/^\d{6,30}$/.test(adId)) return baseUrl;
    try {
        return `${baseUrl}/${BigInt(adId).toString(36)}`;
    } catch (_) {
        return baseUrl;
    }
}

function foundersPassCheckoutUrlForMessage(message = '', customData = {}, flowVariant = '', acquisitionMode = '') {
    return buildMetaAdCheckoutUrl({ customData, flowVariant, currentMessage: message, acquisitionMode });
}

const META_AD_CURRICULUM_QUESTION_RE = /\b(?:what|which|how|can|could|do|does).{0,40}\b(?:learn|teach|cover|curriculum|lessons?|week[ -]?by[ -]?week|happens? (?:each|every) week|the six weeks)\b|\btell me\b.{0,30}\b(?:course|curriculum|lessons?|six weeks)\b|\b(?:course|curriculum|lessons?)\b.{0,30}\b(?:include|inside|cover|work)\b/i;

function resolveMetaAdFirstReplyIntent(currentMessage = '') {
    const text = String(currentMessage || '').toLowerCase().replace(/[’]/g, "'");
    if (/^(?:what(?:'s| is) (?:the )?)?(?:price|cost)(?: of (?:it|this|the (?:pass|program)))?[!?.\s]*$/.test(text)) return 'price';
    if (META_AD_CURRICULUM_QUESTION_RE.test(text)) {
        return 'curriculum';
    }
    if (/\b(?:do you (?:offer|have)|is there|can i get)\b.{0,35}\bpersonali[sz]ed\b.{0,35}\b(?:coaching|plans?)\b|\bpersonali[sz]ed\b.{0,35}\b(?:coaching|plans?)\b/.test(text)) {
        return 'personalised_coaching';
    }
    if (/\b(?:how does|how would|what(?:'s| is)).{0,35}\b(?:support|accountability)\b|\b(?:support|accountability)\b.{0,35}\b(?:work|included)\b/.test(text)) return 'accountability';
    if (/right for me|would this suit|is this for me|good fit|would it work for me/.test(text)) return 'fit';
    if (/do i need to (?:already )?be plant[ -]?based|already plant[ -]?based|not plant[ -]?based|vegan already|already vegan/.test(text)) {
        return 'plant_based_requirement';
    }
    if (/\b(i'?m in|im in|i(?:'m| am) ready(?: to (?:start|join|sign up))?|ready to (?:start|join|sign up)|let'?s do it|lets do it|sign me up|save me a spot|send (?:me )?(?:the )?link|how do i join|where do i join|how can i join|can i join|start now|join now)\b/.test(text)) {
        return 'ready';
    }
    if (/\b(what(?:'s| is) (?:actually )?included|what do i get|inclusions?|details|tell me more|show me what(?:'s| is) included)\b/.test(text)) {
        return 'inclusions';
    }
    return 'overview';
}

const META_AD_IDENTITY_QUESTION_RE = /\b(are you (?:an? )?(?:ai|bot|robot|real|human)|is this (?:an? )?(?:ai|bot)|am i talking to|who is this)\b/i;
// Unlinked leads still receive a normal, non-diagnostic reply when they
// mention pregnancy, postpartum goals, injury, pain, hospital history, or
// body-image language. Only explicit suicide or self-harm wording is a hard hold.
const META_AD_SAFETY_OR_MEDICAL_RE = /\b(suicid\w*|self[- ]?harm\w*|kill(?:ing)? myself)\b/i;
const META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE = new RegExp(
    `${META_AD_IDENTITY_QUESTION_RE.source}|${META_AD_SAFETY_OR_MEDICAL_RE.source}`,
    'i'
);
const META_AD_FIRST_REPLY_OPT_OUT_RE = /^(?:stop|unsubscribe|leave me alone|remove me)[.!?\s]*$|\b(?:stop|do not|don['\u2019]?t)\s+(?:messaging|contacting|sending|replying|dm(?:ing)?)(?:\s+me)?\b/i;
const META_AD_QUESTION_FATIGUE_RE = /\b(?:i (?:already|just) answered (?:that|this)|already answered (?:that|this)|you(?:'ve| have) already asked (?:that|this)|you asked me (?:that|this) already|asked me (?:that|this) already|i (?:already )?told you (?:that|this) already)\b/i;

function shouldUseDeterministicMetaAdFirstReply(currentMessage = '') {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!message
        || META_AD_FIRST_REPLY_OPT_OUT_RE.test(message)
        || META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE.test(message)) {
        return false;
    }

    const normalized = message.toLowerCase().replace(/[\u2018\u2019]/g, "'");
    if (/^balance[!?.\s]*$/i.test(message)) return true;
    if (/\bfounders?\s+pass\b/i.test(message)) return true;
    if (META_AD_CURRICULUM_QUESTION_RE.test(normalized)) return true;
    if (/\b(what(?:'s| is) (?:actually )?included|what do i get|inclusions?|details|tell me more|show me what(?:'s| is) included)\b/i.test(normalized)) return true;
    if (/\b(?:do you (?:offer|have)|is there|can i get)\b.{0,35}\bpersonali[sz]ed\b.{0,35}\b(?:coaching|plans?)\b|\bpersonali[sz]ed\b.{0,35}\b(?:coaching|plans?)\b/i.test(normalized)) return true;
    if (/\b(do i need to (?:already )?be plant[ -]?based|already plant[ -]?based|not plant[ -]?based|vegan already|already vegan)\b/i.test(normalized)) return true;
    if (/\b(right for me|would this suit|is this for me|good fit|would it work for me)\b/i.test(normalized)) return true;
    if (/\b(i'?m in|im in|i(?:'m| am) ready(?: to (?:start|join|sign up))?|ready to (?:start|join|sign up)|let'?s do it|sign me up|save me a spot|send (?:me )?(?:the )?link|how do i join|where do i join|how can i join|can i join|start now|join now)\b/i.test(normalized)) return true;
    if (/^(?:what(?:'s| is) (?:the )?)?(?:price|cost)(?: of (?:it|this|the (?:pass|program)))?[!?.\s]*$/i.test(normalized)) return true;
    return /\b(?:what|which|how much|is there|do (?:i|you)|does it|will i|can i|get|include|offer|provide)\b.{0,55}\b(?:support|accountability)\b/i.test(normalized)
        || /\b(?:support|accountability)\b.{0,55}\b(?:included|work|offer|provide|get)\b/i.test(normalized);
}

function getMetaAdSensitiveHoldReason({ alertData = {}, currentMessage = '' } = {}) {
    if (alertData?.meta_ad_fast_lane !== true) return null;
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (/^(?:stop|unsubscribe|remove me)[!?.\s]*$/i.test(message)
        || /\b(?:stop|do not|don['\u2019]?t)\s+(?:message|messaging|contact|contacting|dm|dming)\s+me\b/i.test(message)
        || /\b(?:leave me alone|remove me from (?:this|your) list)\b/i.test(message)) {
        return { code: 'dm_opt_out', label: 'lead asked not to be messaged' };
    }
    if (META_AD_IDENTITY_QUESTION_RE.test(message)) {
        return { code: 'identity_question', label: 'lead asked who is replying' };
    }
    if (META_AD_SAFETY_OR_MEDICAL_RE.test(message)) {
        return { code: 'safety_or_medical', label: 'explicit suicide or self-harm language needs Shannon' };
    }
    return null;
}

function buildMetaAdFoundersPassFirstReply(currentMessage = '', { customData = {}, flowVariant = '', acquisitionMode = ACQUISITION_MODES.PAID_META } = {}) {
    const resolvedVariant = flowVariant || resolveMetaAdFlowVariant({ customData, currentMessage, acquisitionMode });
    const broadFlow = resolvedVariant === 'broad_pain';
    const intent = resolveMetaAdFirstReplyIntent(currentMessage);
    const checkoutUrl = foundersPassCheckoutUrlForMessage(currentMessage, customData, resolvedVariant, acquisitionMode);
    const accessLine = broadFlow
        ? 'six weeks of the Balance app and community.'
        : 'six weeks of the Balance app and plant-based community.';
    const supportScope = `It's one AU$149 payment for the full six weeks. You get the six-week Foundations course, ${accessLine} It includes one weekly check-in plus workout and food review and adjustments with me, and it doesn't renew automatically.`;
    const plantBasedOpeningQuestion = 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?';
    let answer;
    let chunks;
    const directCheckoutIntent = hasDirectPaidMetaCheckoutIntent(currentMessage);
    const broadGoalKnown = broadFlow && PAID_META_FITNESS_GOAL_RE.test(String(currentMessage || ''));
    const broadBlockerKnown = broadFlow && (
        isPaidMetaStrongBlocker(currentMessage)
        || isPaidMetaConcreteBlocker(currentMessage)
        || PAID_META_BROAD_BLOCKER_RE.test(String(currentMessage || ''))
    );
    if (broadFlow && directCheckoutIntent) {
        answer = `Yep, you can get started here: ${checkoutUrl}`;
    } else if (broadFlow && broadGoalKnown && broadBlockerKnown) {
        chunks = buildPaidMetaTailoredOfferChunks(currentMessage, currentMessage, resolvedVariant);
    } else if (broadFlow && broadGoalKnown) {
        answer = buildPaidMetaGoalToBlockerText(currentMessage);
    } else if (broadFlow && intent === 'plant_based_requirement') {
        answer = `No, you do not need to be. Balance lets you record your dietary preferences so the food side can fit you. What's the main change you'd like to make over the next six weeks?`;
    } else if (broadFlow && intent === 'price') {
        answer = `${supportScope}\n\nWhat's the main change you'd like to make over the next six weeks?`;
    } else if (broadFlow && intent === 'accountability') {
        answer = `You check in inside Balance and I can see what the week actually looked like, then I give you the next bit of direction and adjust your training or food where needed. What's the main change you'd like to make over the next six weeks?`;
    } else if (broadFlow && intent === 'personalised_coaching') {
        answer = `Yeah, I do. Balance Foundations is a six-week setup inside the app with a workout program, food support and one weekly review with me. What's the main change you'd like to make over the next six weeks?`;
    } else if (broadFlow && intent === 'curriculum') {
        answer = `Yeah. Week 1 is why change feels hard, week 2 is working with your energy, week 3 is building a rhythm that sticks, week 4 takes the fight out of food, week 5 makes progress easier to repeat, and week 6 builds your sustainable way forward. You apply it through your Weekly Goals, workout program and nutrition setup, with me reviewing your training and food each week. What's the main change you'd like to make over the next six weeks?`;
    } else if (broadFlow) {
        const directAnswer = intent === 'inclusions'
            ? 'Yeah, Balance Foundations combines the six-week course, a workout program built around your week, nutrition support fitted to your preferences, Weekly Goals, app/community access and one weekly training and food review with me.'
            : 'Hey, yeah of course. Balance Foundations is a six-week fitness setup inside the app, with me helping you build a plan around your real week.';
        answer = `${directAnswer} What's the main change you'd like to make over the next six weeks?`;
    } else if (intent === 'fit' || intent === 'overview') {
        answer = `Hey, yeah of course. The Founders Pass is for our six-week plant-based fitness program inside Balance. ${plantBasedOpeningQuestion}`;
    } else if (intent === 'plant_based_requirement') {
        answer = `Not at all. Plenty of people start while they're just trying to eat more plant-based. What does your food look like at the moment?`;
    } else if (intent === 'personalised_coaching') {
            answer = `Hey, yeah I do. Balance Foundations is our six-week plant-based fitness program inside the app, plus a weekly check-in where I review and adjust your training and food. ${plantBasedOpeningQuestion}`;
    } else if (intent === 'accountability') {
        answer = `You check in inside Balance and I can see what the week actually looked like, then I reply with the next bit of direction and a nudge if things are slipping. It's personal support from me, not just app reminders.`;
    } else if (intent === 'price') {
        answer = `${supportScope}\n\nIf you tell me what you're trying to change, I can show you the part that would matter most for you.`;
    } else if (intent === 'ready') {
        answer = `Love it. ${supportScope}\n\nYou can see the quick setup and start here: ${checkoutUrl}`;
    } else if (intent === 'inclusions') {
        answer = broadFlow
                ? `Yeah, Balance Foundations is a six-week curriculum inside the app, with me supporting you, plus training, food support and the community all together. What's the main thing you're trying to change with your fitness right now?`
                : `Hey, yeah. Balance Foundations is our six-week plant-based fitness program inside the app, with me supporting you, plus training, plant-based food support and the community all together. ${plantBasedOpeningQuestion}`;
    }
    chunks = Array.isArray(chunks) ? chunks : [answer].filter(Boolean);
    return {
        chunks,
        joined: chunks.join('\n\n'),
        model: 'deterministic_meta_ad_founders_pass_v5',
        replyMode: 'campaign_first_reply',
        maxChunks: chunks.length,
        error: null,
        imageCount: 0,
        audioCount: 0,
        videoCount: 0,
        reelContextCount: 0,
        reelThumbnailCount: 0,
        mediaDecode: {},
        flowVariant: resolvedVariant,
        firstReplyIntent: intent,
        checkoutUrl: directCheckoutIntent ? checkoutUrl : null,
        timeline: '',
        conversationEpisode: null,
        currentTurnAnchorBlock: '',
        storyReplyPromptContextBlock: '',
        mediaContextPromptBlock: '',
        learningReelContextBlock: '',
        learningReelReplyAnchorBlock: '',
        learningReelEvidenceBlock: '',
    };
}

const META_AD_GOAL_QUESTION_RE = /what(?:'s| is| are) (?:the )?(?:main thing )?you(?:'re| are)? ?(?:mainly )?trying to change(?: with your fitness)?(?: at the moment| right now)?/i;
const META_AD_STATED_GOAL_RE = /\b(?:lose|losing|drop|dropping|reduce|reducing)\s+(?:about\s+|around\s+|some\s+)?(?:weight|fat|\d{1,2}(?:\.\d+)?\s*(?:kg|kgs|kilograms?|lb|lbs|pounds?))\b|\b(?:get|feel|become)\s+(?:a\s+)?(?:fitter|fit|stronger|leaner|healthier)\b|\b(?:build|gain)\s+(?:some\s+)?(?:strength|muscle)\b/i;

function isMetaAdGoalReplyTurn(history = [], currentMessage = '') {
    const recent = (Array.isArray(history) ? history : [])
        .filter(item => String(item?.text || '').trim())
        .slice(-6);
    const latestOutbound = [...recent].reverse().find(item => item?.direction === 'out');
    if (latestOutbound && META_AD_GOAL_QUESTION_RE.test(String(latestOutbound.text || ''))) return true;
    if (!META_AD_STATED_GOAL_RE.test(String(currentMessage || ''))) return false;
    return !recent.some(item => item?.direction === 'in' && META_AD_STATED_GOAL_RE.test(String(item.text || '')));
}

function buildMetaAdGoalProofReply(currentMessage = '', { flowVariant = 'plant_based_control' } = {}) {
    const rawMessage = String(currentMessage || '').trim();
    const text = rawMessage.toLowerCase();
    const broadFlow = flowVariant === 'broad_pain';
    const weightLossGoal = /weight|fat|lose|losing|lean|tone|confiden|body/.test(text);
    const transformationProof = broadFlow
        ? null
        : resolvePaidMetaTransformationProof({ goalText: rawMessage });
    const courseProof = `Inside Balance, the six-week course turns that into a clear week to follow, with your learning, weekly goals and coaching review in one place.`;
    let bridge;
    if (/accountab|consisten|motivat|routine|habit|stick|on track|fall off|keep going/.test(text)) {
        bridge = `yeah okay, it sounds like the hard part isn't knowing you should do it, it's keeping the week on track once life gets busy. ${courseProof}`;
    } else if (weightLossGoal) {
        bridge = transformationProof
            ? `yeah absolutely, that's a big part of what I help people with. ${transformationProof.introduction}`
            : `yeah absolutely, that's a big part of what I help people with. ${courseProof}`;
    } else if (/strong|strength|muscle|lift|gym|fitter|fitness|run|cardio/.test(text)) {
        bridge = transformationProof
            ? `nice, so the goal is to actually feel stronger and fitter, not just collect another plan. ${transformationProof.introduction}`
            : `nice, so the goal is to actually feel stronger and fitter, not just collect another plan. ${courseProof}`;
    } else if (/food|meal|eat|nutrition|plant|vegan|vegetarian|protein/.test(text)) {
        bridge = broadFlow
            ? `yeah okay, so food structure is the main thing. ${courseProof}`
            : `yeah okay, so plant-based food structure is the main thing. ${courseProof}`;
    } else {
        bridge = `yeah okay, that's helpful. ${courseProof}`;
    }
    return {
        chunks: [bridge],
        joined: bridge,
        model: 'deterministic_meta_ad_goal_proof_v1',
        replyMode: 'campaign_goal_proof',
        maxChunks: 1,
        error: null,
        imageCount: 0,
        audioCount: 0,
        videoCount: 0,
        videoAttachmentUrl: broadFlow || weightLossGoal ? null : FOUNDERS_PASS_APP_PREVIEW_URL,
        imageAttachmentUrl: transformationProof?.imageUrl || null,
        reelContextCount: 0,
        reelThumbnailCount: 0,
        mediaDecode: {},
        flowVariant,
        timeline: '',
        conversationEpisode: null,
        currentTurnAnchorBlock: '',
        storyReplyPromptContextBlock: '',
        mediaContextPromptBlock: '',
        learningReelContextBlock: '',
        learningReelReplyAnchorBlock: '',
        learningReelEvidenceBlock: '',
    };
}

function applyMetaAdGoalProofReply(draft = {}, currentMessage = '', { flowVariant = 'plant_based_control' } = {}) {
    const proof = buildMetaAdGoalProofReply(currentMessage, { flowVariant });
    const chunks = Array.isArray(draft.chunks) && draft.chunks.length > 0
        ? draft.chunks.map(chunk => String(chunk || '').trim()).filter(Boolean)
        : [String(draft.joined || '').trim()].filter(Boolean);
    const joined = chunks.join('\n\n');
    const introducedVideo = /\b(?:here(?:'s| is)|send(?:ing)?|show(?:ing)? you|quick)\b[^.!?\n]{0,80}\b(?:video|tour|look inside|how it works)\b/i.test(joined);
    return {
        ...proof,
        ...draft,
        chunks,
        joined,
        replyMode: proof.replyMode,
        flowVariant: proof.flowVariant,
        imageAttachmentUrl: proof.imageAttachmentUrl && maySendDraftImageAttachment({
            imageUrl: proof.imageAttachmentUrl,
            replyText: joined,
        }) ? proof.imageAttachmentUrl : null,
        videoAttachmentUrl: proof.videoAttachmentUrl && introducedVideo ? proof.videoAttachmentUrl : null,
        model: `${draft.model || 'unknown'}+guided_meta_goal_proof_v1`,
        timeline: draft.timeline || proof.timeline,
        conversationEpisode: draft.conversationEpisode || proof.conversationEpisode,
        currentTurnAnchorBlock: draft.currentTurnAnchorBlock || proof.currentTurnAnchorBlock,
        storyReplyPromptContextBlock: draft.storyReplyPromptContextBlock || proof.storyReplyPromptContextBlock,
        mediaContextPromptBlock: draft.mediaContextPromptBlock || proof.mediaContextPromptBlock,
        learningReelContextBlock: draft.learningReelContextBlock || proof.learningReelContextBlock,
        learningReelReplyAnchorBlock: draft.learningReelReplyAnchorBlock || proof.learningReelReplyAnchorBlock,
        learningReelEvidenceBlock: draft.learningReelEvidenceBlock || proof.learningReelEvidenceBlock,
    };
}

function buildMetaAdFirstReplyApproval({ metaAdFirstInbound = false, draft = null } = {}) {
    if (!metaAdFirstInbound
        || draft?.replyMode !== 'campaign_first_reply'
        || !/^deterministic_meta_ad_founders_pass_v\d+$/.test(String(draft?.model || ''))) return null;
    return {
        required: false,
        code: draft.checkoutUrl ? 'approved_meta_ad_buyer_handoff' : 'approved_meta_ad_first_reply',
        dot: '🟢',
        label: draft.checkoutUrl ? 'approved Meta ad checkout handoff' : 'approved Meta ad first reply',
        reason: draft.checkoutUrl
            ? 'The verified Meta ad lead explicitly asked to join, start, or receive the link, so the attributed checkout handoff is allowed.'
            : 'The verified Meta ad first reply answers the selected prompt without sending a checkout link.',
        detected_at: new Date().toISOString(),
    };
}

function buildPaidMetaConversationApproval({
    metaAdConversationFastLane = false,
    draft = null,
    currentMessage = '',
    linkedUserId = null,
    qualifier = {},
    history = [],
} = {}) {
    const message = String(currentMessage || '').trim();
    const deterministicProgression = metaAdConversationFastLane
        && !linkedUserId
        && ['campaign_sales_progression', 'campaign_buyer_handoff', 'campaign_app_preview_handoff'].includes(String(draft?.replyMode || ''))
        && /^deterministic_paid_meta_(?:conversation|guided_sales|handoff)_v\d+(?:\+[a-z0-9_-]+)*$/i.test(String(draft?.model || ''))
        && !META_AD_FIRST_REPLY_OPT_OUT_RE.test(message)
        && !META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE.test(message)
        && (draft?.replyMode !== 'campaign_buyer_handoff' || isPaidMetaContextualCheckoutIntent(message))
        && (draft?.replyMode !== 'campaign_app_preview_handoff'
            || (draft?.appPreviewHandoff === true
                && isMetaAppPreviewUrl(draft?.appPreviewUrl)
                && (isExplicitPaidMetaPreviewRequest(message)
                    || isApprovedPaidMetaAppPreviewMoment({ currentMessage: message, qualifier })
                    || (isExplicitPaidMetaPreviewAcceptance(message)
                        && hasRecentCompletePaidMetaOffer(history)))));
    if (!deterministicProgression) return null;
    return {
        required: false,
        code: draft.replyMode === 'campaign_buyer_handoff'
            ? 'approved_meta_ad_conversation_buyer_handoff'
            : 'approved_meta_ad_sales_progression',
        dot: '🟢',
        label: 'approved paid Meta conversation progression',
        reason: 'The verified paid Meta lead is on a deterministic, safety-gated sales-progression step.',
        detected_at: new Date().toISOString(),
    };
}

function buildApprovedMetaAdFirstReplyHandoffData({ approval, draft, leadStage, linkedUserId, threadId, manychatMessageId } = {}) {
    if (!approval
        || approval.required === true
        || !/^approved_meta_ad_/.test(String(approval.code || ''))
        || draft?.replyMode !== 'campaign_first_reply'
        || !isUnlinkedAcquisitionLeadForLinkGate({ leadStage, linkedUserId })) {
        return null;
    }

    return {
        lead_onboarding_handoff: false,
        needs_you_required: false,
        operator_queue: null,
        client_manager_review_required: false,
        style_note: 'Verified deterministic Meta ad first reply is approved for automatic sending.',
        signup_link_manual_only: false,
        signup_link_handoff_url: draft.checkoutUrl || undefined,
        approved_link_auto_sendable: !!draft.checkoutUrl,
        meta_ad_first_reply_preapproved: true,
        codex_review: {
            source: 'ig-instant-draft',
            decision: approval.code,
            queue: null,
            needs_shannon_approval: false,
            reason: approval.reason,
            evidence_ids: [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : ''].filter(Boolean),
            reviewed_at: new Date().toISOString(),
        },
    };
}

function shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression({ approval, draft } = {}) {
    return approval?.required === false
        && approval?.code === 'approved_meta_ad_sales_progression'
        && draft?.replyMode === 'campaign_sales_progression'
        && !/https?:\/\//i.test(String(draft?.joined || ''));
}

const META_AD_CARD_ATTACHMENT_RE = /^\[attachment:https:\/\/lookaside\.fbsbx\.com\/ig_messaging_cdn\/?[^\]]*\]$/i;

function isMetaAdCardAttachmentTransportArtifact({
    currentMessage = '',
    metaAdFirstInbound = false,
    internalMetaAdConversationTestLane = false,
} = {}) {
    return META_AD_CARD_ATTACHMENT_RE.test(String(currentMessage || '').trim())
        && (metaAdFirstInbound || internalMetaAdConversationTestLane);
}

function filterMetaAdCardAttachmentHistory({
    history = [],
    currentMessage = '',
    metaAdFirstInbound = false,
    metaAdConversationFastLane = false,
} = {}) {
    const messages = Array.isArray(history) ? history : [];
    if (!metaAdFirstInbound && !metaAdConversationFastLane) return messages;
    const currentIsExplicitOffer = shouldUseDeterministicMetaAdFirstReply(currentMessage);

    return messages.filter((message, index) => {
        if (String(message?.direction || '') !== 'in'
            || !META_AD_CARD_ATTACHMENT_RE.test(String(message?.text || '').trim())) {
            return true;
        }

        if (metaAdFirstInbound && currentIsExplicitOffer) return false;

        const nextInbound = messages.slice(index + 1).find(candidate => candidate?.direction === 'in');
        if (!nextInbound || !shouldUseDeterministicMetaAdFirstReply(nextInbound.text)) return true;
        const attachmentAt = Date.parse(message.created_at || '');
        const nextInboundAt = Date.parse(nextInbound.created_at || '');
        return !Number.isFinite(attachmentAt)
            || !Number.isFinite(nextInboundAt)
            || nextInboundAt < attachmentAt
            || (nextInboundAt - attachmentAt) > 5000;
    });
}

const META_AD_UNRESOLVED_PHOTO_MARKER_RE = /^(?:📷\s*)?(?:photo|\[photo\])$/i;

function suppressUnresolvedMetaAdCardPhoto({
    inboundMessageBatch = [],
    currentMessage = '',
    metaAdFastLane = false,
    maxGapMs = 5 * 60 * 1000,
} = {}) {
    const batch = Array.isArray(inboundMessageBatch) ? inboundMessageBatch : [];
    if (!metaAdFastLane || !shouldUseDeterministicMetaAdFirstReply(currentMessage)) {
        return { batch, suppressedCount: 0 };
    }
    const current = [...batch].reverse().find(item => item?.is_current === true)
        || batch[batch.length - 1]
        || null;
    const currentAt = Date.parse(current?.created_at || '');
    let suppressedCount = 0;
    const filtered = batch.filter(item => {
        if (!item || item === current || item.is_current === true) return true;
        const text = String(item.text || item.message || '').trim();
        const media = Array.isArray(item.media) ? item.media : [];
        if (!META_AD_UNRESOLVED_PHOTO_MARKER_RE.test(text) || media.length > 0) return true;
        const itemAt = Date.parse(item.created_at || '');
        const withinGap = Number.isFinite(currentAt)
            && Number.isFinite(itemAt)
            && currentAt >= itemAt
            && (currentAt - itemAt) <= maxGapMs;
        if (!withinGap) return true;
        suppressedCount += 1;
        return false;
    });
    return { batch: filtered, suppressedCount };
}

function buildApprovedDeterministicMetaAdFirstReplyReview({
    metaAdFirstInbound = false,
    metaAdGoalReplyTurn = false,
    metaAdConversationFastLane = false,
    draft = null,
    approval = null,
    linkedUserId = null,
    mediaReview = null,
    contextReview = null,
    currentMessage = '',
    qualifier = {},
    history = [],
} = {}) {
    const message = String(currentMessage || '').trim();
    const approvedFirstReply = metaAdFirstInbound
        && draft?.replyMode === 'campaign_first_reply'
        && /^deterministic_meta_ad_founders_pass_v\d+$/.test(String(draft?.model || ''))
        && approval
        && approval.required !== true
        && /^approved_meta_ad_/.test(String(approval.code || ''))
        && shouldUseDeterministicMetaAdFirstReply(message);
    const deterministicGoalProof = (metaAdGoalReplyTurn || metaAdConversationFastLane)
        && draft?.replyMode === 'campaign_goal_proof'
        && /^deterministic_meta_ad_goal_proof_v\d+(?:\+[a-z0-9_-]+)*$/i.test(String(draft?.model || ''));
    const approvedGoalProof = deterministicGoalProof;
    const approvedConversationProgression = metaAdConversationFastLane
        && ['campaign_sales_progression', 'campaign_buyer_handoff', 'campaign_app_preview_handoff'].includes(String(draft?.replyMode || ''))
        && /^deterministic_paid_meta_(?:conversation|guided_sales|handoff)_v\d+(?:\+[a-z0-9_-]+)*$/i.test(String(draft?.model || ''))
        && (draft?.replyMode !== 'campaign_buyer_handoff' || isPaidMetaContextualCheckoutIntent(message))
        && (draft?.replyMode !== 'campaign_app_preview_handoff'
            || (draft?.appPreviewHandoff === true
                && isMetaAppPreviewUrl(draft?.appPreviewUrl)
                && isApprovedPaidMetaAppPreviewMoment({ currentMessage: message, qualifier })));
    const contextReasons = Array.isArray(contextReview?.reasons)
        ? contextReview.reasons.map(reason => String(reason || '').trim()).filter(Boolean)
        : [];
    const safeFirstReplyContextWarning = approvedFirstReply
        && contextReview?.required === true
        && contextReview?.first_captured_lead_reply === true
        && contextReasons.length > 0
        && contextReasons.every(reason => [
            'first_captured_reply_with_hidden_context',
            'reference_heavy_reply_without_tracked_context',
        ].includes(reason));
    if ((!approvedFirstReply && !approvedGoalProof && !approvedConversationProgression)
        || linkedUserId
        || mediaReview?.required === true
        || (contextReview?.required === true && !safeFirstReplyContextWarning)
        || META_AD_FIRST_REPLY_OPT_OUT_RE.test(message)
        || META_AD_FIRST_REPLY_REVIEW_REQUIRED_RE.test(message)) {
        return null;
    }

    return {
        verdict: 'pass',
        confidence: 1,
        summary: approvedGoalProof
            ? 'Approved deterministic Meta ad goal reflection and proof.'
            : (approvedConversationProgression
                ? 'Approved deterministic paid Meta sales-progression reply.'
                : 'Approved deterministic Meta ad first reply.'),
        issues: [],
        suggested_fix: '',
        context_loss_suspected: false,
        notification_required: false,
        notification_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewer_model: approvedGoalProof
            ? 'deterministic-meta-ad-goal-proof-approval'
            : (approvedConversationProgression
                ? 'deterministic-paid-meta-conversation-approval'
                : 'deterministic-meta-ad-first-reply-approval'),
        context_warning_overridden: safeFirstReplyContextWarning || undefined,
    };
}

const META_AD_FUNNEL_CONTEXT = `
LEAD ACQUISITION CONTEXT:
The current paid Meta campaign promotes one public offer: Balance Foundations. It is one AUD $149 payment for the full six weeks and does not auto-renew. It includes a clear six-week curriculum inside Balance, six weeks of app/community access, and one weekly check-in plus workout/food review and adjustments from Shannon. Do not rename this paid-ad offer Starter Coaching or switch a paid-ad lead to a weekly package merely because Meta's old prompt says "personalized coaching plans". The default close happens inside DMs. A short call is an escalation only when the lead explicitly wants to talk, remains genuinely uncertain after a clear DM explanation, or the situation needs Shannon's judgement. Balance no longer uses a free challenge as its acquisition or conversion path. The acquisition-mode block above is authoritative about whether Shannon initiated the relationship or the lead knowingly entered from a Meta ad. Every verified paid-Meta lead uses this one neutral general-fitness route. Legacy plant-based variant fields, referral text and old ad prompts remain attribution or conversation context only and never select a different flow. Meta may supply one of the example phrases below as the lead's prefilled opening. Treat it as their ordinary first sentence, not as a questionnaire step. Never restate a menu of options or ask them to choose from buttons. Older ads may still supply prompts such as:
  1. "What's included in the six-week Balance Foundations program?"
  2. "How does the weekly check-in work?"
  3. "Do I need to already be plant-based?"
The legacy prompt "Do you offer personalized coaching plans?" can still arrive from an older live ad. Answer it in the Balance Foundations context: explain the six-week curriculum and Shannon's weekly review, then ask about the lead's goal. Do not route that paid-ad prompt to Starter Coaching.
Also treat as offer inquiry: "founders pass", "founding membership", "plant-based fitness app", "vegan fitness app", "community", "1:1 coaching", "one-on-one coaching", "starter coaching", "online coaching", "what's included", "your program" when they clearly mean the offer, "saw your ad", "wanna join", "work with you", "send me the link", "I'm in", or "I need help / I don't know what I'm doing". Do NOT treat vague "keen", "interested", "yeah sounds good", or friendly banter as offer intent unless the same message clearly points at the offer/program/link.

GUIDED RESPONSE CONTRACT FOR EVERY PAID-META TURN:
- The funnel supplies the objective, verified offer facts, and the next useful decision. It never supplies a script to paste.
- Write each ordinary reply fresh from the complete newest inbound turn. First answer or reflect the sharpest exact detail the person actually gave, using their meaning rather than a generic acknowledgement. Then make the smallest useful next move.
- A reply must still make sense if the funnel instructions are hidden. Never use "Gotcha" or "that makes sense" as the entire reaction before jumping to a stock question.
- Do not force the planned qualifier when their message offers a more natural thread. Rewrite the next move around their nouns, frequency, timing, reason, concern, or side question.
- Keep exact checkout links, app-access links, safety holds, price, duration, and inclusions factual. Everything around those facts should still respond to the person.
- If several rapid bubbles arrived, treat them as one message and respond to all meaningful parts without asking them to repeat anything.
- Use one or two short Instagram bubbles when that feels natural. A useful split is the direct acknowledgement or answer first, then the single purposeful question second. Do not force two bubbles on every turn and never split one sentence arbitrarily.
- Never ask whether the lead is vegan or plant-based, how long they have been, or why. If they independently ask about dietary fit, answer that Balance can fit nutrition support to their dietary preferences, then continue the same neutral route.

Important: when there is no prior tracked conversation, do NOT assume the lead started the DM. Most first captured lead messages happen because Shannon commented on or replied to their story/post natively, and that opener is not visible in ManyChat. Their reply may be tiny or ambiguous because they are answering that unseen opener. Treat it as an open door and build rapport from whatever signal exists. Use one light human move, which can be a short statement. Ask a question only when that is clearly the best next text, or when there is no better hook and Shannon has not asked a basic day/week opener yet.

SHANNON FOLLOW-UP QUESTION FINGERPRINT:
- Shannon's real IG follow-ups are usually tiny: a quick acknowledgement, then one concrete question or statement from the exact detail they just gave.
- Good shape: "yeah okay" / "nice as" / "hell yeah" / "fair" + one short question like "why by April?", "how long has this been going on for?", "when did that start?", "what part first?", "where at?", or "how did that go?".
- If the lead gives a bare answer to Shannon's last question, do not ask a new intake bundle. Acknowledge the answer and ask the next narrow thing only if it is useful.
- Shannon rarely stacks questions in normal follow-up. One question is the maximum default, not a requirement. Two questions is only for a clear intake moment. Three or more questions should almost never happen.
- Never hand them two possible answers inside a rapport or qualification question. Ask the live detail plainly and let them describe it in their own words. "how long has this been going on for?" beats "is it your diet or your motivation?"
- Avoid polished therapist/coach questions. Replace "what does that look like for you?", "what kind of difference would that make?", "what usually makes it hard?", "anything in particular making it hectic?", and "how are you finding it?" with a question built from their actual nouns.
- Do not jump from a normal-life answer straight to the challenge. Use the follow-up to understand the blocker, preference, or context first.
- Do not jump from a one-word story/pet/food reaction like "cute", "haha", "nice", an emoji, or a weak story-summary guess into "are you into fitness much too?" or "you training at the moment?". Reply to the story reaction itself, or stop if there is no useful next handle.
- If the lead asks whether this is AI, a bot, automated, or really Shannon, do not draft a public denial and do not continue the sales thread. That must be held for Shannon.

THE OFFERING (for context — never list as a brochure; speak like a friend):
- The FIRST offer for leads in this paid campaign is the paid Balance Foundations program, not a free challenge, standalone custom meal plan, workout program, generic app trial or Starter Coaching.
- The fixed six-week curriculum is: week 1, Why change feels hard; week 2, Work with your energy; week 3, Build a rhythm that sticks; week 4, Take the fight out of food; week 5, Make progress easier to repeat; week 6, Build your sustainable way forward. It combines lessons, practical actions and Weekly Goals with their workout and nutrition setup. Use this detail when they ask what the course teaches, what happens across the weeks, or which part fits their problem. Do not recite the full outline in every pitch.
- The curriculum themes are fixed. The workout program, nutrition setup and Shannon's weekly review are the personalised parts. Never imply that every lesson or the six-week curriculum is individually rewritten for the lead.
- Tailor the coaching explanation around the person's goal, training, food structure and accountability. Dietary preferences belong inside personalised nutrition setup, not paid-ad positioning.
- Keep the public link clean and use ${FOUNDERS_PASS_BROAD_CHECKOUT_URL} for every paid-Meta lead. Do not introduce plant-based, vegan or vegetarian positioning in an ad reply, landing handoff or follow-up unless the lead independently asks about dietary fit. Preserve Meta identifiers on the canonical thread and handoff receipt, never by pasting tracking parameters into the DM.
- For a general ad-attributed "what is it?" or Balance Foundations opener, do not dump the offer or send a raw media URL. Ask only for the desired six-week change, then the real-life blocker, skipping either fact already supplied. Once both are known, explain the matched six-week setup, state the $149/no-renewal terms, and offer the personalised app preview before payment. Send that signed preview immediately when requested or accepted, including after a generic "I'm ready". Only bypass the preview for an explicit request to join, pay, sign up or receive checkout. Only offer a quick call if they say they want to talk it through or remain genuinely uncertain after the clear explanation.
- If they only ask "what's Balance?" or "what's your app?" while also saying they are already training hard or feeling good, answer in one plain beat and make any coaching mention casual. No feature list or link unless they ask for details.
- Once they start, the Balance app gives them the guided kickstart, training and food structure, progress tools and community.
- Outside this paid Meta campaign, the wider package ladder still exists and must not be changed. Inside this paid Meta campaign, keep the conversation focused on Balance Foundations at one $149 payment for the full six weeks. Only discuss another package if the lead explicitly rejects the six-week format and asks for a different ongoing or live-call service.
- Keep it low-pressure. If they are not ready, leave a clean re-entry handle or use App + Community when it genuinely fits. Do not revive a free-challenge funnel.
- Voice notes: when the system supplies a decoded voice-note transcript or media summary, treat it as heard. Reply to the content. Never ask them to resend, repeat, or type the gist of a voice note. If audio is genuinely inaccessible or unintelligible after retries, leave no public voice-note fallback and let the media-review hold/retry path handle it.

RESPONSE PATTERNS (mimic Shannon's actual voice for each prompt):
- "What's actually included?" -> answer the direct ask casually in one short sentence, then ask what they are mainly trying to change. Do not send a signup link from this FAQ click.
- "Do you offer personalized coaching plans?" -> answer yes in the current Balance Foundations context: it has a clear six-week curriculum plus one weekly check-in where Shannon reviews and adjusts training and food. Ask what they are mainly trying to change. Do not mention Starter Coaching or send a signup link from this FAQ branch.
- "What's Balance?" / "what's your app?" -> answer plainly: it is Shannon's fitness app/coaching setup. If their latest training detail gives a natural opening, one casual line is enough: "honestly one weekly check-in would probably help keep that simple if you wanted the coaching details". Do not hardcode that wording, but keep that size and feel. No app feature list or signup link unless they ask what is included or ask for details.
- "How does accountability work?" / "how would you keep me on track?" -> this is a connection moment, not a brochure request. Explain it plainly from Shannon's point of view: they check in and log what is happening, Shannon sees the real week and guides the next move, with a nudge when things start slipping. In PERSONAL VOICE NOTE MODE, make this one connected voice note and do not duplicate the explanation in text. Otherwise use one concise text bubble. Do not tack on another qualifier unless their answer would genuinely change the next step.
- "Is it in person?" / "I'm looking for a local trainer" / "I already have a PT" -> treat this as a preference or compatibility objection. Answer plainly first: Balance Foundations is an online six-week curriculum inside the app, not in-person personal training. Do not push the link yet. Ask whether that would still be useful, or how it would need to fit around their current trainer.
- "Do I need to already be Plant Based?" -> answer plainly that they do not and that nutrition support is fitted to their dietary preferences. Do not turn this into vegan-status discovery.
- "I'm In - save me a spot!" / "let's do it" / "send me the link" -> if they explicitly ask to join, pay, sign up or receive checkout, send ${FOUNDERS_PASS_BROAD_CHECKOUT_URL} with the quick Balance Foundations handoff. A generic "I'm ready" receives the promised personalised preview first. Do NOT ask a Name + Age + Main goal intake bundle.
- "I need help" / "I don't know what I'm doing" / "where do I start?" -> human first: validate the stuck feeling, ask one grounded goal or blocker question if it is still missing, then softly explain that Balance Foundations is the easiest starting point because it gives them the complete six-week curriculum, app/community access and Shannon's weekly review without another weekly bill. Do not sound like a canned invite.
- Warm lead with enough context already shared -> use a low-key bridge instead of endless discovery. Do not write stock lines that say the offer is made for this exact situation. Anchor it to their actual situation in one casual sentence, for example "Balance Foundations could give you a proper six-week starting rhythm without another weekly bill". End by asking if they want the details only when they have not already asked. Do not send the link or app feature rundown until they say yes or ask what is included.

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

function extractMediaSummaryFromDraftRawText(rawText) {
    const candidate = String(rawText || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    if (!candidate) return '';
    try {
        const parsed = JSON.parse(candidate);
        const summary = parsed?.media_summary ?? parsed?.mediaSummary ?? parsed?.visual_summary ?? parsed?.visualSummary;
        return truncate(String(summary || '').replace(/\s+/g, ' ').trim(), 600);
    } catch {
        return '';
    }
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
    leadStage = null,
    linkedUserId = null,
    checkoutUrl = '',
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
        leadStage,
        linkedUserId,
        checkoutUrl,
    });
    const suppressClientLinkHandoff = (chunks) => suppressExistingClientSignupLinkHandoffInDraftChunks(chunks, {
        leadStage,
        linkedUserId,
    });
    const cleaned = splitCoachDraftIntoDmBubbles(
        suppressBareStoryMentionClarifierInDraftChunks(
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
            ),
            { currentMessageText }
        )
            .map(c => stripObviousMediaReceiptPreamble(c, { hasDecodedMedia }))
            .map((c, i) => i === 0
                ? stripLeadingGreeting(c, leadName, { allowGreeting: allowDailyGreeting })
                : stripLeadingGreeting(c, leadName))
            .map(normalizeGeneratedCoachDraftText)
            .filter(Boolean)
    );
    if (cleaned.length) return suppressClientLinkHandoff(repairMissingLink(cleaned)).slice(0, maxChunks);

    // Never let a non-empty model response become a blank Needs You card.
    // If a conservative cleaner stripped the whole thing, keep the model's
    // draft and let Shannon's approval/review gate catch the nuance.
    const unfiltered = splitCoachDraftIntoDmBubbles(
        baseChunks
            .map(c => stripObviousMediaReceiptPreamble(c, { hasDecodedMedia }))
            .map((c, i) => i === 0
                ? stripLeadingGreeting(c, leadName, { allowGreeting: allowDailyGreeting })
                : stripLeadingGreeting(c, leadName))
            .map(normalizeGeneratedCoachDraftText)
            .filter(Boolean)
    );
    return suppressClientLinkHandoff(repairMissingLink(unfiltered)).slice(0, maxChunks);
}

function buildEmptyMediaDraftFallbackChunks({ mediaDecode = {}, currentMessageText = '' } = {}) {
    if (isBareStoryMentionNotificationText(currentMessageText)) {
        return [normalizeGeneratedCoachDraftText('oh hell yeah!')];
    }
    const current = replaceIgMediaMarkers(String(currentMessageText || ''), { photo: 'photo', audio: 'voice note', video: 'video' }).toLowerCase();
    const audioCount = Number(mediaDecode.audio_url_count || mediaDecode.audioUrlCount || 0);
    const photoCount = Number(mediaDecode.photo_url_count || mediaDecode.image_url_count || mediaDecode.photoUrlCount || 0);
    const videoCount = Number(mediaDecode.video_url_count || mediaDecode.videoUrlCount || 0);
    if (audioCount > 0 || /\bvoice note|audio\b/.test(current)) {
        return [];
    }
    if (photoCount > 0 || /\bphoto|image|pic|picture\b/.test(current)) {
        return [normalizeGeneratedCoachDraftText('that photo didn\'t come through clearly on my end. can you send it again?')];
    }
    if (videoCount > 0 || /\bvideo|reel|clip\b/.test(current)) {
        return [normalizeGeneratedCoachDraftText('that video didn\'t come through clearly on my end. can you send it again or type the gist?')];
    }
    return [];
}

function transcriptTextFromMediaDecode(mediaDecode = {}, currentMessageText = '') {
    const transcriptLists = [
        mediaDecode.audio_transcripts,
        mediaDecode.audioTranscripts,
    ];
    for (const list of transcriptLists) {
        if (!Array.isArray(list)) continue;
        const joined = list
            .map(item => String(item?.text || item?.transcript || item || '').trim())
            .filter(Boolean)
            .join('\n');
        if (joined) return joined;
    }
    const markerMatches = [...String(currentMessageText || '').matchAll(/\[voice note #\d+ transcript:\s*([^\]]+)\]/gi)]
        .map(match => String(match[1] || '').trim())
        .filter(Boolean);
    return markerMatches.join('\n');
}

function hasAudioTranscriptDraftContext({ mediaDecode = {}, currentMessageText = '' } = {}) {
    if (transcriptTextFromMediaDecode(mediaDecode, currentMessageText)) return true;
    return Number(mediaDecode.audio_transcript_count || mediaDecode.audioTranscriptCount || 0) > 0;
}

function hasAudioDraftContext({ mediaDecode = {}, currentMessageText = '' } = {}) {
    const current = replaceIgMediaMarkers(String(currentMessageText || ''), { photo: 'photo', audio: 'voice note', video: 'video' }).toLowerCase();
    return Number(mediaDecode.audio_url_count || mediaDecode.audioUrlCount || 0) > 0
        || Number(mediaDecode.audio_inline_count || mediaDecode.audioInlineCount || 0) > 0
        || /\bvoice note|audio\b/.test(current);
}

function isAudioPuntDraftText(value) {
    const text = normalizeCoachDraftText(value).toLowerCase();
    if (!text) return false;
    return /\b(?:i'?ll|i will|i'?m going to|let me|i need to|i can)\s+(?:listen|play|check|open|go through)\b[\s\S]{0,140}\b(?:properly|later|when|then|get back|come back)\b/i.test(text)
        || /\b(?:listen|play|check|open|go through)\s+(?:to\s+)?(?:this|it|your voice note|the voice note)\b[\s\S]{0,120}\b(?:get back|come back)\b/i.test(text)
        || /\b(?:voice note|audio|last note|that note|the note)\b[\s\S]{0,120}\b(?:didn'?t|did not|doesn'?t|does not|couldn'?t|could not|can'?t|cannot)\s+(?:come through|hear|understand|make out|play|open)\b/i.test(text)
        || /\b(?:can|could)\s+you\s+(?:send|type|say|repeat)\b[\s\S]{0,80}\b(?:gist|again|voice note|audio|what you said)\b/i.test(text)
        || /\bwhat\s+(?:were|are)\s+you\s+(?:saying|trying\s+to\s+say)\b/i.test(text);
}

function isAudioPuntDraftChunks(chunks, { mediaDecode = {}, currentMessageText = '' } = {}) {
    if (!hasAudioDraftContext({ mediaDecode, currentMessageText })) return false;
    return (Array.isArray(chunks) ? chunks : [chunks]).some(isAudioPuntDraftText);
}

async function generateAudioTranscriptRecoveryDraft({
    mediaDecode = {},
    leadName,
    channelLabel,
    currentMessageText,
    totalConversationText,
    lastShannonText = '',
    replyMode,
    allowDailyGreeting,
    qualifier,
    leadStage = null,
    linkedUserId = null,
    nativeStoryContextSummary,
} = {}) {
    const transcriptText = transcriptTextFromMediaDecode(mediaDecode, currentMessageText);
    if (!transcriptText) return { chunks: [], rawText: '', model: null, error: 'missing_audio_transcript' };
    const prompt = `The first draft failed by asking the lead to repeat a voice note. Do a corrected ${channelLabel || 'IG'} reply now.

Lead: ${leadName || 'Lead'}
Decoded voice-note transcript. Treat this as authoritative latest inbound evidence:
${truncateTail(transcriptText, 1800)}
${lastShannonText ? `\nShannon's previous message: ${truncate(lastShannonText, 260)}\n` : ''}
Conversation context, oldest to newest:
${truncateTail(totalConversationText || '(no prior tracked context)', 2600)}

Rules:
- Reply to what the voice note actually says.
- Never say the voice note did not come through, never ask them to resend/repeat/type the gist, and never write a listening receipt like "just listened".
- If the newest typed text says "never mind", let the clarification go. Do not ask another clarification question.
- Keep Shannon's casual texting voice. No AI/automation wording, no em-dashes, no literal backslash-n escape sequences.

JSON only:
{"messages":["exact DM text"]}`;
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = {
        maxOutputTokens: Math.max(1024, Math.min(Number(replyMode?.maxOutputTokens) || 1536, 2048)),
        temperature: 0.55,
    };
    let lastError = null;
    for (const attempt of [
        { label: 'vertex-v7-audio-transcript-retry', call: () => callVertexAIModel(contents, generationConfig) },
        { label: 'gemini-audio-transcript-retry', call: () => callGeminiFallback(contents, generationConfig) },
    ]) {
        try {
            const rawText = requireNonEmptyDraftText(await attempt.call(), attempt.label);
            const chunks = finalizeDraftChunksFromRawText(rawText, {
                maxChunks: replyMode?.maxChunks || MAX_CHUNKS,
                leadName,
                currentMessageText,
                qualifier,
                leadStage,
                linkedUserId,
                nativeStoryContextSummary,
                hasDecodedMedia: true,
                allowDailyGreeting,
            });
            if (chunks.length && !isAudioPuntDraftChunks(chunks, { mediaDecode, currentMessageText })) {
                return { chunks, rawText, model: attempt.label, error: lastError };
            }
            lastError = `${attempt.label}: empty or still punted`;
        } catch (err) {
            lastError = `${attempt.label}: ${String(err.message || err).slice(0, 200)}`;
            console.warn('[ig-draft] audio transcript recovery failed:', lastError);
        }
    }
    return { chunks: [], rawText: '', model: null, error: lastError || 'audio_transcript_recovery_empty' };
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
    leadStage = null,
    linkedUserId = null,
    nativeStoryContextSummary,
} = {}) {
    if (!Array.isArray(mediaParts) || mediaParts.length === 0) return { chunks: [], rawText: '', model: null, error: null };
    const prompt = `The full drafting prompt returned an empty reply. Draft the actual next ${channelLabel || 'IG'} DM now.

Lead: ${leadName || 'Lead'}
Latest message marker: ${replaceIgMediaMarkers(currentMessageText || '', { photo: 'photo', audio: 'voice note', video: 'video' })}
${lastShannonText ? `Shannon's previous message: ${truncate(lastShannonText, 260)}\n` : ''}
Conversation context, oldest to newest:
${truncateTail(totalConversationText || '(no prior tracked context)', 2600)}

Attached media below is from the latest unanswered inbound batch. If a voice note is attached, listen to it and reply to what they said. Do not transcribe it. Do not say you listened to, heard, opened, checked, saw, or watched the media. Never ask them to resend, repeat, or type the gist of a voice note. If the audio is genuinely not understandable, return {"messages":[]} so the media-review hold/retry path can handle it internally.

Write in Shannon's casual texting voice with normal phone autocorrect casing. Use contractions so the reply sounds spoken: it's, I'd, wouldn't, don't, can't, you're. Keep it short unless the audio asks for detailed help. No AI/automation wording. No em-dashes. Never type literal backslash-n escape sequences in the reply text. Use normal punctuation instead.

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
                leadStage,
                linkedUserId,
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
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,last_inbound_at,last_outbound_at,custom_data,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier,auto_send_enabled&id=eq.${threadId}&limit=1`
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

function resolveRecentVoiceSince({ cooldownDays = 30, resetAt = '', nowMs = Date.now() } = {}) {
    const cooldownSinceMs = Number(nowMs) - (cooldownDays * 24 * 60 * 60 * 1000);
    const resetAtMs = Date.parse(resetAt || '');
    return new Date(Number.isFinite(resetAtMs) ? Math.max(cooldownSinceMs, resetAtMs) : cooldownSinceMs).toISOString();
}

async function hasRecentOutboundVoiceMessage(threadId, cooldownDays = 30, resetAt = '') {
    if (!threadId) return false;
    const since = resolveRecentVoiceSince({ cooldownDays, resetAt });
    try {
        const rows = await supabaseQuery(
            `ig_messages?select=id&thread_id=eq.${encodeURIComponent(threadId)}&direction=eq.out&source=eq.instagram_graph_voice_send&created_at=gte.${encodeURIComponent(since)}&limit=1`
        );
        return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
        console.warn('[ig-draft] recent outbound voice lookup failed; keeping voice note off:', err.message || err);
        return true;
    }
}

function hasInboundVoiceNoteInUnansweredBatch({ currentMessage = '', recentInboundMessages = [] } = {}) {
    const messages = [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages : []).map(message => message?.text),
        currentMessage,
    ];
    return messages.some(value => {
        const raw = String(value || '');
        if (extractAudioUrls(raw).length > 0) return true;
        const marked = replaceIgMediaMarkers(raw, {
            photo: '[detected inbound photo]',
            audio: '[detected inbound audio]',
            video: '[detected inbound video]',
        });
        return marked.includes('[detected inbound audio]');
    });
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
            return "Conversation is warming up. Keep rapport natural, but make it create momentum. Use one useful statement-led follow-up when it moves the exact blocker forward. If the current message is simple banter, just banter. If they have already shared a clear food/training/energy/consistency blocker, do not ask another unrelated human-context question. Mention the Balance Plant-Based Fitness Founders Pass when they ask how to start, ask for the link/details, clearly ask Shannon for help because they feel stuck, or the qualifier context shows Shannon already has a relationship anchor plus enough goal/blocker context for a soft bridge. When bridging, anchor it to their exact situation and leave a low-pressure details handle instead of using a stock invite line. A vague warm reply is not an offer opening by itself. Do not offer to write a standalone meal plan or workout program in DMs. The app gives them the guided starting structure after they join.";
        case 'invited':
            return "You've already mentioned the Founders Pass. DON'T re-pitch. Answer their questions plainly. If they're close to signing up, help them across the line. If they are not ready yet, ask one useful question only if it helps the next step.";
        case 'in_app':
            return "They're already in the app. Coach them like a normal client. The IG thread is just a parallel channel — same voice, same memory. Keep it short unless they ask for more. Ask a specific question only when it is actually useful.";
        case 'churned':
            return "They went cold or opted out earlier. Respect the no. Be friendly, no pitch, no follow-up bait.";
        case 'new':
        default:
            return "EARLY in this DM thread. Just chat. Start with the shortest specific reaction or observation that handles what they said. Ask one concrete follow-up only when its answer would genuinely change the next coaching, support, qualification, or offer move. DO NOT pitch the app, challenge, coaching, or anything else yet — they're a stranger.";
    }
}

function challengeUrlForRoute(route, checkoutUrl = '') {
    return checkoutUrl || ONE_ON_ONE_COACHING_URL;
}

const ONE_ON_ONE_COACHING_URL = FOUNDERS_PASS_CHECKOUT_URL;
const BALANCE_CALL_BOOKING_URL = 'https://plantbased-balance.org/book';

function buildOneOnOneCoachingBlock(flowVariant = 'plant_based_control', checkoutUrl = '', acquisitionMode = ACQUISITION_MODES.ORGANIC_INBOUND) {
    const approvedCheckoutUrl = checkoutUrl || (flowVariant === 'broad_pain'
        ? FOUNDERS_PASS_BROAD_CHECKOUT_URL
        : ONE_ON_ONE_COACHING_URL);
    if (flowVariant === 'broad_pain' && isPaidMetaAcquisitionMode(acquisitionMode)) {
        return `

BALANCE FOUNDERS PASS LINK:
- This thread belongs to the broad Balance acquisition route. Keep the offer focused on fitness structure, follow-through, realistic routines, food guidance, coaching support and community. Do not introduce plant-based, vegan or vegetarian positioning unless the lead independently asks about it.
- Balance Foundations is one AUD $149 payment for the fixed six-week course, six weeks of app/community access and one weekly check-in plus workout/food review and adjustments. It does not auto-renew.
- Approved broad-route link: ${approvedCheckoutUrl}
- This exact URL carries the stored Meta attribution. Do not shorten it, rebuild it, remove its parameters or switch to the plant-based landing page from a later generic message.
- When the latest message asks for the offer link/details, asks how to start, clearly accepts the offer, or replies positively to Shannon's direct Founders Pass/details invite, send the approved broad-route link in the draft.
- Keep the handoff light and personal. Explain the six-week setup, app and community only to the level the lead asked for.
- If they only ask a general help question and have not asked for offer details/link, answer the question first and use a low-pressure statement-led bridge only when the offer genuinely fits.
- If they ask whether it is local/in-person or mention they already have a trainer, answer that the Founders Pass is an online guided app and community, not in-person training, and check whether that would still suit them.`;
    }
    const attributionRule = isPaidMetaAcquisitionMode(acquisitionMode)
        ? '- This exact URL carries the stored Meta attribution. Do not shorten it, rebuild it or remove its parameters.'
        : '- This is the canonical organic Founders Pass route. Do not switch it to the broad paid-experiment landing page based on later conversation wording.';
    return `

BALANCE PLANT-BASED FITNESS FOUNDERS PASS LINK:
- The primary DM offer is Balance Foundations: one AUD $149 payment for a fixed six-week course, six weeks of app/community access and one weekly check-in plus workout/food review and adjustments. It does not auto-renew. Online Coaching is the ongoing individual progression option after Foundations or from day one. The normal path is explanation, acceptance, and checkout inside DMs.
- Approved Founders Pass link: ${approvedCheckoutUrl}
${attributionRule}
- When the latest message asks for the offer link/details, asks how to start, clearly accepts the offer, or replies positively to Shannon's direct Founders Pass/details invite, send the approved link in the draft.
- If the latest message asks to reconnect with Balance, the app/helper, login, password, account access, or any app bug, treat it as support first and do not send the coaching link.
- Keep the link handoff light, not a brochure: stoked they are keen, here's the link, it has the quick info on the six-week setup, app and community, check it out, then come back to Shannon here if they want to chat through it.
- Frame it as one $149 payment for the six-week Foundations course with one weekly coaching review and no auto-renewal. Mention the full app feature rundown only when they ask what is included.
- If they only ask a general help question and have not asked for offer details/link, do not send the link yet. Reply to the question and use a low-pressure statement-led bridge if the Founders Pass might fit.
- If they ask whether it is local/in-person or mention they already have a PT/trainer, do not send the link yet. Answer that the Founders Pass is an online guided app and plant-based community, not in-person training, and check whether that would still suit them.`;
}

function buildBalanceCallBookingBlock() {
    return `

BALANCE CALL BOOKING:
- Approved call-booking link: ${BALANCE_CALL_BOOKING_URL}
- The normal Founders Pass path is explanation, acceptance, and checkout inside DMs. Do not turn warmth or qualification into a phone-call pitch.
- A call request counts here only when they explicitly connect it to Balance, coaching, fitness, health, the offer, working with Shannon, or talking through a real buying/coaching decision.
- A request to video chat, FaceTime, use Discord/WhatsApp, chat socially, see Shannon face-to-face, or talk later after personal/flirty banter is NOT a sales call. Do not accept it, arrange it, move platforms, or promise future personal contact. Leave that decision for Shannon.
- Use the call link when they ask to talk through the Balance/coaching decision, remain genuinely uncertain after a clear DM explanation, or the situation needs Shannon's professional judgement. Keep the handoff casual and short, such as "yeah for sure, grab a time that works for you here".
- The booking page lets them choose a phone call, video call, or WhatsApp call. Let them choose there. Do not make them pick a format in the DM or promise a specific platform before they book.
- Do not send this link just because they are interested in the Founders Pass, have shared a goal, or asked for offer details. Use the regular Founders Pass link in those cases.
- The booking link is an approved lead handoff. Once the lead has clearly asked for or accepted the call, the normal lead-manager send path can deliver it after its usual thread readback. It is not a Needs You reason by itself.`;
}

function buildChallengeNextStepBlock(qualifier, currentMessageText = '', checkoutUrl = '') {
    if (!qualifier || typeof qualifier !== 'object') return '';
    if (isAppReconnectOrAccountSupportRequest(currentMessageText)) {
        return `

APP SUPPORT NEXT STEP:
The newest message is about Balance/app/helper reconnection, account access, login, or a tech/workout setup issue. Treat this as support, not a coaching signup moment.
- Do not send the coaching link in this reply, even if the lead previously accepted the offer.
- App problems should be fixed, checked, and then confirmed. Do not fob them off with "try later".
- Do not ask for a screenshot by default. Ask only when the exact problem cannot be identified from their message, app logs, or conversation.
- Do not claim the app issue is fixed unless the context says Shannon has already fixed and verified it.
- If no fix evidence is available yet, write as Shannon taking ownership: he will check it properly and get it sorted, then confirm once fixed.
- Do not mention AI, automation, or an assistant. Keep the wording as Shannon personally helping them get sorted.`;
    }
    const url = challengeUrlForRoute(qualifier.challenge_route || 'generic', checkoutUrl);
    if (qualifier.stage === 'won' && isCurrentChallengeHandoffMoment({ qualifier, currentMessage: currentMessageText })) {
        return `

FOUNDERS PASS ACCEPTED NEXT STEP:
They have accepted the Balance Plant-Based Fitness Founders Pass. Do NOT ask more qualifier/intake questions in this reply.
Your reply should:
- Send this exact URL in the draft: ${url}
- If you write "here's the link" or "heres the link", the URL must be visible in the same bubble or the next bubble.
- Keep the explanation tiny: the link has quick info on the six-week setup, app and plant-based community.
- Ask them to check it out, then come back to Shannon here if they want to chat through it.
- Use the vibe: "yeah sounds so good, stoked you're keen" rather than a brochure.
- Do it in 2-3 short bubbles, not one paragraph.
Do not offer to manually write a meal plan or workout program in DMs before signup.`;
    }
    if (qualifier.stage === 'won') {
        return `

FOUNDERS PASS ALREADY ACCEPTED CONTEXT:
They have accepted the Founders Pass earlier, but the newest message is not asking for the link, details, or next step. Do not resend the signup link from stored stage alone. Reply to the newest message naturally and only bring the link back if they ask how to start, ask for the link/details, or clearly confirm the offer again.`;
    }
    if (qualifier.stage === 'pitched') {
        return `

FOUNDERS PASS OFFER PITCHED:
The Founders Pass has already been offered. If they sound keen, ask for details/link, ask how to start, or reply positively with "yes / sounds good / keen", send this exact URL in the draft: ${url}. If you write "here's the link" or "heres the link", the URL must be visible in the same bubble or the next bubble. Keep the handoff tight in 2-3 bubbles: stoked they are keen, here's the link, it has the quick six-week/app/community info, check it out, then come back here if they want to chat through it. If they are still unsure, answer the concern and keep it easy.`;
    }
    if (hasEarnedChallengeInviteMoment({ qualifier })) {
        return `

EARNED FOUNDERS PASS BRIDGE:
This unlinked lead has enough relationship and goal/blocker context for a soft bridge if it fits the newest message. Do not send the link yet. Do not make it a brochure. If the newest message is casual or unrelated to fitness, food, health, consistency or the offer, do not pivot and pitch in the same outbound. First reconnect naturally to the relevant goal or blocker and let them answer; offer on the following turn if the opening remains live. Direct buyer intent is the exception. When the newest message is already in the relevant lane, use one casual line anchored to what they just said, with the Founders Pass as the natural next step. If they have not asked for the link/details yet, use a statement like "I can send the details through here" rather than a stock yes/no close. Save the app feature rundown for when they ask what is included. If the newest message is a clear no/not-yet signal, hold off and just reply to that.`;
    }
    return '';
}

function buildChallengeOfferWarning({ draftText, qualifier, currentMessage } = {}) {
    if (!isChallengeOfferWarningText(draftText)) return null;
    if (isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage })) {
        return {
            required: false,
            code: 'approved_coaching_link',
            dot: '🟢',
            label: 'approved coaching link',
            reason: 'Draft uses the approved coaching link after the lead accepted or asked for the next step.',
            detected_at: new Date().toISOString(),
        };
    }
    const route = ['vegan', 'generic'].includes(qualifier?.challenge_route)
        ? qualifier.challenge_route
        : 'undecided';
    const routeLabel = route === 'vegan'
        ? 'plant-based coaching'
        : route === 'generic'
            ? 'starter coaching'
            : 'starter coaching';
    return {
        required: true,
        code: 'challenge_offer',
        dot: '🟡',
        label: 'starter coaching invite',
        route,
        route_label: routeLabel,
        reason: `Draft appears to offer ${routeLabel} or send the coaching link.`,
        detected_at: new Date().toISOString(),
    };
}

function isSignupLinkHandoffText(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    return /https?:\/\/|future-balance\.netlify\.app|coaching\.html|plantbased-balance\.org\/bio\.html|plantbased-balance\.org\/transform-challenge|apps\.apple\.com\/app\/balance-fitness-gamified|here'?s the link|here is the link|jump in here|get signed up|sign up here|signup here|you can jump in here/i.test(s);
}

function isApprovedChallengeBioLinkText(text) {
    return /https?:\/\/(?:(?:www\.)?plantbased-balance\.org\/(?:founders\/?|(?:vegan-fitness|coaching|plant-based-fitness)\.html)|future-balance\.netlify\.app\/(?:fitness\/?|(?:coaching|fitness-coaching)\.html))\b/i.test(String(text || ''));
}

function isBalanceCallBookingLinkText(text) {
    return /https?:\/\/plantbased-balance\.org\/book\b/i.test(String(text || ''));
}

function isExplicitCallBookingRequest(text) {
    const s = String(text || '');
    if (!hasBusinessCallRequest(s)) return false;
    return /\b(?:book|schedule|set up|organise|organize|have|do|jump on|take)\b.{0,48}\b(?:a )?(?:call|chat|phone|video|whatsapp)\b/i.test(s)
        || /\b(?:can|could|would|want to)\b.{0,32}\b(?:call|chat|talk)\b/i.test(s)
        || /\b(?:phone|video|whatsapp)\s+call\b/i.test(s);
}

function isPositiveChallengeLinkConfirmationText(text) {
    return /\b(?:yes|yeah|yea|yep|sure|please|pls|sounds good|sounds so good|keen|okay|ok|sweet|let'?s do it|lets do it|do it)\b/i.test(String(text || ''));
}

function isCurrentChallengeHandoffMoment({ qualifier, currentMessage } = {}) {
    if (isAppReconnectOrAccountSupportRequest(currentMessage)) return false;
    if (hasDirectPaidMetaCheckoutIntent(currentMessage)) return true;
    if (hasChallengeInviteReadinessSignal(currentMessage)) return true;
    if (String(qualifier?.commercial_stage || '').toLowerCase() === 'buyer_intent'
        && (PAID_META_CONTEXTUAL_OFFER_VIEW_RE.test(String(currentMessage || '').trim())
            || isPaidMetaFoundersPassSelection(currentMessage))) {
        return true;
    }
    const stage = String(qualifier?.stage || '').toLowerCase();
    return ['pitched', 'won'].includes(stage) && isPositiveChallengeLinkConfirmationText(currentMessage);
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
    if (/\b(30\s*day|30-day|free challenge|challenge link|coaching link|sign ?up|signup|join)\b/i.test(s)) return false;
    return /\b(reconnect(?:ed|ing)?|connect(?:ed|ing)? back|app helper|balance helper|balance app helper|account access|app access|login|log in|locked out|password|reset link|face id|face recognition|old email|spam|manual(?:ly)? reset|app glitch|glitched|bug)\b/i.test(s);
}

function isExistingClientThread({ leadStage, linkedUserId } = {}) {
    if (linkedUserId) return true;
    return ['in_app', 'paying'].includes(String(leadStage || '').toLowerCase());
}

function suppressExistingClientSignupLinkHandoffInDraftChunks(chunks, { leadStage, linkedUserId } = {}) {
    const input = Array.isArray(chunks) ? chunks : [];
    if (!isExistingClientThread({ leadStage, linkedUserId })) return input;
    const cleaned = input
        .map(chunk => {
            const text = String(chunk || '').trim();
            if (!text) return '';
            if (!isSignupLinkHandoffText(text)) return text;
            const sentences = text
                .split(/(?<=[.!?])\s+|\n+/)
                .map(part => part.trim())
                .filter(Boolean)
                .filter(part => !isSignupLinkHandoffText(part) && !/\b(?:download|grab|check(?:\s+this|\s+it)?|jump in|sign ?up)\b.{0,80}\b(?:app|balance|challenge|link)\b/i.test(part));
            return sentences.join(' ').trim();
        })
        .filter(Boolean);
    return cleaned;
}

function repairMissingChallengeBioLinkChunks(chunks, { maxChunks = MAX_CHUNKS, currentMessageText = '', qualifier = null, leadStage = null, linkedUserId = null, checkoutUrl = '' } = {}) {
    const list = Array.isArray(chunks) ? chunks.map(c => String(c || '').trim()).filter(Boolean) : [];
    if (!list.length) return list;
    if (isExistingClientThread({ leadStage, linkedUserId })) return list;
    const joined = list.join('\n');
    if (!promisesLinkWithoutUrl(joined)) return list;
    if (isAppReconnectOrAccountSupportRequest(currentMessageText)) return list;

    const allowed = isCurrentChallengeHandoffMoment({ qualifier, currentMessage: currentMessageText });
    if (!allowed) return list;

    const url = challengeUrlForRoute(qualifier?.challenge_route || 'generic', checkoutUrl);
    if (list.length < maxChunks) return [...list, url];

    const next = [...list];
    next[next.length - 1] = `${next[next.length - 1]}\n${url}`;
    return next;
}

function isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage } = {}) {
    if (!isApprovedChallengeBioLinkText(draftText)) return false;
    if (isAppReconnectOrAccountSupportRequest(currentMessage)) return false;
    return isCurrentChallengeHandoffMoment({ qualifier, currentMessage });
}

function isApprovedBalanceCallBookingHandoffAllowed({ draftText, currentMessage } = {}) {
    return isBalanceCallBookingLinkText(draftText) && isExplicitCallBookingRequest(currentMessage);
}

function isUnlinkedAcquisitionLeadForLinkGate({ leadStage, linkedUserId } = {}) {
    if (linkedUserId) return false;
    const stage = String(leadStage || 'new').toLowerCase();
    return !['in_app', 'paying', 'churned'].includes(stage);
}

function buildLeadOnboardingHandoffData({ draftText, qualifier, leadStage, linkedUserId, threadId, manychatMessageId, currentMessage, appPreviewHandoffUrl = '', requireActualLinkAction = false }) {
    if (!isUnlinkedAcquisitionLeadForLinkGate({ leadStage, linkedUserId })) return null;
    const draftHasLinkDrop = isSignupLinkHandoffText(draftText);
    const acceptedCoaching = isCurrentChallengeHandoffMoment({ qualifier, currentMessage });
    const approvedAppPreviewHandoff = isMetaAppPreviewUrl(appPreviewHandoffUrl)
        && isApprovedPaidMetaAppPreviewMoment({ currentMessage, qualifier });
    const visibleHandoffUrl = (String(draftText || '').match(/https?:\/\/\S+/gi) || [])
        .map(url => url.replace(/[),.!?]+$/, ''))
        .find(url => isApprovedChallengeBioLinkText(url)) || '';
    // The general lead coach may ask a manager to review an inferred commercial
    // moment before a link is written. Paid Meta has its own conversation writer
    // and action gates, so conversational text must not become a fake link hold.
    if (requireActualLinkAction && !draftHasLinkDrop && !approvedAppPreviewHandoff) return null;
    if (!draftHasLinkDrop && !acceptedCoaching && !approvedAppPreviewHandoff) return null;

    if (approvedAppPreviewHandoff) {
        return {
            lead_onboarding_handoff: false,
            needs_you_required: false,
            operator_queue: null,
            style_note: 'Qualified paid Meta lead received the approved five-minute Balance app preview.',
            signup_link_manual_only: false,
            signup_link_handoff_url: appPreviewHandoffUrl,
            approved_link_auto_sendable: true,
            paid_meta_app_preview_handoff: true,
            codex_review: {
                source: 'ig-instant-draft',
                decision: 'approved_paid_meta_app_preview_handoff',
                queue: null,
                needs_shannon_approval: false,
                reason: 'The lead supplied both a goal and a real blocker, so the current paid app preview is the next step.',
                evidence_ids: [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : ''].filter(Boolean),
                reviewed_at: new Date().toISOString(),
            },
        };
    }

    if (isApprovedChallengeBioHandoffAllowed({ draftText, qualifier, currentMessage })) {
        return {
            lead_onboarding_handoff: false,
            needs_you_required: false,
            operator_queue: null,
            style_note: 'Approved coaching link handoff can send once the lead has accepted or asked for the next step.',
            signup_link_manual_only: false,
            signup_link_handoff_url: visibleHandoffUrl || ONE_ON_ONE_COACHING_URL,
            approved_link_auto_sendable: true,
            codex_review: {
                source: 'ig-instant-draft',
                decision: 'approved_coaching_link_handoff',
                queue: null,
                needs_shannon_approval: false,
                reason: 'Approved coaching link handoff is allowed for this accepted/ready lead.',
                evidence_ids: [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : ''].filter(Boolean),
                reviewed_at: new Date().toISOString(),
            },
        };
    }

    if (isApprovedBalanceCallBookingHandoffAllowed({ draftText, currentMessage })) {
        return {
            lead_onboarding_handoff: false,
            needs_you_required: false,
            operator_queue: null,
            style_note: 'Approved call-booking link handoff can send after the lead has directly asked for or accepted a call.',
            signup_link_manual_only: false,
            signup_link_handoff_url: BALANCE_CALL_BOOKING_URL,
            approved_link_auto_sendable: true,
            call_booking_handoff: true,
            codex_review: {
                source: 'ig-instant-draft',
                decision: 'approved_call_booking_link_handoff',
                queue: null,
                needs_shannon_approval: false,
                reason: 'Approved call-booking link handoff is allowed because the lead directly asked for a call.',
                evidence_ids: [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : ''].filter(Boolean),
                reviewed_at: new Date().toISOString(),
            },
        };
    }

    const reason = draftHasLinkDrop
        ? 'Draft contains a coaching/signup link handoff; Shannon must approve or send it manually.'
        : 'Lead appears ready for the coaching/signup link; Shannon must approve the handoff before any URL is sent.';
    const evidenceIds = [threadId ? `ig_threads:${threadId}` : '', manychatMessageId ? `manychat_message_id:${manychatMessageId}` : '']
        .filter(Boolean);
    return {
        lead_onboarding_handoff: false,
        needs_you_required: false,
        operator_queue: null,
        client_manager_review_required: true,
        style_note: 'Lead is near a Balance coaching link step. Hold automatic sending until the client manager checks readiness and either approves the draft or hands it to Shannon.',
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

function isCurrentMetaAdInbound({ customData = {}, manychatMessageId = '' } = {}) {
    const routing = customData && typeof customData.current_inbound_routing === 'object'
        ? customData.current_inbound_routing
        : {};
    if (String(routing.source || '').toLowerCase() !== 'meta_ads') return false;
    const routedMessageId = String(routing.message_id || '').trim();
    const inboundMessageId = String(manychatMessageId || '').replace(/^ig_graph:/i, '').trim();
    if (routedMessageId && inboundMessageId) {
        return routedMessageId === inboundMessageId || String(manychatMessageId || '').endsWith(routedMessageId);
    }
    const receivedAtMs = Date.parse(routing.received_at || '');
    return Number.isFinite(receivedAtMs) && (Date.now() - receivedAtMs) <= (15 * 60 * 1000);
}

function isMetaAdFastLaneEligible({ linkedUserId = null, customData = {}, manychatMessageId = '' } = {}) {
    if (linkedUserId) return false;
    return isCurrentMetaAdInbound({ customData, manychatMessageId });
}

function isMetaAdConversationFastLaneEligible({ linkedUserId = null, customData = {} } = {}) {
    if (linkedUserId) return false;
    const attribution = customData && typeof customData.meta_ad_attribution === 'object'
        ? customData.meta_ad_attribution
        : {};
    return String(attribution.source || '').toLowerCase() === 'meta_ads'
        || String(customData?.latest_paid_acquisition || '').toLowerCase() === 'meta_ads'
        || String(customData?.acquisition_source || '').toLowerCase() === 'meta_ads'
        || isInternalMetaAdConversationTestLane({ customData });
}

function isInternalMetaAdConversationTestLane({ linkedUserId = null, customData = {} } = {}) {
    if (linkedUserId) return false;
    const botAccount = normalizeBotAccount(
        customData?.bot_account || customData?.instagram_graph?.bot_account
    );
    return botAccount === 'shan_n_sunny'
        && customData?.internal_test_auto_reply_enabled === true
        && ['plant_based_control', 'broad_pain'].includes(
            String(customData?.internal_test_meta_ad_flow || '').trim().toLowerCase()
        );
}

function isInternalMetaAdConversationOpeningTurn({
    linkedUserId = null,
    customData = {},
    history = [],
    currentMessage = '',
} = {}) {
    const repeatableTestOpener = isRepeatableInternalMetaAdTestOpener(currentMessage);
    return isInternalMetaAdConversationTestLane({ linkedUserId, customData })
        && ((Array.isArray(history) ? history : []).length === 0 || repeatableTestOpener)
        && shouldUseDeterministicMetaAdFirstReply(currentMessage);
}

function isRepeatableInternalMetaAdTestOpener(value = '') {
    const message = String(value || '').replace(/\s+/g, ' ').trim();
    return /^(?:balance|what is (?:the )?founders pass)\??$/i.test(message);
}

function buildInternalMetaAdTestResetCustomData({
    linkedUserId = null,
    customData = {},
    currentMessage = '',
    resetAt = new Date().toISOString(),
} = {}) {
    if (!isInternalMetaAdConversationTestLane({ linkedUserId, customData })
        || !isRepeatableInternalMetaAdTestOpener(currentMessage)) return null;
    return {
        ...(customData || {}),
        internal_test_conversation_reset_at: resetAt,
    };
}

function resolveInternalTestConversationResetAt(customData = {}, history = []) {
    const explicitResetAt = String(customData?.internal_test_conversation_reset_at || '').trim();
    const referralAt = String(customData?.meta_ad_attribution?.last_referral_at || '').trim();
    const repeatedOpenerTimes = (Array.isArray(history) ? history : [])
        .filter(message => String(message?.direction || '').toLowerCase() === 'in'
            && isRepeatableInternalMetaAdTestOpener(message?.text))
        .map(message => String(message?.created_at || '').trim());
    const candidates = [explicitResetAt, referralAt, ...repeatedOpenerTimes]
        .map(value => ({ value, timestamp: Date.parse(value) }))
        .filter(candidate => Number.isFinite(candidate.timestamp));
    if (!candidates.length) return '';
    return candidates.reduce((latest, candidate) => (
        candidate.timestamp > latest.timestamp ? candidate : latest
    )).value;
}

function buildInternalTestEpisodeCustomData(customData = {}, history = []) {
    const source = customData && typeof customData === 'object' ? customData : {};
    return {
        bot_account: source.bot_account || source.instagram_graph?.bot_account || undefined,
        instagram_graph: source.instagram_graph ? {
            bot_account: source.instagram_graph.bot_account,
        } : undefined,
        meta_ad_attribution: source.meta_ad_attribution || undefined,
        acquisition_mode: source.acquisition_mode || undefined,
        offer_flow_variant: source.offer_flow_variant || undefined,
        internal_test_conversation_reset_at: resolveInternalTestConversationResetAt(source, history) || undefined,
    };
}

function resolveInternalTestVoiceCooldownResetAt(customData = {}, history = []) {
    const candidates = [resolveInternalTestConversationResetAt(customData)];
    for (const message of Array.isArray(history) ? history : []) {
        if (String(message?.direction || '').toLowerCase() !== 'in') continue;
        const text = String(message?.text || '').replace(/\s+/g, ' ').trim();
        if (!/^what is the founders pass\??$/i.test(text)) continue;
        candidates.push(String(message?.created_at || '').trim());
    }
    const valid = candidates
        .map(value => ({ value, timestamp: Date.parse(value) }))
        .filter(candidate => Number.isFinite(candidate.timestamp));
    if (!valid.length) return '';
    return valid.reduce((latest, candidate) => (
        candidate.timestamp > latest.timestamp ? candidate : latest
    )).value;
}

function buildCurrentInboundTurnText(currentMessage = '', recentInboundMessages = []) {
    return [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages : [])
            .map(message => String(message?.text || '').trim()),
        String(currentMessage || '').trim(),
    ].filter(Boolean).join('\n');
}

function buildInternalTestQualifierThread(thread = {}, history = []) {
    if (!isInternalMetaAdConversationTestLane({
        linkedUserId: thread?.linked_user_id,
        customData: thread?.custom_data,
    })) return thread;
    const resetAtMs = Date.parse(resolveInternalTestConversationResetAt(thread.custom_data, history));
    const qualifierAtMs = Date.parse(thread?.qualifier?.evaluated_at || '');
    const qualifier = Number.isFinite(resetAtMs)
        && (!Number.isFinite(qualifierAtMs) || qualifierAtMs < resetAtMs)
        ? null
        : (thread.qualifier || null);
    // A fresh ad referral is a new test episode. Keep only routing/campaign data;
    // old test facts (family, blockers, preferences, buyer state) must not leak
    // into either qualification or the reply writer.
    const customData = buildInternalTestEpisodeCustomData(thread.custom_data, history);
    return {
        ...thread,
        qualifier,
        custom_data: customData,
        goals: null,
        communication_style: null,
        running_notes: null,
        injuries_limits: null,
        personal_context: null,
        coach_instructions: null,
    };
}

function filterInternalTestHistoryAfterReset({
    history = [],
    linkedUserId = null,
    customData = {},
} = {}) {
    if (!isInternalMetaAdConversationTestLane({ linkedUserId, customData })) {
        return Array.isArray(history) ? history : [];
    }
    const resetAtMs = Date.parse(resolveInternalTestConversationResetAt(customData, history));
    if (!Number.isFinite(resetAtMs)) {
        return Array.isArray(history) ? history : [];
    }
    return (Array.isArray(history) ? history : []).filter(message => {
        const createdAtMs = Date.parse(message?.created_at || '');
        return Number.isFinite(createdAtMs) && createdAtMs >= resetAtMs;
    });
}

function isExerciseConversationFastLaneEligible({ linkedUserId = null, currentMessage = '', recentMessages = [], nowMs = Date.now() } = {}) {
    if (linkedUserId) return false;
    const text = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    if (/\b(?:stop|unsubscribe|do not message|don['\u2019]?t message|leave me alone)\b/i.test(text)) return false;
    const exercisePattern = /\b(?:gym|fitness|workouts?|working out|exercise(?:s|d|ing)?|training|strength training|weight training|lifting|cardio|mobility|reps?|squats?|deadlifts?|bench press|leg day|upper body|lower body|push day|pull day|running|runner|treadmill|pilates|yoga)\b/i;
    if (exercisePattern.test(text)) return true;
    const activeConversationCutoff = Number(nowMs) - (2 * 60 * 60 * 1000);
    return (Array.isArray(recentMessages) ? recentMessages : [])
        .slice(-8)
        .some(message => {
            const createdAtMs = Date.parse(message?.created_at || '');
            return Number.isFinite(createdAtMs)
                && createdAtMs >= activeConversationCutoff
                && exercisePattern.test(String(message?.text || ''));
        });
}

function isBalanceLeadAutoSendEnabled({ linkedUserId = null, threadAutoSendEnabled = false, metaAdFastLane = false, exerciseConversationFastLane = false } = {}) {
    return !linkedUserId
        && threadAutoSendEnabled === true
        && (metaAdFastLane === true || exerciseConversationFastLane === true);
}

function isCanceledLatestRecoveryCandidate({ status, data = {}, autoSendEnabled, isLatestInbound } = {}) {
    return autoSendEnabled === true
        && status === 'canceled'
        && data.cancel_reason === 'superseded_by_new_message'
        && isLatestInbound === true;
}

async function isLatestInboundMessageForThread({ threadId, manychatMessageId }) {
    if (!threadId || !manychatMessageId) return false;
    const rows = await supabaseQuery(
        `ig_messages?select=manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}&direction=eq.in&order=created_at.desc,id.desc&limit=1`
    );
    return String(rows?.[0]?.manychat_message_id || '') === String(manychatMessageId);
}

function classifySourceMessageFreshness({ sourceMessage, latestMessage, resetAt = '' } = {}) {
    if (!sourceMessage?.id || String(sourceMessage.direction || '').toLowerCase() !== 'in') {
        return { state: 'unknown', reason: 'canonical_source_inbound_not_found' };
    }
    const resetAtMs = Date.parse(resetAt || '');
    const sourceCreatedAtMs = Date.parse(sourceMessage.created_at || '');
    if (Number.isFinite(resetAtMs)
        && Number.isFinite(sourceCreatedAtMs)
        && sourceCreatedAtMs < resetAtMs) {
        return { state: 'stale', reason: 'source_predates_conversation_reset' };
    }
    if (!latestMessage?.id) {
        return { state: 'unknown', reason: 'canonical_latest_message_not_found' };
    }
    if (String(latestMessage.id) === String(sourceMessage.id)) {
        return { state: 'current', reason: 'source_is_latest_canonical_message' };
    }
    return {
        state: 'stale',
        reason: String(latestMessage.direction || '').toLowerCase() === 'out'
            ? 'newer_canonical_outbound_exists'
            : 'newer_canonical_inbound_exists',
    };
}

async function inspectSourceMessageFreshness({ threadId, manychatMessageId, resetAt = '' } = {}) {
    if (!threadId || !manychatMessageId) {
        return { state: 'unknown', reason: 'source_identity_missing' };
    }
    const sourceRows = await supabaseQuery(
        `ig_messages?select=id,direction,created_at,manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}`
        + `&manychat_message_id=eq.${encodeURIComponent(manychatMessageId)}&limit=1`
    );
    const latestRows = await supabaseQuery(
        `ig_messages?select=id,direction,created_at,manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}`
        + '&order=created_at.desc,id.desc&limit=1'
    );
    const sourceMessage = sourceRows?.[0] || null;
    const latestMessage = latestRows?.[0] || null;
    return {
        ...classifySourceMessageFreshness({ sourceMessage, latestMessage, resetAt }),
        sourceMessage,
        latestMessage,
    };
}

async function cancelStaleReplayAlert({ idempotencyKey, freshness } = {}) {
    if (!idempotencyKey || freshness?.state !== 'stale') return null;
    const rows = await supabaseQuery(
        `coach_alerts?select=id,status,data&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    );
    const alert = rows?.[0] || null;
    if (!alert?.id || !['pending', 'scheduled'].includes(alert.status)) return alert;
    const canceledAt = new Date().toISOString();
    const updated = await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=in.(pending,scheduled)`, {
        method: 'PATCH',
        body: {
            status: 'canceled',
            actioned_at: canceledAt,
            scheduled_for: null,
            scheduled_reply_text: null,
            data: {
                ...(alert.data || {}),
                cancel_reason: 'stale_replayed_inbound',
                stale_replay_canceled_at: canceledAt,
                stale_replay_reason: freshness.reason,
                stale_replay_source_message_id: freshness.sourceMessage?.id || null,
                stale_replay_source_message_at: freshness.sourceMessage?.created_at || null,
                stale_replay_newer_message_id: freshness.latestMessage?.id || null,
                stale_replay_newer_message_direction: freshness.latestMessage?.direction || null,
                stale_replay_newer_message_at: freshness.latestMessage?.created_at || null,
                outbound_attempted: false,
            },
        },
        prefer: 'return=representation',
    });
    return updated?.[0] || alert;
}

function getCocosCodexReviewHold({ cocosAutoSendLane, voiceReplyTestLane, approvedCoachingLinkHandoff, metaAdFastLane } = {}) {
    if (!cocosAutoSendLane) return null;
    if (voiceReplyTestLane || approvedCoachingLinkHandoff || metaAdFastLane) return null;
    return {
        code: 'codex_conversation_review',
        label: 'conversational reply waits for Codex review',
    };
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
- Lead-only invite timing: do not pitch clients or linked app users. For unlinked leads, the soft Founders Pass bridge usually belongs after 3-6 meaningful lead replies, a normal-life anchor, and at least two useful health/fitness facts.
- Before 3 meaningful lead replies, only move to coaching if they directly ask for help, ask how to start, ask what is included, ask about coaching, or ask for the link.
- Earn the next response without interrogating: each reply should answer the direct ask, mirror the sharpest hook, add a tiny useful lens, give a strong specific reaction, or ask one precise question about the real blocker/preference. Generic validation plus a broad question is not enough, but light banter does not need a question every turn.
- If they want a local/in-person trainer or already have a PT/coach, explore that preference before any invite or link.
- When the earned window opens, stop drifting into pen-pal mode. Use one casual statement-led bridge, do not send the link unless they accept.
- Keep everything sounding like Shannon personally texting. Never mention tests, auto-send, algorithms, learning, or system rules.`;
    }
    if (!isCocosBotAccount(botAccount)) return '';
    return `

COCO'S TEST LANE:
This thread belongs to Coco's PT Studio, Shannon's contained acquisition test account.
- Use the same Shannon voice, same relationship-first logic, and same safety review rules as Balance.
- Do not become more cautious just because this lane may run on auto. Trust the conversation algorithm and keep the next message moving.
- Shannon's hesitation/fear of rejection is not part of this lane. If the person gives a real help/start/fitness-frustration/offer-detail signal, bridge confidently toward the Founders Pass instead of delaying forever.
- Lead-only invite timing: do not pitch clients or linked app users. For unlinked leads, the soft Founders Pass bridge usually belongs after 3-6 meaningful lead replies, a normal-life anchor, and at least two useful health/fitness facts.
- Before 3 meaningful lead replies, only move to coaching if they directly ask for help, ask how to start, ask what is included, ask about coaching, or ask for the link. Once the earned window opens, stop drifting into pen-pal mode and ask the simple permission bridge.
- Earn the next response without interrogating: each reply should answer the direct ask, mirror the sharpest hook, add a tiny useful lens, give a strong specific reaction, or ask one precise question about the real blocker/preference. Generic validation plus a broad question is not enough, but light banter does not need a question every turn.
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
- When the latest message is a clean closer or low-bandwidth acknowledgement, do not manufacture momentum with another question.
- If the newest turn is pure banter, a food/photo/story reaction, or a quick answer to Shannon's tiny question, start with the shortest specific reaction or observation. Ask one chill follow-up only when the answer would change a real next move; a conversational hook by itself is not enough. Do not force one for a clean closer, thanks, emoji-only reply, filler, or a moment that has clearly run its course.
- If the latest inbound is only a light story reaction such as "cute", "haha", "nice", an emoji, or a tiny acknowledgement, do not append a generic fitness question. Especially avoid "are you into fitness much too?" and "you training at the moment?" unless the latest message itself contains a real health, training, food, energy, consistency, or help hook.
- If story/post evidence conflicts with durable memory or is weak, answer only the safe visible/reply text. Do not invent the pet/object context and do not use a stock lead qualifier to cover the uncertainty.
- Use this decision order: answer their latest message, notice the strongest blocker or desire, then choose one next move: a tiny useful lens, one precise fit question, a direct Founders Pass explanation, or a soft optional offer bridge.
- No-progression fix: before writing, label the lead's latest signal as one of direct ask, blocker/objection, reciprocal curiosity, early program start, exit/low bandwidth, or pure rapport. The reply must move that exact signal one notch forward.
- Too-generic fix: build the reply from the lead's exact noun plus their constraint plus the consequence. Example: "two little ones + exhausted after work + dinner stress", "new city move + bookstore shifts + quiet/coffee shop", "conflicting info + meal prep time + overwhelm".
- If they ask about Shannon, the app, work, a bug, weekend plans, or another reciprocal personal detail, answer in one short clause, then return the spotlight to their strongest life/health signal. Do not let Shannon's side become the main topic for a second consecutive reply.
- If they object with chaos, moving, busyness, overwhelm, heat, schedule, or "not sure I can commit", do not loop on "totally fair/no pressure". Give one pressure-lowering reframe, then ask the smallest useful fit question or offer one tiny anchor.
- If they say they got the program/app/challenge or just started, do not ask "how are you finding it?" Ask one specific first-friction question: what looks hardest to fit in this week, what has been easiest to start, or what will get in the way first.
- If they are clearly leaving, do not force a question. Close warmly with a soft re-entry handle tied to their topic, like "catch ya, and if the move/work/heat starts messing with food, energy, or training, flick me a message".
- Earn the next response without interrogating. The reply needs a handle worth answering: a direct answer, their sharpest hook reflected back, a tiny useful lens, a strong specific reaction, or one precise question about their blocker/preference/objection.
- Avoid lazy statement-only dead ends when there is a live help/sales signal. A crisp reaction is not a dead end if they are bantering, celebrating, sending a food/photo update, answering a tiny question, or closing the thread.
- In early rapport, do not jump from a plant, pet, travel, food, work, or hobby answer straight into a fitness pitch. Let a short specific reaction stand when it handles the moment. Use a later life-rhythm opening for a natural fitness/health question only when the lead creates one. Never cram a discovery sequence into one DM.
- One or two normal-life beats is usually enough. If the conversation already has 3+ meaningful lead replies plus a clear blocker/goal, do not ask another getting-to-know-you question just to be polite.
- Good soft bridge shape: "honestly the founders pass could be a good starting point for that: the six-week setup plus the plant-based community without another weekly bill. want me to send the details?"
- A call is an escalation, not the normal late bridge. Do not offer it merely because Shannon has a normal-life anchor, a real goal/blocker, or roughly 3 meaningful replies. Close through DMs unless they explicitly want to talk, remain genuinely uncertain after the offer is explained, or the situation needs Shannon's judgement.
- If they ask for practical advice, give the practical answer first. Then bridge only if it still feels natural.
- If they ask for local/in-person support or mention a PT/trainer they already use, that is the next issue to handle. Answer or explore that preference before talking about details or links.
- If there is no real blocker yet, stay human and light. A specific reaction can be the whole reply; do not add a question merely to keep the thread alive. Do not become a pen pal for its own sake.`;
}

function buildAcquisitionStyleBlock({ leadStage, linkedUserId } = {}) {
    if (!isSalesAcquisitionThread({ leadStage, linkedUserId })) return '';
    return `

ACQUISITION STYLE:
- Human first, coach second, but not pen-pal forever. Learn a normal-life anchor when there is no clear help signal yet: where they're based, kids/family, work/life rhythm, cooking situation, training background, why they replied, what they really love, or what genuinely ticks them off/stresses them.
- Follow the private subtle bridge plan one adjacent step at a time. Do not jump from a pet, place, hobby, work, food, or vegan-values topic straight to "are you into fitness?", "do you train?", or "what are your goals?". Move through the natural middle when it exists: how it fits their week, routine, time, energy, activity, food structure, or consistency. The plan records direction; it does not require movement in every reply.
- If the bridge plan says direct fitness question allowed = no, do not ask a direct fitness/goal question. Stay with the live anchor, deepen it naturally, use a statement-led adjacent bridge, or hold. If it says yes, the question must still come from the lead's own newest signal and be the smallest useful step.
- Use the private ethical conversation-psychology state to choose the human move, not to manipulate. If they need to feel heard, reflect. If confidence is low, affirm real evidence of capability. If they are protecting autonomy, preserve choice and avoid prescriptions. If change talk is present, reflect or evoke their own reason instead of supplying one for them. If they need space, pause.
- The psychology layer cannot authorize a pitch, link, direct fitness question, urgency, or stronger follow-up by itself. Commercial-stage, episode, bridge, consent, support, and safety gates still win. Never expose the labels, score the person aloud, diagnose them, or use vulnerability as leverage.
- Treat objections as information about the decision, never as resistance to overcome. Answer or reflect the exact concern first. Ask at most one clarifier only if it changes fit, then give one truthful relevant fact or leave space. A clear no or request for thinking time ends the sales move for this turn. Never minimise price pressure, argue that they have time, promise they will finally succeed, bypass a partner, manufacture a deadline, or send a link while online/in-person fit is unresolved.
- Early lead chat should sound like Shannon, not an intake sequence. For simple rapport, use the shortest complete specific reaction first and stop there when it handles the moment. Ask one tiny concrete question only when the answer matters to the next relationship, support, qualification, or offer decision. Do not ask merely because a photo, story, hobby, place, meal, work detail, or opinion gives you something you could ask about.
- Build the bridge in steps: specific life hook -> daily rhythm or preference -> health/fitness/food/energy context -> their goal or blocker -> Founders Pass details in DMs. Let every step feel like normal conversation. Never pivot from a random plant, pet, or holiday message straight into a call or an offer.
- When a clear food, training, energy, body, confidence, consistency, or time blocker is already visible, stop collecting unrelated human context and move that exact blocker forward.
- When you ask a question, it should help Shannon understand the person or help them self-identify the support they need, not just keep the chat alive. Prefer a useful label/statement when it can do the same job. Normal back-and-forth is allowed, but it should create momentum.
- Shannon's real edited pattern from IG is usually a tiny specific reaction with no question. When a missing answer genuinely affects the next move, add one concrete question from the exact newest detail, such as "why by April?", "how long has this been going on for?", "what part first?", or "how far are you doing?".
- Earn the next response without interrogating. Every lead reply from Shannon should contain at least one reason to continue: a direct answer, their sharpest hook reflected back, a tiny useful lens, a strong specific reaction, or one precise question about their blocker/preference/objection.
- Sales suspicion overrides the normal "earn the next response" rule. If they ask whether Shannon is trying to sell or pitch them something, answer honestly, keep it short, and back off with no fitness question, offer, link, or new continuation hook. Preserve that autonomy hold through later ordinary fitness sharing. Do not resume qualification merely because they answer the last fitness question; wait until they explicitly ask for help, details, a link, or how to start.
- shan_n_sunny weakness to correct: drafts can be too generic and fail to progress. Before finalising, check whether the reply would still fit 100 other leads. If yes, rewrite it around this person's exact thread and add one specific next handle. Do not settle for passive mirroring, generic praise, or "that makes sense" unless the moment is clearly closing.
- Specific does not mean copied or invented. Never repeat an unusual five-word phrase from their newest message as if it were Shannon's own thought. If they introduce an unfamiliar artist, person, place, product, event, song, or business, do not claim Shannon knows it, likes it, rates it, has heard of it, or agrees with their assessment unless earlier Shannon messages or another verified source prove that familiarity. React to what they said, be honest that it is new to Shannon when useful, or ask the natural context question without pretending.
- Avoid weak generic discovery stems: "what kind of difference would that make?", "what usually makes it feel like such a struggle?", "anything in particular making it hectic?", "how are you finding it so far?", "does that actually help?", and "what does that look like for you?". Replace them with one plain, concrete question from their words: "how long has dinner been hard with the kids?", "when did the move start throwing your routine around?", or "what part of the program looks hardest to fit in this week?" Never offer answer options just to make the question easier to generate.
- Do not describe an obvious thing back to them as the whole value. "busy weeks are tough", "sounds like a mission", "that's a tough one to navigate", and "black coffee is a classic" need a specific angle or should be cut.
- Progression does not mean rushing the challenge offer. It means one useful inch forward: a concrete question, a tiny useful lens, a playful specific hook, or an earned soft permission bridge when their own words justify it.
- Avoid lazy statement-only dead ends when there is a live help/sales signal. If the current topic is food, group classes, a project, or skepticism about wellness fads and they are clearly engaging, move that exact topic one notch deeper before switching to unrelated work/day chat. If it is just light banter or a quick update, a strong specific reaction can be enough.
- Avoid validation loops. If the last Shannon reply already said "totally fair", "no stress", "that makes sense", or "hope it goes smoothly", the next reply must add a new angle: a micro-tip, a fit question, a reframe, or a soft future handle.
- If they reveal something they love or something that annoys/stresses them, stay with that thread for a beat. Relate only if it is honest and light, then bring the spotlight back to them.
- A relationship question does not have to be the last bubble. If it is sparked by a specific thing they said, ask it while talking about that thing, then continue the reply.
- Do not bundle questions. Never ask name + age + goal + blocker together.
- If the discovery question is about relationship context, ask one light version and stop. Do not tack on a fitness goal in the same reply.
- If they are already asking how to join, accepted the Founders Pass, or clearly want the link, move them forward with the short six-week/app/community explanation plus the next step instead of slowing them down with more questions.
- If they say they want local/in-person coaching, explain that the Founders Pass is an online guided app and plant-based community before any invite or link. If they already have a PT/trainer/coach, answer how it could fit around that before pitching.
- Do not drop an offer invite just because they are friendly, vaguely interested, or mention fitness/food. This timing rule is for unlinked leads only, not clients/app users. Wait for either a human signal ("I need help", "I dunno what I'm doing", "where do I start?", "what's included?", "send the link", "founders pass details", or an obvious join/start request) or enough earned context for a soft bridge. Earned context means Shannon already has a normal-life anchor, useful goal/blocker context, and usually 3-6 meaningful lead replies. In that case explain the app setup first, ask if they want details only if they have not already asked, and do not send the link unless they accept.
- When the soft bridge is right, make it fluid and specific. Avoid generic lines that say the offer is made for this exact situation. Use their words as the entry point: "since you're already [making this change], the founders pass gives you the six-week plan in Balance and the plant-based community around it...". It should feel like Shannon noticed the opening, not like the funnel fired.
- Once they have shared enough real context plus a clear blocker/goal, do not keep asking getting-to-know-you questions. Use a specific, optional bridge or useful next lens.
- The preferred late bridge is the Founders Pass in DMs: connect the offer to their exact situation, offer the details, and send the approved Founders Pass link when they ask or accept. Use the call path only for an explicit talk request, genuine unresolved uncertainty, or a situation needing Shannon's judgement.`;
}

function buildConversationLanePolicyBlock({ linkedUserId } = {}) {
    if (!linkedUserId) {
        return `

LEAD CONVERSATION MODE:
- This is an acquisition relationship. Earn the next response when there is a real opening, without interrogating. A reply can earn it through recognition, humour, a direct answer, a useful reflection, a specific reaction, or one purposeful question.
- Be a little more question-led than with clients, but every question needs a relationship, qualification, support, objection, or offer reason. Never ask merely to keep the chat alive.`;
    }
    return `

CLIENT RELATIONSHIP MODE (HARD LANE SEPARATION):
- This person is linked to Balance, so treat them as an existing client even if lead_stage is stale. Do not apply acquisition momentum, qualification pressure, or the lead rule that every turn should earn another response.
- The relationship is already established. Default to being chill: answer, coach, reassure, celebrate, banter, give one useful direction, react, or leave a clean pause.
- Do not append a question just to keep the conversation open. Ask one only when the missing answer materially changes Shannon's coaching/support decision, or the client has naturally opened a topic worth exploring.
- A client's answer can simply be enough. Do not turn it into the next question in a ladder. This is not a ban on questions; it is a ban on lead-style progression pressure in client chats.`;
}

function buildPaidMetaConversationWriterBlock({ linkedUserId = null, acquisitionMode = '', flowVariant = 'plant_based_control' } = {}) {
    if (linkedUserId || !isPaidMetaAcquisitionMode(acquisitionMode)) return '';
    if (flowVariant === 'broad_pain') return `

PAID META BROAD-PAIN SINGLE-WRITER PLAYBOOK:
- This route came from verified broad-ad attribution. Keep it general fitness. Do not introduce plant-based, vegan or vegetarian positioning, and never ask vegan status, duration or reason.
- Use no more than two discovery questions in the complete episode. The only discovery jobs are the desired change over the next six weeks, then the real-life blocker or support need. Skip either question when the lead already supplied that fact.
- Every ordinary reply starts by answering or reflecting one exact detail from the newest lead turn. Keep it statement-led and use at most one decision-changing question in a turn.
- Once goal and blocker/support need are known, stop discovery. Explain the six-week Foundations setup in neutral language: workout program around their week, meal-plan support fitted to dietary preferences, one weekly training/food review and adjustment, and six weeks of app/community access.
- State the terms exactly when the offer is explained: one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. Offer the free personalised app preview before payment.
- Know the fixed course curriculum so you can answer accurately when asked: week 1, Why change feels hard; week 2, Work with your energy; week 3, Build a rhythm that sticks; week 4, Take the fight out of food; week 5, Make progress easier to repeat; week 6, Build your sustainable way forward. The course uses lessons, practical actions and Weekly Goals alongside their workout and nutrition setup. Do not recite all six weeks in an ordinary pitch. Give the full outline only when they ask about the curriculum or week-by-week course, otherwise mention only the one or two themes relevant to their goal or blocker.
- Keep the fixed curriculum distinct from the personalised parts. The workout program, nutrition setup and Shannon's review can fit the person; do not claim the six course themes themselves are individually rewritten for every lead.
- When they ask to see the preview or accept it, the signed preview must be sent immediately without reconfirming or collecting contact details. A generic "I'm ready" stays on the promised preview path. Checkout is only for an explicit request to join, pay, sign up or receive the checkout link.
- Keep replies concise, specific, warm and low-pressure. No intake bundles, option menus, brochure copy, or invented personal context.`;
    return `

PAID META SINGLE-WRITER PLAYBOOK:
- You own the conversational reply from the complete conversation episode and the complete current unanswered message batch. Other code may attach approved proof media or an exact preview/checkout destination, but it must not invent or force ordinary conversation copy after you write. Paid Meta replies are text-only; never write a synthetic voice-note script or announce a voice message.
- Read the complete visible timeline. Answer the newest message first and treat an obvious answer as an answer to Shannon's last question.
- Treat all rapid unanswered inbound bubbles as one live turn. Answer every direct or reciprocal question in that batch before progressing the sale; never discard a side-question just because their last bubble adds a blocker.
- Once Shannon has already sent any reply in the visible episode, do not restart with a time-of-day greeting or another hello.
- If Shannon's immediately previous message already explained the offer, do not explain it again when the lead answers her question. Acknowledge the answer and move to the next adjacent stage.
- Use this as a natural journey, not a checklist: find out whether they are already plant-based/vegan or looking to become so; when it fits, connect over why and how long; understand their health or fitness goal; understand what has made that goal difficult; show a genuinely relevant client result when identity, safety and outcome fit are reliable; then offer to open their free personalised workout and meal-plan preview inside the app before they decide or pay.
- Skip anything the lead has already answered. Do not force every stage into every conversation, and do not make goal or blocker fields mechanical gates. Use judgement about the most useful adjacent move.
- When their difficulty is known, use it to explain specifically how Balance could make follow-through easier. Do not mine distress, diagnose them, or repeat their problem back without adding value.
- Relevant client proof should normally be used once when the match is reliable. Ally fits weight loss; Gen fits strength/confidence; Dani fits body recomposition; Bec and Kirsty fit shared accountability. Use no transformation when identity, sensitivity or fit is uncertain. If you choose one, explicitly name the approved person and say you are showing their photo so transport code can attach it.
- The deterministic transport may attach the approved quick app video once, after both their goal and practical blocker are known. Do not invent a video URL, repeat the video, or use it as a substitute for the signed personalised preview.
- When explaining the offer, keep the facts reliable: the six-week Foundations course includes their workout program, meal-plan support fitted to their recorded dietary needs, and one weekly training/food check-in and adjustment. It is one $149 payment with no subscription or auto-renewal. The free personalised app preview comes before payment.
- Never ask the lead for an email address in Instagram. When they accept the free personalised preview, transport code sends the signed Open your preview card immediately; account creation inside that onboarding collects their email.
- If they mention pregnancy or post-pregnancy weight as a goal without reporting a symptom or complication, keep it in the ordinary fitness lane. Do not invent children, ask for medical history, or make pregnancy recency the next question; respond to the fitness goal and ask about the current practical obstacle only if needed.
- Usually end with one short new question when its answer will genuinely change the next reply. A direct answer, signed preview/checkout link handoff, opt-out, sensitive safety response, sales-suspicion answer or natural pause may stand alone.
- Never repeat or lightly reword a question Shannon already asked. Never echo the lead's sentence back as Shannon's reply. Use their answer, add a relevant coaching or proof point, then make the next adjacent move.
- Treat a stated target as a target, not completed progress. For example, "I want to lose 10kg" must never become "10kg down".
- When they ask about the program, price, inclusions or personalised coaching, answer that direct question before qualifying further. A positive reaction such as "looks great" is not permission to offer checkout. Send checkout only after explicit transactional intent such as asking to join, pay, sign up or receive the checkout link.
- For inclusions, answer accurately: workout programming, plant-based meal planning, six weeks of app/community access, and one weekly training/food review and adjustment. Do not claim an endlessly tailored daily meal plan or unlimited coaching.
- If they ask whether Shannon is trying to sell them something, answer plainly that Balance is a paid program and Shannon is checking whether it fits before offering it. Then back off. No question, pitch, link, euphemism or continuation hook in that reply.
- Keep it like a real active DM: concise, specific, warm and low-pressure. No intake bundles, option menus, canned therapy language or brochure dump.`;
}

function buildPaidMetaAgentPrompt({
    leadName = 'Lead',
    channelLabel = 'Instagram',
    timeline = '',
    unansweredMessages = [],
    flowVariant = 'plant_based_control',
} = {}) {
    const batch = (Array.isArray(unansweredMessages) ? unansweredMessages : [])
        .map(message => String(message?.text || message || '').trim())
        .filter(Boolean)
        .map((message, index) => `${index + 1}. ${message}`);
    const broadFlow = flowVariant === 'broad_pain';
    const journey = broadFlow
        ? 'Natural journey, not a checklist: learn the change they most want over the next six weeks, then the real-life blocker or support need. Those are the only two discovery jobs. Skip either when the lead already supplied it. Once both are known, stop discovery, explain the neutral six-week setup and truthful terms, then offer the free personalised app preview before payment.'
        : 'Natural journey, not a checklist: learn whether they are plant-based/vegan or looking to become so; connect over why and how long when natural; learn their health or fitness goal; learn what is making that goal difficult; introduce genuinely relevant proof when identity, safety and outcome fit are reliable; explain how Balance helps with their stated situation; offer a free personalised look at their workout program and plant-based meal plan inside the app before they decide or pay.';
    const progression = broadFlow
        ? `GUIDE THE SALE: use no more than two discovery questions across the complete episode. First ask the desired six-week change only if it is unknown. Then ask the real-life blocker only if it is unknown. Every ordinary reply should answer or reflect one exact detail from the newest lead turn and remain statement-led, with at most one decision-changing question. Once goal and blocker are known, do not ask another discovery question. Explain the program and offer the personalised preview. The preview-consent question is an offer decision, not a third discovery question.

BROAD ROUTE GUARD: do not introduce plant-based, vegan or vegetarian positioning, and never ask status, duration or reason. Describe the meal plan as fitted to their dietary preferences. A generic "I'm ready" does not bypass the promised preview. Checkout is only for an explicit request to join, pay, sign up or receive the checkout link.`
        : 'GUIDE THE SALE: every ordinary discovery reply must both respond to what they said and ask exactly one useful next question from the next adjacent part of that journey. Do not merely answer and stop. After answering a reciprocal question about Shannon, continue with the most natural unanswered question about them in the same turn. Once their plant-based reason or duration has enough context, move forward to their fitness goal instead of drilling deeper into the same reason. Once the goal is known, move to what is making it difficult. Once the difficulty is known, add useful value and move toward matched client proof or the free preview.';
    const knownFactRule = broadFlow
        ? 'Skip anything already answered. Never repeat or lightly reword a question Shannon already asked. Do not invent personal facts about Shannon or the lead.'
        : 'Skip anything already answered. Never repeat or lightly reword a question Shannon already asked. Do not invent personal facts about Shannon or the lead. The only approved reciprocal fact is that Shannon has been vegan for five years. If asked why Shannon went vegan, do not guess; answer briefly that he has been vegan five years and turn the focus naturally back to their story only if useful.';
    const linkQuestionRule = broadFlow
        ? 'Use at most one decision-changing question in an ordinary turn. A signed preview/checkout link, opt-out, sensitive issue, handoff or natural close has no question and pauses.'
        : 'The one-next-question rule applies unless this turn sends a signed preview/checkout link, handles an opt-out or sensitive issue, hands off, or is clearly closing the conversation.';
    return `You are Shannon's dedicated paid-Meta lead conversation agent for Balance. You are not the in-app AI coach, client-support agent, organic-follower agent, or generic lead qualifier. Those agents' rules and state do not apply here.

Your job is to read the complete paid-ad conversation and write Shannon's next Instagram DM. Treat every unanswered bubble as one current turn. Answer every live direct or reciprocal question before making the next sales move. The newest substantive message controls when it changes the topic.

${journey}

${progression}

${knownFactRule}

Client proof should normally be used once when it genuinely matches: Ally for weight loss, Gen for strength/confidence, Dani for body recomposition, Bec and Kirsty for shared accountability. Use no transformation when identity, safety or fit is uncertain. If using proof, name the approved person and say you are showing their photo. The deterministic transport may add the approved quick app video after both goal and blocker are known; do not invent URLs or repeat it.

Reliable offer facts: Balance Foundations is a six-week program inside Balance with a personalised workout program, meal-plan support fitted to recorded dietary needs, and one weekly training/food review and adjustment. It is one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. The personalised app preview comes before payment.

Verified course curriculum, for direct course, lesson or week-by-week questions: week 1, Why change feels hard; week 2, Work with your energy; week 3, Build a rhythm that sticks; week 4, Take the fight out of food; week 5, Make progress easier to repeat; week 6, Build your sustainable way forward. The course uses lessons, practical actions and Weekly Goals alongside the person's workout and nutrition setup. Do not dump all six weeks into an ordinary pitch. Give the full outline only when they ask for curriculum detail; otherwise use only the one or two themes relevant to their words.

Send the signed preview immediately after they ask to see it or accept the free personalised preview. A positive reaction such as "looks great" is not checkout intent. Send checkout only after they explicitly ask to join, pay, sign up or receive the checkout link. Hand off instead of improvising for medical/safety issues, account or payment support, existing-client app support, or a direct request for Shannon. Keep replies quick, warm, concise and human. ${linkQuestionRule} Never reveal automation or AI. No em dashes.

Campaign variant: ${flowVariant}
Channel: ${channelLabel}
Lead: ${leadName}

COMPLETE PAID-META CONVERSATION (oldest to newest):
${timeline || '(no earlier tracked messages)'}

CURRENT UNANSWERED TURN (oldest to newest):
${batch.join('\n') || '(no text)'}

Return JSON only: {"messages":["bubble 1","bubble 2 if a natural pause helps"]}. Use 1 to 3 short bubbles.`;
}

function paidMetaFitnessGoalFromFacts(facts = {}) {
    const candidates = [facts.motivation, facts.current_state]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    return candidates.find(value => PAID_META_FITNESS_GOAL_RE.test(value)) || '';
}

function paidMetaBlockerFromFacts(facts = {}) {
    const candidates = [
        facts.history_blockers,
        facts.relationship_checklist?.stressors_frustrations,
        facts.relationship_context,
    ]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    return candidates.find(value => isPaidMetaConcreteBlocker(value)) || '';
}

function lastPaidMetaOutbound(history = []) {
    return [...(Array.isArray(history) ? history : [])]
        .reverse()
        .find(message => String(message?.direction || '').toLowerCase() === 'out') || null;
}

function paidMetaOutboundAskedForGoal(text = '') {
    const value = String(text || '');
    return /\b(?:main|biggest|primary)\b[^?\n]{0,80}\b(?:health|fitness|fit|goal|result|change|achieve|working towards)\b[^?\n]{0,80}\?/i.test(value)
        || /\bwhat(?:'s| is) your (?:health or fitness |fitness |main )?goal\b[^?\n]*\?/i.test(value)
        || /\bwhat result (?:are you|would you be)\b[^?\n]*\?/i.test(value);
}

function paidMetaOutboundAskedForBlocker(text = '') {
    const value = String(text || '');
    return /\bwhat\b[^?\n]{0,100}\b(?:gets? in the way|getting in the way|makes? (?:that|it) hard|hardest|throws? you off|knocks? you off|stops? you|breaks? the follow[ -]?through|makes? (?:it|that) difficult|keep(?:ing)? (?:it|that) consistent|stay consistent|stick to|stay on track)\b[^?\n]*\?/i.test(value)
        || /\bwhat(?:'s| is) (?:been )?the (?:main |biggest )?(?:thing|bit|barrier|obstacle)\b[^?\n]{0,80}\b(?:hard|way|stop|consistent|track|routine)\b[^?\n]*\?/i.test(value);
}

function paidMetaHistoryHasFitnessGoal(history = []) {
    return (Array.isArray(history) ? history : [])
        .filter(message => String(message?.direction || '').toLowerCase() === 'in')
        .some(message => PAID_META_FITNESS_GOAL_RE.test(String(message?.text || '')));
}

function buildPaidMetaTurnDirective({ qualifier = {}, inboundMessages = [], history = [] } = {}) {
    const messages = (Array.isArray(inboundMessages) ? inboundMessages : [])
        .map(message => String(message?.text || message || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (!messages.length) return '';
    const directQuestions = messages.filter(message => /\?|\b(?:how about you|what about you|was this your client|is this your client)\b/i.test(message));
    const exactDetails = messages.join(' | ');
    return `

CURRENT PAID-META TURN CONTEXT (use judgement; never recite labels):
- Exact unanswered lead details: ${exactDetails}
- Respond to every meaningful detail in this batch and ground the reply in their actual words rather than a generic script.
${directQuestions.length ? `- Direct questions that must be answered before choosing the next natural move: ${directQuestions.join(' | ')}` : '- No unresolved direct question detected in this inbound batch.'}
- Consult the complete episode to decide what they already told Shannon. Choose the most natural adjacent move from connection, goal, difficulty, relevant proof, app demonstration, or free personalised preview; do not repeat a question or force a stage.`;
}

function attachPaidMetaWriterSelectedMedia(draft = {}, {
    allowAttachments = false,
    flowVariant = 'plant_based_control',
    history = [],
} = {}) {
    if (!allowAttachments) return draft;
    const replyText = draftTextFromDraft(draft);
    if (!replyText) return draft;
    if (flowVariant === 'broad_pain') {
        if (!hasCompletePaidMetaOfferText(replyText) || hasRecentPaidMetaProofVideo(history)) return draft;
        const chunks = (Array.isArray(draft?.chunks) ? draft.chunks : [])
            .map(value => String(value || '').trim())
            .filter(Boolean);
        if (!chunks.length) chunks.push(replyText);
        const videoUrl = resolveBalanceFoundationsAppProofVideoUrl();
        if (!maySendDraftVideoAttachment({ videoUrl, replyText })) {
            const finalIndex = chunks.length - 1;
            chunks[finalIndex] = `Here's a quick video showing you how it works inside Balance. ${chunks[finalIndex]}`;
        }
        return {
            ...draft,
            chunks,
            joined: chunks.join('\n\n'),
            videoAttachmentUrl: draft.videoAttachmentUrl || videoUrl,
        };
    }
    const proofCandidates = [
        { name: /\bally\b/i, imageUrl: ALLY_WEIGHT_LOSS_PROOF_URL },
        { name: /\bgen\b/i, imageUrl: GEN_STRENGTH_CONFIDENCE_PROOF_URL },
        { name: /\bbec\b[^.!?\n]{0,30}\bkirsty\b|\bkirsty\b[^.!?\n]{0,30}\bbec\b/i, imageUrl: BEC_KIRSTY_SHARED_MOMENTUM_PROOF_URL },
        { name: /\bdani\b/i, imageUrl: DANI_RECOMPOSITION_PROOF_URL },
    ];
    const selectedProof = proofCandidates.find(candidate => candidate.name.test(replyText)
        && maySendDraftImageAttachment({ imageUrl: candidate.imageUrl, replyText }));
    return {
        ...draft,
        imageAttachmentUrl: draft.imageAttachmentUrl || selectedProof?.imageUrl || null,
        // Preserve only a video selected by the qualified-offer or explicit-retry path.
        videoAttachmentUrl: draft.videoAttachmentUrl || null,
    };
}

function ensurePaidMetaAppVideoPreviewCta(draft = {}) {
    if (!isBalanceFoundationsAppProofVideoUrl(draft?.videoAttachmentUrl)) return draft;
    const replyText = draftTextFromDraft(draft);
    const alreadyOffersSetupBeforePayment = /\b(?:set(?:ting)?|build(?:ing)?)\b[^.!?\n]{0,80}\b(?:program|workout|meal plan|plan|preview)\b[^.!?\n]{0,100}\b(?:before (?:you )?(?:pay|decide)|before payment)\b/i.test(replyText)
        && /\?/.test(replyText);
    if (alreadyOffersSetupBeforePayment) return draft;

    const cta = "If this looks right for you, let me know. Want me to set up your program before payment so you can get a proper feel for what you're paying for?";
    const chunks = (Array.isArray(draft?.chunks) ? draft.chunks : [])
        .map(value => String(value || '').trim())
        .filter(Boolean);
    if (!chunks.length && replyText) chunks.push(replyText);
    const maxChunks = Math.max(2, Number(draft?.maxChunks) || MAX_CHUNKS);
    if (chunks.length >= maxChunks) {
        chunks[maxChunks - 1] = `${chunks[maxChunks - 1]}\n\n${cta}`;
    } else {
        chunks.push(cta);
    }
    const finalChunks = chunks.slice(0, maxChunks);
    return {
        ...draft,
        chunks: finalChunks,
        joined: finalChunks.join('\n\n'),
        maxChunks,
    };
}

function collectPaidMetaWriterContractIssues({ draft = {}, currentMessage = '', qualifier = {}, history = [], flowVariant = 'plant_based_control' } = {}) {
    const reply = draftTextFromDraft(draft);
    const turn = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!reply || !turn) return [];
    if (draft?.replyMode === 'campaign_first_reply'
        && /^deterministic_meta_ad_founders_pass_v\d+$/.test(String(draft?.model || ''))) {
        return [];
    }
    const issues = [];
    const broadFlow = flowVariant === 'broad_pain';
    const asksForCurriculumOutline = /\b(?:what do i (?:actually )?learn|what (?:will|do) (?:i|you) learn|what does (?:the )?course teach|week[ -]?by[ -]?week|curriculum|six[- ]week (?:course|outline)|course (?:content|lessons?))\b/i.test(turn);
    const asksOfferInfo = /\b(?:how much|price|cost|renew|what(?:'s| is) included|what do i get|do i (?:actually )?get|workouts?|meal plan|check[ -]?in|details|how (?:does|do) (?:it|the program) work)\b/i.test(turn);
    const asksMealPlanQuestion = /\bdo you (?:offer|have|provide|include) (?:a |any )?(?:plant[ -]?based )?meal plans?\b|\bis (?:a |the )?meal plan included\b/i.test(turn);
    const asksGlutenFreeSupport = /\bgluten[ -]?free\b/i.test(turn)
        && /\b(?:do you do that|can you (?:do|support|make|cater for) that|do you (?:support|cater for) that)\b|\?/i.test(turn);
    const asksPlantReciprocal = /\b(?:how|what) about you\b/i.test(turn)
        && (/\b(?:vegan|plant[ -]?based)\b/i.test(turn) || hasRecentPaidMetaPlantReasonQuestion(history));
    const answeringPlantIdentity = hasRecentPaidMetaPlantBasedQuestion(history)
        && /\b(?:plant[ -]?based|vegan|vegetarian|not fully|trying|transition|adopt|mostly)\b/i.test(turn);
    const plantDuration = turn.match(/\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/i)?.[1] || '';
    const durationWordByNumber = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
    const durationNumberByWord = Object.fromEntries(Object.entries(durationWordByNumber).map(([number, word]) => [word, number]));
    const durationNumber = /^\d+$/.test(plantDuration)
        ? plantDuration
        : String(durationNumberByWord[plantDuration.toLowerCase()] || '');
    const durationWord = durationWordByNumber[durationNumber] || plantDuration;
    const plantDurationReplyPattern = plantDuration
        ? new RegExp(`\\b(?:${durationNumber || plantDuration}|${durationWord})\\b`, 'i')
        : null;
    if (asksPlantReciprocal && !/\b(?:five|5) years?\b/i.test(reply)) {
        issues.push('Answer the reciprocal plant-based question explicitly: Shannon has been vegan for five years.');
    }
    if (/\baccountab/i.test(turn)) {
        for (const inventedDetail of ['kids?', 'work', 'prep']) {
            const pattern = new RegExp(`\\b${inventedDetail}\\b`, 'i');
            if (!pattern.test(turn) && pattern.test(reply)) {
                issues.push(`The reply invented ${inventedDetail.replace('?', '')} context that the lead did not supply. Remove it.`);
            }
        }
    }

    if (/\b(?:was|is) (?:this|that|she|he) (?:one of )?your clients?\b/i.test(turn)
        && !/\b(?:yes|yeah|yep)[,!. ]{0,4}(?:she|he|that|this) (?:is|was)\b|\b(?:she|he|that|this)(?:'s| is| was) (?:one of )?my clients?\b|\bone of my clients?\b/i.test(reply)) {
        issues.push('The lead directly asked whether the proof person was Shannon\'s client. Answer that direct question explicitly before discussing their blocker.');
    }
    if (plantDuration && answeringPlantIdentity
        && !plantDurationReplyPattern.test(reply)) {
        issues.push(`The reply ignored the supplied plant-based duration (${plantDuration} years). Acknowledge that exact detail naturally.`);
    }
    const suppliedTurnDetails = [
        ['lack of time', /\b(?:lack of|no|not enough) time\b/i, /\btime\b/i],
        ['preparation', /\b(?:no prep|prep|prepar)\w*\b/i, /\b(?:prep|prepar)\w*\b/i],
        ['food', /\b(?:food|meal|eating)\b/i, /\b(?:food|meal|eating)\b/i],
        ['accountability', /\baccountab\w*\b/i, /\b(?:accountab\w*|weekly check[ -]?in)\b/i],
    ].filter(([, signal]) => signal.test(turn));
    const missingTurnDetails = suppliedTurnDetails.filter(([, , evidence]) => !evidence.test(reply));
    if (missingTurnDetails.length > 0) {
        issues.push(`The rapid inbound turn supplied ${suppliedTurnDetails.map(([label]) => label).join(', ')}. Preserve all of those details together; the reply dropped ${missingTurnDetails.map(([label]) => label).join(', ')}.`);
    }
    if (/\b(?:trying to sell|sales pitch|just selling|sell me something)\b/i.test(turn)) {
        if (!/\b(?:paid|sell|sale|program)\b/i.test(reply)) issues.push('Answer the sales question honestly: Balance is a paid program.');
        if (/\?/.test(reply)) issues.push('Sales suspicion requires a direct answer and space: remove every follow-up question and continuation hook.');
    }
    if (asksOfferInfo && /\b(?:workouts?|meal plan)\b/i.test(turn) && !/\b(?:weekly|check[ -]?in|review)\b/i.test(reply)) {
        issues.push('The lead asked what they get. Include the one weekly training and food review/check-in in the direct answer.');
    }
    if (asksMealPlanQuestion
        && !/\b(?:yes|yeah|yep)[,.! ]{0,8}(?:i do|it does|there is)|\b(?:includes?|comes with|you get)\b[^.!?\n]{0,80}\bmeal plan\b/i.test(reply)) {
        issues.push(broadFlow
            ? 'Answer the meal-plan question directly before progressing: yes, Balance Foundations includes meal-plan support fitted to dietary preferences.'
            : 'Answer the meal-plan question directly before progressing: yes, Balance Foundations includes a plant-based meal plan.');
    }
    if (asksGlutenFreeSupport
        && !/\b(?:yes|yeah|yep|absolutely)\b[^.!?\n]{0,100}\bgluten[ -]?free\b|\bgluten[ -]?free\b[^.!?\n]{0,100}\b(?:meal plan|meals?)\b/i.test(reply)) {
        issues.push(broadFlow
            ? 'Answer the gluten-free question directly before progressing: yes, the meal plan can be fitted to gluten-free dietary preferences.'
            : 'Answer the gluten-free question directly before progressing: yes, Shannon can make their plant-based meal plan gluten-free.');
    }
    if (/\b(?:how much|price|cost)\b/i.test(turn)
        && !/\bone\s+(?:(?:aud|au\$)\s+)?\$149\s+payment\s+for\s+the\s+full\s+six\s+weeks\b/i.test(reply)) {
        issues.push('Answer the price exactly as one $149 payment for the full six weeks.');
    }
    if (/\b(?:e-?mail|email address|best email)\b/i.test(reply)) {
        issues.push('Do not ask for an email in Instagram. Send the signed app-preview card; onboarding collects the account email there.');
    }
    if (!hasDirectPaidMetaCheckoutIntent(turn)
        && /\b(?:checkout link|send you (?:the )?(?:payment|checkout) link|grab (?:the )?founders? pass|ready to (?:pay|join|sign up))\b/i.test(reply)) {
        issues.push('The reply offered checkout without explicit transactional intent. Keep the lead in the free personalised preview flow until they ask to join, pay, sign up or receive checkout.');
    }
    if (broadFlow && /\b(?:plant[ -]?based meal plan|plant[ -]?based fitness program|plant[ -]?based community)\b/i.test(reply)) {
        issues.push('The broad paid-ad reply introduced plant-based offer positioning. Replace it with neutral fitness and dietary-preference language.');
    }
    if (broadFlow && /\b(?:are you|how long have you been|what made you (?:go|become))\b[^?\n]{0,80}\b(?:vegan|vegetarian|plant[ -]?based)\b[^?\n]*\?/i.test(reply)) {
        issues.push('The broad paid-ad reply asked a vegan or plant-based discovery question. Remove it and use only the six-week change or real-life blocker question when still missing.');
    }
    if (broadFlow && (String(reply).match(/\?/g) || []).length > 1) {
        issues.push('The broad paid-ad reply asked more than one question. Keep at most one decision-changing question in the turn.');
    }
    if (broadFlow && asksForCurriculumOutline) {
        const requiredCurriculumTitles = [
            'Why change feels hard',
            'Work with your energy',
            'Build a rhythm that sticks',
            'Take the fight out of food',
            'Make progress easier to repeat',
            'Build your sustainable way forward',
        ];
        const missingCurriculumTitles = requiredCurriculumTitles.filter(title => !reply.toLowerCase().includes(title.toLowerCase()));
        if (missingCurriculumTitles.length > 0) {
            issues.push('The direct course question requires the full six-week course outline. Include all six verified week titles, then keep the fixed curriculum distinct from the personalised workout and nutrition setup.');
        }
    }
    const knownBroadGoal = broadFlow && (
        PAID_META_FITNESS_GOAL_RE.test(turn)
        || paidMetaHistoryHasFitnessGoal(history)
        || !!paidMetaFitnessGoalFromFacts(qualifier?.facts || {})
    );
    const knownBroadBlocker = broadFlow && (
        isPaidMetaConcreteBlocker(turn)
        || paidMetaHistoryHasConcreteBlocker(history)
        || qualifierHasKnownMetaAdBlocker(qualifier)
    );
    const broadGoalNeedsBlockerQuestion = broadFlow
        && PAID_META_FITNESS_GOAL_RE.test(turn)
        && !knownBroadBlocker
        && !asksForCurriculumOutline
        && !asksOfferInfo
        && !isExplicitPaidMetaPreviewRequest(turn)
        && !hasDirectPaidMetaCheckoutIntent(turn);
    if (broadGoalNeedsBlockerQuestion && !paidMetaOutboundAskedForBlocker(reply)) {
        issues.push('The lead answered the goal question, but the reply stopped after acknowledging it. Ask the one real-life blocker question so the conversation can progress.');
    }
    const earnedBroadOfferNow = knownBroadGoal
        && knownBroadBlocker
        && !asksForCurriculumOutline
        && !hasRecentCompletePaidMetaOffer(history)
        && !isExplicitPaidMetaPreviewRequest(turn)
        && !hasDirectPaidMetaCheckoutIntent(turn);
    if (earnedBroadOfferNow && !hasCompletePaidMetaOfferText(reply)) {
        issues.push('The earned paid-Meta offer is missing the complete offer contract. State the neutral six-week setup, one AUD $149 payment for the full six weeks, no subscription or auto-renewal, and offer the personalised preview before payment.');
    }
    const normalizeQuestion = value => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9?\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const replyQuestions = String(reply || '').match(/[^.!?]*\?/g) || [];
    const previousQuestions = (Array.isArray(history) ? history : [])
        .filter(message => String(message?.direction || '').toLowerCase() === 'out')
        .slice(-4)
        .flatMap(message => String(message?.text || '').match(/[^.!?]*\?/g) || []);
    const questionKind = question => {
        if (paidMetaOutboundAskedForGoal(question)) return 'goal';
        if (paidMetaOutboundAskedForBlocker(question)) return 'blocker';
        return '';
    };
    if (replyQuestions.some(question => previousQuestions.some(previous => (
        normalizeQuestion(previous) === normalizeQuestion(question)
        || (!!questionKind(question) && questionKind(previous) === questionKind(question))
    )))) {
        issues.push('The reply repeated a question Shannon had just asked. Use the lead\'s answer and move to the next missing goal or blocker instead.');
    }
    return issues;
}

function isBlockingPaidMetaWriterContractIssue(issue = '') {
    return /repeated a question|directly asked whether|answer why Shannon went vegan|meal-plan question directly|gluten-free question directly|sales suspicion|answer the sales question|answer the price exactly|do not ask for an email|offered checkout without explicit transactional intent|ignored the supplied plant-based duration|broad paid-ad reply|answered the goal question|full six-week course outline|earned paid-Meta offer is missing/i.test(String(issue || ''));
}

function buildPaidMetaGuaranteedContractFallback({ draft = {}, currentMessage = '', issues = [], qualifier = {}, history = [], flowVariant = 'plant_based_control' } = {}) {
    const issueText = (Array.isArray(issues) ? issues : []).join(' ');
    const turn = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    const fallbackFacts = qualifier?.facts && typeof qualifier.facts === 'object' ? qualifier.facts : {};
    const fallbackGoal = paidMetaFitnessGoalFromFacts(fallbackFacts) || paidMetaLatestFitnessGoalText(history);
    const repairsEarnedOffer = /earned paid-Meta offer is missing/i.test(issueText)
        || (/pitched before|repeated a question/i.test(issueText)
            && !!fallbackGoal
            && isPaidMetaConcreteBlocker(turn));
    let joined = '';
    let fixedChunks = null;
    if (/full six-week course outline/i.test(issueText)) {
        fixedChunks = [
            'Yep, the course gives you one practical focus each week:',
            'Week 1, Why change feels hard. Week 2, Work with your energy. Week 3, Build a rhythm that sticks.',
            'Week 4, Take the fight out of food. Week 5, Make progress easier to repeat. Week 6, Build your sustainable way forward.',
            'The lessons, practical actions and Weekly Goals sit alongside your workout and nutrition setup. The six themes stay consistent, while your workout and meal support are fitted to you.',
        ];
        joined = fixedChunks.join('\n\n');
    } else if (/offered checkout without explicit transactional intent/i.test(issueText)) {
        const mealPlanCopy = flowVariant === 'broad_pain'
            ? 'meal plan fitted to your dietary preferences'
            : 'plant-based meal plan';
        joined = `The next step is your free personalised preview, so you can look through your own workout program and ${mealPlanCopy} before paying. Want me to open that for you?`;
    } else if (/broad paid-ad reply/i.test(issueText)) {
        const knownBlocker = isPaidMetaConcreteBlocker(turn) || paidMetaHistoryHasConcreteBlocker(history);
        if (fallbackGoal && knownBlocker) {
            joined = buildPaidMetaTailoredOfferText(turn || paidMetaLatestConcreteBlockerText(history), fallbackGoal, flowVariant);
        } else if (fallbackGoal) {
            joined = buildPaidMetaGoalToBlockerText(fallbackGoal);
        } else {
            joined = `Yeah, I can help you get a clear six-week starting plan around your real week. What's the main change you'd like to make over the next six weeks?`;
        }
    } else if (/sales suspicion|answer the sales question/i.test(issueText)) {
        joined = 'Yeah, Balance is a paid program. I’m just checking whether it actually fits what you need before I offer you anything.';
    } else if (/directly asked whether/i.test(issueText)) {
        const existing = draftTextFromDraft(draft)
            .replace(/^(?:yeah|yes|yep)[,.! ]*/i, '')
            .trim();
        joined = `Yeah, she was one of my clients.${existing ? ` ${existing}` : ''}`;
    } else if (/gluten-free question directly/i.test(issueText) && !repairsEarnedOffer) {
        const nextQuestion = fallbackGoal
            ? 'What usually gets in the way of making that happen consistently?'
            : (flowVariant === 'broad_pain'
                ? `What's the main change you'd like to make over the next six weeks?`
                : 'How long have you been plant-based, and what made you go plant-based?');
        joined = flowVariant === 'broad_pain'
            ? `Yep, absolutely. I can fit the meal plan to gluten-free dietary preferences too. ${nextQuestion}`
            : `Yep, absolutely. I can make your plant-based meal plan gluten-free too. ${nextQuestion}`;
    } else if (/meal-plan question directly/i.test(issueText) && !repairsEarnedOffer) {
        const nextQuestion = fallbackGoal
            ? 'What usually gets in the way of making that happen consistently?'
            : "What's your main health or fitness goal at the moment?";
        joined = flowVariant === 'broad_pain'
            ? `Yeah, I do. Balance Foundations includes meal-plan support fitted to your dietary preferences alongside your workout program and weekly check-in. ${nextQuestion}`
            : `Yeah, I do. Balance Foundations includes a plant-based meal plan alongside your workout program and weekly check-in. ${nextQuestion}`;
    } else if (/main health or fitness goal|health\/fitness goal|ask for the result or health|ignored the supplied plant-based duration/i.test(issueText)) {
        const duration = turn.match(/\b(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/i)?.[1] || '';
        const frequency = turn.match(/\b(\d+|one|two|three|four|five|six|seven)\s*(?:nights?|days?|times?)\s+(?:a|per)\s+week\b/i)?.[1] || '';
        const reciprocal = /\b(?:how|what) about you\b/i.test(turn);
        if (duration) {
            const shannonHistory = reciprocal ? ' I’ve been vegan for five years too.' : '';
            joined = `That’s awesome, ${duration} ${/^1$|^one$/i.test(duration) ? 'year is' : 'years is'} a solid run.${shannonHistory} What’s your main health or fitness goal at the moment?`;
        } else if (frequency) {
            joined = `Nice, ${frequency} nights a week is a solid start if you’re looking to make the shift. What’s your main health or fitness goal at the moment?`;
        } else if (reciprocal) {
            joined = "Yeah, I get that. I've been vegan for five years now. What's your main health or fitness goal at the moment?";
        } else if (/\bvegetarian\b/i.test(turn)) {
            joined = 'Nice, you’re already partway there then. What’s your main health or fitness goal at the moment?';
        } else if (/\b(?:not fully|trying|transition|adopt|go more|more plant)\b/i.test(turn)) {
            joined = 'Nice, that’s a solid start. What’s your main health or fitness goal at the moment?';
        } else {
            joined = 'Nice. What’s your main health or fitness goal at the moment?';
        }
    } else if (/answered the goal question/i.test(issueText)) {
        joined = buildPaidMetaGoalToBlockerText(turn);
    } else if (/pitched before|repeated a question/i.test(issueText) && !repairsEarnedOffer) {
        const facts = qualifier?.facts && typeof qualifier.facts === 'object' ? qualifier.facts : {};
        const knownGoal = String(facts.current_state || facts.motivation || '').trim();
        const hasKnownFitnessGoal = /\b(?:lose|weight|fat|fit|fitter|fitness|strong|strength|muscle|energy|health|tone|confidence|run|training|workout)\b/i.test(knownGoal);
        const turnHasFitnessGoal = /\b(?:lose|weight|fat|fit|fitter|fitness|strong|strength|muscle|energy|health|tone|confidence|run|training|workout)\b/i.test(turn);
        const wantsAccountability = /\baccountab\w*\b/i.test(turn);
        const wantsFoodGuidance = /\b(?:food|meal|eating)\b/i.test(turn);
        const frequency = turn.match(/\b(\d+|one|two|three|four|five|six|seven)\s*(?:nights?|days?|times?)\s+(?:a|per)\s+week\b/i)?.[1] || '';
        if (wantsAccountability) {
            const acknowledgement = wantsFoodGuidance
                ? 'Yeah, having the food side mapped out and someone keeping you accountable would make the shift much easier.'
                : 'Yeah, having someone keep you accountable can make a big difference.';
            joined = `${acknowledgement} What result are you mainly hoping to achieve at the moment?`;
        } else if (turnHasFitnessGoal || hasKnownFitnessGoal) {
            joined = 'Yeah, that makes sense. What usually gets in the way of making that happen consistently?';
        } else if (frequency) {
            joined = `Yeah, ${frequency} nights a week is a solid start if you're looking to make the shift. Outside of eating more plant-based, what's your main health or fitness goal at the moment?`;
        } else {
            joined = `Yeah, that makes sense. What's the main health or fitness goal you're working towards at the moment?`;
        }
    } else if (repairsEarnedOffer) {
        joined = buildPaidMetaTailoredOfferText(turn, fallbackGoal, flowVariant);
    }
    if (!joined) return null;
    let videoAttachmentUrl = draft.videoAttachmentUrl || null;
    let chunks = fixedChunks || (repairsEarnedOffer
        ? buildPaidMetaTailoredOfferChunks(
            turn,
            fallbackGoal,
            flowVariant
        )
        : splitCoachDraftIntoDmBubbles([joined]).slice(0, draft.maxChunks || MAX_CHUNKS));
    if (repairsEarnedOffer && flowVariant === 'broad_pain') {
        const offerWithVideo = addPaidMetaProofVideoToOfferChunks(chunks, history);
        chunks = offerWithVideo.chunks;
        videoAttachmentUrl = offerWithVideo.videoAttachmentUrl;
    }
    return {
        ...draft,
        chunks,
        joined: chunks.join('\n'),
        model: `${String(draft.model || 'unknown').replace(/\+paid-meta-guaranteed$/, '')}+paid-meta-guaranteed`,
        replyMode: repairsEarnedOffer ? 'campaign_sales_progression' : draft.replyMode,
        paidMetaGuaranteedContract: repairsEarnedOffer || undefined,
        videoAttachmentUrl,
        shadowDraftInput: null,
    };
}

function paidMetaLatestFitnessGoalText(history = []) {
    return String([...(Array.isArray(history) ? history : [])]
        .reverse()
        .find(message => String(message?.direction || '').toLowerCase() === 'in'
            && PAID_META_FITNESS_GOAL_RE.test(String(message?.text || '')))?.text || '').trim();
}

function buildPaidMetaNonBlockingReviewFallback({
    draft = {},
    draftReview = null,
    currentMessage = '',
    qualifier = {},
    history = [],
    flowVariant = 'plant_based_control',
    checkoutUrl = '',
    appPreviewUrl = META_APP_PREVIEW_URL,
} = {}) {
    if (!isNonBlockingDraftStyleWarning(draftReview)) return null;
    const reply = draftTextFromDraft(draft);
    if (!reply || isUnsafeStockDiscoveryQuestion(reply)) return null;
    return {
        ...draft,
        model: `${String(draft.model || 'unknown').replace(/\+paid-meta-style-release$/, '')}+paid-meta-style-release`,
        paidMetaNonBlockingReviewReleased: true,
        shadowDraftInput: null,
    };
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

function isQuestionLikeText(text = '') {
    const value = String(text || '').trim();
    if (!value) return false;
    return /\?/.test(value)
        || /^(?:who|what|when|where|why|how|can|could|would|will|do|does|did|is|are|am|should|have|has|was|were)\b/i.test(value);
}

function isLowContentIgStoryReply(text = '') {
    if (!isIgStoryReplyContextText(text)) return false;
    const reply = extractIgStoryReplyText(text);
    if (!reply || reply === 'replied to your story' || isQuestionLikeText(reply)) return false;

    const hasLettersOrNumbers = /[\p{L}\p{N}]/u.test(reply);
    if (!hasLettersOrNumbers) return true;

    const normalized = reply
        .toLowerCase()
        .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const wordCount = normalized ? normalized.split(' ').length : 0;
    if (!normalized || wordCount > 5) return false;
    return /^(?:love (?:this|it)|so good|this is (?:so )?(?:good|great|amazing)|(?:looks? )?(?:amazing|beautiful|great|good|cute|nice|unreal)|fire|wow+|haha+|lol+|thanks|thank you|legend)$/.test(normalized);
}

function buildLowContentStoryAcknowledgement(text = '') {
    const reply = extractIgStoryReplyText(text);
    return /[\p{L}\p{N}]/u.test(reply) ? 'thanks ❤️' : '❤️';
}

function buildLowContentStoryReplyPolicyBlock({ currentMessage = '', recentInboundMessages = [] } = {}) {
    const unanswered = [...(Array.isArray(recentInboundMessages) ? recentInboundMessages : []), { text: currentMessage }]
        .map(message => String(message?.text || '').trim())
        .filter(Boolean);
    if (!unanswered.length || !unanswered.every(isLowContentIgStoryReply)) return '';
    return `

LOW-CONTENT STORY REACTION (HARD RULE):
- Their entire unanswered batch is only an emoji or tiny praise reacting to Shannon's Story. They did not ask a question or share anything substantive.
- Do not start a conversation, ask a follow-up, mention the Story subject, qualify them, or pitch.
- Return exactly one tiny acknowledgement: a love heart for emoji-only input, or "thanks ❤️" for tiny written praise.`;
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

function conversationEventTime(event) {
    const value = Date.parse(event?.created_at || event?.createdAt || '');
    return Number.isFinite(value) ? value : null;
}

function normalizeConversationEvent(event, index) {
    const createdAtMs = conversationEventTime(event);
    if (createdAtMs == null) return null;
    return { ...event, _episode_index: index, _created_at_ms: createdAtMs };
}

function normalizedConversationText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function detectConversationEpisode({ events = [], storyOutreachSummary = null, now = new Date() } = {}) {
    const nowMs = Date.parse(now instanceof Date ? now.toISOString() : now) || Date.now();
    const timeline = (Array.isArray(events) ? events : [])
        .map(normalizeConversationEvent)
        .filter(Boolean)
        .sort((a, b) => a._created_at_ms - b._created_at_ms || a._episode_index - b._episode_index);

    if (timeline.length === 0) {
        return {
            isNewEpisode: false,
            reason: 'no_tracked_history',
            startedAt: null,
            currentEvents: [],
            relationshipEvents: [],
        };
    }

    let boundaryIndex = 0;
    let reason = 'continuous_thread';
    for (let i = 1; i < timeline.length; i += 1) {
        const gapMs = timeline[i]._created_at_ms - timeline[i - 1]._created_at_ms;
        if (gapMs >= CONVERSATION_EPISODE_HARD_GAP_MS) {
            boundaryIndex = i;
            reason = 'long_silence';
            continue;
        }
        if (gapMs >= CONVERSATION_EPISODE_REOPEN_GAP_MS && timeline[i].direction === 'out') {
            boundaryIndex = i;
            reason = 'shannon_reopened_after_pause';
        }
    }

    const storySentAt = Date.parse(storyOutreachSummary?.sent_at || storyOutreachSummary?.captured_at || '');
    const storyWasSent = storyOutreachSummary
        && storyOutreachSummary.context_reliable !== false
        && (
            !!storyOutreachSummary.sent_at
            || storyOutreachSummary.sent === true
            || /^(sent|verified)$/i.test(String(storyOutreachSummary.send_status || ''))
        );
    if (
        storyWasSent
        && Number.isFinite(storySentAt)
        && storySentAt <= nowMs
        && nowMs - storySentAt <= STORY_EPISODE_MAX_AGE_MS
    ) {
        const sentCommentKey = normalizedConversationText(storyOutreachSummary.sent_comment);
        let storyBoundaryIndex = sentCommentKey
            ? timeline.findLastIndex(event => (
                event.direction === 'out'
                && normalizedConversationText(event.text) === sentCommentKey
                && Math.abs(event._created_at_ms - storySentAt) <= 30 * 60 * 1000
            ))
            : -1;
        if (storyBoundaryIndex < 0) {
            storyBoundaryIndex = timeline.findIndex(event => event._created_at_ms >= storySentAt);
        }
        if (storyBoundaryIndex > 0 && storyBoundaryIndex >= boundaryIndex) {
            boundaryIndex = storyBoundaryIndex;
            reason = 'fresh_story_opener';
        }
    }

    const cleanEvent = ({ _episode_index, _created_at_ms, ...event }) => event;
    return {
        isNewEpisode: boundaryIndex > 0,
        reason,
        startedAt: timeline[boundaryIndex]?.created_at || timeline[boundaryIndex]?.createdAt || null,
        currentEvents: timeline.slice(boundaryIndex).map(cleanEvent),
        relationshipEvents: timeline.slice(0, boundaryIndex).map(cleanEvent),
    };
}

function conversationEpisodeReasonLabel(reason) {
    if (reason === 'fresh_story_opener') return 'a fresh Story opener started this chat';
    if (reason === 'shannon_reopened_after_pause') return 'Shannon deliberately reopened the relationship after a pause';
    if (reason === 'long_silence') return 'a long silence separates this chat from the earlier conversation';
    return 'this is the current continuous conversation';
}

function buildConversationEpisodeTimeline({ episode, formatEvent } = {}) {
    const currentEvents = Array.isArray(episode?.currentEvents) ? episode.currentEvents : [];
    const relationshipEvents = Array.isArray(episode?.relationshipEvents) ? episode.relationshipEvents : [];
    const render = typeof formatEvent === 'function'
        ? formatEvent
        : event => `${event?.speaker || 'Unknown'}: ${event?.text || ''}`;
    const currentText = currentEvents.length
        ? currentEvents.map(render).join('\n')
        : '(the just-arrived message below is the first message in this episode)';
    const relationshipText = relationshipEvents.length
        ? `\n\nOLDER RELATIONSHIP HISTORY (known facts and continuity only, not an active conversational agenda):\n${relationshipEvents.map(render).join('\n')}`
        : '';

    return `CURRENT CONVERSATION EPISODE (${conversationEpisodeReasonLabel(episode?.reason)}):
${currentText}

EPISODE ENGAGEMENT RULES:
- The current episode controls the reply, question rhythm, topic, tone, and next move.
- Older relationship history can supply stable facts, preferences, goals, injuries, client status, safety rules, prior purchases, and things already answered.
- Do not continue an old question sequence, qualifier, offer, objection, support loop, joke, or unfinished topic unless the current episode explicitly returns to it.
- A new episode does not erase commercial stage or client status, but old sales momentum is not permission to pitch in a fresh unrelated chat.
- Never re-ask a known fact just because the episode is new.${relationshipText}`;
}

function buildNativeStoryOutreachContextBlock(thread, leadName) {
    const latest = latestNativeStoryOutreachMemory(thread);
    if (!latest) return { block: '', summary: null };
    const customData = thread?.custom_data && typeof thread.custom_data === 'object'
        ? thread.custom_data
        : {};

    const handle = compactStoryMemoryText(thread?.ig_username || leadName || latest.ig_username || '', 80);
    const description = compactStoryMemoryText(latest.story_description, 700);
    const visibleText = compactStoryMemoryText(latest.story_visible_text, 700);
    const sentComment = compactStoryMemoryText(latest.sent_comment || latest.draft_comment, 240);
    const contentType = compactStoryMemoryText(latest.story_content_type || 'unknown', 80);
    const sharedFrom = compactStoryMemoryText(latest.shared_from_username, 80);
    const storyUrl = compactStoryMemoryText(latest.story_url, 300);
    const capturedAt = compactStoryMemoryText(latest.captured_at || latest.updated_at, 80);
    const salesContext = (latest.sales_context && typeof latest.sales_context === 'object')
        ? latest.sales_context
        : ((customData.sales_context && typeof customData.sales_context === 'object') ? customData.sales_context : null);
    const leadAcquisition = (customData.lead_acquisition && typeof customData.lead_acquisition === 'object')
        ? customData.lead_acquisition
        : null;
    const primaryOffer = compactStoryMemoryText(
        salesContext?.primary_offer || leadAcquisition?.primary_offer || customData.offer_path || latest.offer_path || '',
        100
    );

    const summary = {
        story_url: storyUrl || null,
        story_id: compactStoryMemoryText(latest.story_id, 100) || null,
        story_description: description || null,
        story_visible_text: visibleText || null,
        story_content_type: contentType || null,
        shared_from_username: sharedFrom || null,
        sent_comment: sentComment || null,
        sent: latest.sent === true,
        sent_at: compactStoryMemoryText(latest.sent_at, 80) || null,
        send_status: compactStoryMemoryText(latest.send_status, 80) || null,
        context_reliable: latest.context_reliable !== false,
        captured_at: capturedAt || null,
        lead_origin: compactStoryMemoryText(latest.lead_origin || customData.lead_origin || leadAcquisition?.source || '', 120) || null,
        offer_path: primaryOffer || null,
    };
    const storyAtMs = Date.parse(summary.sent_at || summary.captured_at || '');
    const inboundAtMs = Date.parse(thread?.last_inbound_at || '');
    if (Number.isFinite(storyAtMs)
        && Number.isFinite(inboundAtMs)
        && (inboundAtMs - storyAtMs > STORY_EPISODE_MAX_AGE_MS || storyAtMs > inboundAtMs + (5 * 60 * 1000))) {
        return {
            block: '',
            summary: {
                ...summary,
                context_reliable: false,
                context_stale: true,
            },
        };
    }
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
    if (!thread?.linked_user_id && primaryOffer === 'balance_starter_coaching') {
        lines.push('Sales context: story outreach lead. Voice priority: no sales script, brochure, or urgency. If real help/food/training/consistency signal appears, bridge to Balance Foundations (one $149 payment, fixed six-week course, weekly check-in and plan review, no auto-renewal). Do not offer a free challenge.');
    }

    return {
        summary,
        block: `

NATIVE STORY/POST OPENER CONTEXT:
${lines.join('\n')}

Use this if the new message is replying to Shannon's native story opener or a comment/reply Shannon just left on their post. Do not pretend ${leadName || 'the lead'} said the story/post context themselves. Keep the first reply human: rapport, one useful hook, no hard pitch from empty friendliness. Keep Shannon's real texting voice above all sales context: short, specific, casual, built from their newest detail. For an early unlinked-lead response, try the shortest complete specific reaction first. Add one topic-specific question only when the answer would genuinely change the next relationship, support, qualification, or offer move; do not add one merely to keep the conversation open. Skip the question for a pure thanks/closer, emoji or filler only, confusion or AI suspicion, safety/medical/rehab advice, or when the thread is already an established back-and-forth rather than the opening beat. A stable pain or injury history that limits training is not itself medical advice: when they have not asked for treatment, one non-medical training-context question can be useful if the missing answer affects how Shannon should help, but never ask about symptoms or prescribe rehab. For unlinked leads, bridge to the paid Founders Pass only after real help/fitness/food/consistency signal or enough earned context; close through DMs by default and do not offer a free challenge. If the story context identifies an animal as a cat, dog, rabbit, horse, or another species, keep that species exactly. If the species is unknown, stay neutral and never guess dog, cat, breed, or type from a pet name alone. If visible story text or a location sticker already names a place, treat that place as known and do not ask where it is or where they are watching from. If the visual story context already shows beach, ocean, sand, coast, or waterfront, do not ask whether they were on/at the beach.`,
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

function normalizeBareStoryMentionText(text) {
    return replaceIgMediaMarkers(String(text || ''), { photo: 'photo', audio: 'voice note', video: 'video' })
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isBareStoryMentionNotificationText(text) {
    const normalized = normalizeBareStoryMentionText(text);
    if (!normalized) return false;
    const words = normalized.split(' ').filter(Boolean);
    if (words.length > 10) return false;
    return /^(?:[a-z0-9]+\s+)?(?:mentioned|tagged)\s+you\s+(?:in|on)\s+(?:(?:a|the|their)\s+)?(?:story|post|photo|picture|image|reel|video)(?:\s+(?:story|post|photo|picture|image|reel|video|mention|attachment))*$/.test(normalized);
}

const BARE_STORY_MENTION_REDUNDANT_REPLY_RE = /\b(?:tagged|mentioned)\s+me\s+(?:in|on)\s+(?:(?:a|the|their)\s+)?(?:story|post|photo|picture|image|reel|video)\b/i;

function suppressBareStoryMentionClarifierInDraftChunks(chunks, { currentMessageText = '' } = {}) {
    const input = Array.isArray(chunks) ? chunks : [];
    if (!isBareStoryMentionNotificationText(currentMessageText)) return input;
    if (!input.length) return input;

    const joined = input.join(' ').trim();
    if (!joined) return input;
    if (joined.includes('?') || BARE_STORY_MENTION_REDUNDANT_REPLY_RE.test(joined) || /\bhonou?red\b/i.test(joined)) {
        return ['oh hell yeah!'];
    }
    return input;
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
        .replace(/[‘’]/g, "'")
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

function normalizeStoryOpenerConfusionText(text) {
    return plainSignalText(text)
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function isStoryOpenerConfusionMessage(text) {
    const normalized = normalizeStoryOpenerConfusionText(text);
    if (!normalized) return false;
    return STORY_OPENER_CONFUSION_RE.test(normalized)
        || SHORT_STORY_OPENER_CONFUSION_RE.test(normalized);
}

function buildNativeStoryConfusionRepairBlock({ currentMessageText = '', nativeStoryOutreachContext = null } = {}) {
    const summary = nativeStoryOutreachContext?.summary || null;
    const sentComment = String(summary?.sent_comment || '').trim();
    if (!summary || !sentComment || !isStoryOpenerConfusionMessage(currentMessageText)) return '';

    const storyDescription = String(summary.story_description || '').trim();
    const visibleText = String(summary.story_visible_text || '').trim();
    const sharedFrom = String(summary.shared_from_username || '').trim();
    const contextLines = [
        `- Shannon's confusing native story opener was: "${truncate(sentComment, 220)}"`,
        storyDescription ? `- Story context: ${truncate(storyDescription, 280)}` : '',
        visibleText ? `- Visible story text: ${truncate(visibleText, 220)}` : '',
        sharedFrom ? `- It may have been shared/reposted content from @${truncate(sharedFrom, 80)}.` : '',
    ].filter(Boolean).join('\n');

    return `

NATIVE STORY OPENER CONFUSION REPAIR:
${contextLines}
- Their latest message says they do not understand what Shannon meant.
- First repair the confusion in plain language, for example "ah my bad, I meant..." or "sorry, I meant..."
- If they mention it was only a repost/share, acknowledge that and do not write as if they personally posted or did the thing.
- If their same message also answers the opener, briefly acknowledge that answer after the repair.
- Do not ask a fresh qualifier, goal, age, blocker, challenge, app, or coaching question in this turn.
- Usually stop after one short repair/acknowledgement bubble. Only add a tiny follow-up if it is needed to clarify the same story opener, not to advance the funnel.`;
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
- If this is an app bug/problem, the real job is fix it, check it, and confirm it. Do not tell them to try again later.
- Do not ask for a screenshot by default. Only ask for one when the message and app context are not enough to identify what is broken.
- Do not claim it is fixed unless the context says Shannon has already fixed and verified it.
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

function buildPersonalVoiceNoteDraftingBlock(enabled) {
    if (!enabled) return '';
    return `

PERSONAL VOICE NOTE MODE:
This exact draft will be spoken in Shannon's approved voice-note voice, not sent as ordinary text.
- Match the five Cocos voice clips Shannon approved on 2026-07-24. Write at least 34 words so the voice has room to settle. There is no strict maximum: stay proportional to what they shared and do not pad or cut a natural reply to hit a duration.
- Sound like Shannon thinking with them in the moment: relaxed Australian phrasing, contractions, and small punctuation-led breathing pauses.
- Start with the newest detail or the answer itself. Do not open generated one-to-one voice notes with "Hey, how are ya", "How ya going?", or another generic check-in greeting. A relationship-specific greeting is only appropriate when the live conversation gives you a real reason for it.
- Include 3 to 4 imperfect thinking beats across the whole note, as the approved scripts did. At least one must be a drawn-out "ummm" for genuine wondering or thought-searching. Do not substitute "ahh": that sounds like relief and belongs only when the meaning is genuinely relief or realisation. The other beats may be "okay", "yeah", "honestly", "anyway", "alright", "like", "you know", or a slight self-correction.
- Use spoken "ya know" after a complete relatable or reassuring point as a soft landing that invites shared understanding, for example "you don't have to prove anything, ya know." Never add it randomly, use it to interrupt unfinished logic, or globally replace every "you" with "ya".
- Vary the hesitation placement. Never use the same filler pattern every time, stack fillers, or make the note sound scripted.
- Never write laughter into a generated voice note. Do not use "haha", stretched laughter, "ahaha", "hehe", "lol", "lmao", or any imitation of a chuckle anywhere in the script. Use the wording and cadence to carry warmth or humour instead.
- Do not start every voice note with "ummm". Open on the exact thing they said whenever that sounds more human.
- A slight self-correction or repeated thought is welcome when natural. Keep the useful coaching point clear.
- Use punctuation to create breathing room. Do not write stage directions, labels, SSML, ad-read copy, or a polished motivational monologue.
- Prefer one fuller message bubble so the audio reads as one connected note. Return to concise text for links, prices, or detailed instructions.`;
}

async function generateDraft({ leadName, leadBlock, profileBlock, memoryBlock, coachDayContextBlock = '', checkinThreadBlock = '', learningReelContextBlock = '', learningReelReplyAnchorBlock = '', nativeStoryOutreachContext = null, history, currentMessage, recentInboundMessages = [], leadStage, channel, igThreadId, linkedUserId, priorScheduledDrafts, linkedNudges, recentWorkoutEvidence, weeklyAppContext, onboardingPhase, qualifier, qualifierQuestion, botAccount, coachId = null, audioTranscriptOverrides = [], personalVoiceNoteMode = false, acquisitionMode = ACQUISITION_MODES.ORGANIC_INBOUND, adFlowVariant = 'plant_based_control', checkoutUrl = '', dmLanguageExperiment = null }) {
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
    const identityElicitation = buildBalanceIdentityElicitationBlock();
    const openAiShannonVoice = buildOpenAIShannonVoiceBlock();
    const personalVoiceNoteDraftingBlock = buildPersonalVoiceNoteDraftingBlock(personalVoiceNoteMode);
    const isSalesLeadThread = isSalesAcquisitionThread({ leadStage, linkedUserId });
    const paidMetaSingleWriter = isSalesLeadThread && isPaidMetaAcquisitionMode(acquisitionMode);
    const accountExperimentBlock = isSalesLeadThread && !paidMetaSingleWriter ? buildAccountExperimentBlock(botAccount) : '';
    const acquisitionMomentumBlock = paidMetaSingleWriter ? '' : buildAcquisitionMomentumBlock({ botAccount, leadStage, linkedUserId });
    const acquisitionStyleBlock = paidMetaSingleWriter ? '' : buildAcquisitionStyleBlock({ leadStage, linkedUserId });
    const conversationLanePolicyBlock = paidMetaSingleWriter ? '' : buildConversationLanePolicyBlock({ linkedUserId });
    const paidMetaConversationWriterBlock = buildPaidMetaConversationWriterBlock({ linkedUserId, acquisitionMode, flowVariant: adFlowVariant });
    const acquisitionModePolicyBlock = isSalesLeadThread ? buildAcquisitionModePromptBlock(acquisitionMode) : '';
    const dmLanguageExperimentBlock = !paidMetaSingleWriter && isSalesLeadThread
        ? String(dmLanguageExperiment?.promptBlock || '')
        : '';
    const cocosRewardLearningBlock = isSalesLeadThread && !paidMetaSingleWriter ? await loadCocosRewardLearningBlock(botAccount) : '';

    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const igEpisode = detectConversationEpisode({
        events: [
            ...(Array.isArray(history) ? history : []),
            { direction: 'in', text: currentMessage, created_at: promptNow.toISOString() },
        ],
        storyOutreachSummary: nativeStoryOutreachContext?.summary || null,
        now: promptNow,
    });
    const episodeStartMs = Date.parse(igEpisode.startedAt || '');
    const priorInboundMessages = (Array.isArray(recentInboundMessages) ? recentInboundMessages : [])
        .filter(message => {
            if (!igEpisode.isNewEpisode || !Number.isFinite(episodeStartMs)) return true;
            const createdAtMs = conversationEventTime(message);
            return createdAtMs == null || createdAtMs >= episodeStartMs;
        });
    const promptCurrentMessage = sanitizeIgStoryReplyContextText(currentMessage);
    const currentMessageKey = normalizedIgLeadMessageKey(promptCurrentMessage);
    const storyReplyPromptContextBlock = buildIgStoryReplyPromptContextBlock({
        leadName,
        currentMessage,
        recentInboundMessages: priorInboundMessages,
    });
    const lowContentStoryReplyPolicyBlock = buildLowContentStoryReplyPolicyBlock({
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
        videoFileCount,
        audioTranscriptCount,
        audioTranscripts,
        reelContextText,
        reelContextCount,
        reelThumbnailCount,
    } = await buildMessageMediaBatchParts(mediaSourceMessages, { audioTranscriptOverrides });
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
    const bareStoryMentionNotification = isBareStoryMentionNotificationText(promptCurrentMessage);
    const photoFetchFailed = hadPhotoUrls && imageParts.length === 0 && !bareStoryMentionNotification;
    const audioFetchFailed = hadAudioUrls && (audioParts.length < audioUrlCount || audioTranscriptCount < audioUrlCount);
    const videoFetchFailed = hadVideoUrls && videoParts.length === 0 && videoFileCount === 0 && !hasReelContext;
    const mediaFailureNotes = [];
    if (photoFetchFailed) {
        mediaFailureNotes.push('one of the photos in the unanswered batch did not open on my end, ask casually if they can re-send or check if it loaded for them');
    }
    if (audioFetchFailed) {
        mediaFailureNotes.push('one of the voice notes in the unanswered batch did not play on my end; do not ask them to resend, repeat, or type the gist. Answer only typed context, or return no public draft if the reply depends on the audio');
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
        audio_transcript_count: audioTranscriptCount || 0,
        audio_transcripts: (audioTranscripts || [])
            .filter(item => item?.text || item?.error)
            .map(item => ({
                text: item.text || '',
                error: item.error || '',
                model: item.model || null,
            })),
        video_url_count: videoUrlCount,
        video_inline_count: videoParts.length,
        video_file_count: videoFileCount || 0,
        reel_context_count: reelContextCount || 0,
        reel_thumbnail_count: reelThumbnailCount || 0,
    };
    const currentMessageNotes = [];
    if (bareStoryMentionNotification) {
        currentMessageNotes.push('NOTE: this is only a bare IG story tag/mention notification. Do not ask what they tagged Shannon in or ask them to resend the photo. A tiny reaction like "oh hell yeah!" is enough.');
    }
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
    const paidMetaTurnDirective = paidMetaSingleWriter
        ? buildPaidMetaTurnDirective({ qualifier, inboundMessages: unansweredBatch, history })
        : '';
    const unansweredBatchBlock = unansweredBatch.length <= 1 ? '' : `

UNANSWERED INBOUND BATCH FROM ${leadName} (oldest -> newest):
${unansweredBatch.map((m, i) => `${i + 1}. ${m.text}${m.isCurrent ? ' (latest)' : ''}`).join('\n')}

Use this batch as context, not a checklist. First decide what is still live: direct questions, requests, emotional disclosures, health/body-image risk, or new practical blockers. Answer those. The newest substantive inbound takes control when it opens a fresh topic, especially a Story reply about food, training, health, consistency or accountability. Do not keep answering an older unrelated topic just because it has more history. Drop earlier details that Shannon already acknowledged, repeated logistics, or banter that would feel stale. If several items are live, pick the 1-3 that matter most and let the rest sit. If the newest item is a photo or voice note, treat it as extra context for the strongest unresolved words unless it clearly starts a new topic.`;

    const historyText = promptHistory.length === 0
        ? (isPaidMetaAcquisitionMode(acquisitionMode)
            ? '(no prior tracked messages. Verified Meta ad attribution is the opening context, so answer the commercial intent directly.)'
            : "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)")
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
    const challengeNextStepBlock = isOnboardedOrPostFunnel ? '' : buildChallengeNextStepBlock(qualifier, currentMessageText, checkoutUrl);
    const oneOnOneCoachingBlock = isOnboardedOrPostFunnel ? '' : buildOneOnOneCoachingBlock(adFlowVariant, checkoutUrl, acquisitionMode);
    const balanceCallBookingBlock = isOnboardedOrPostFunnel ? '' : buildBalanceCallBookingBlock();
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
    const conversationEpisode = detectConversationEpisode({
        events: mergedConversationEvents,
        storyOutreachSummary: nativeStoryOutreachContext?.summary || null,
        now: promptNow,
    });
    const episodeEvents = [
        ...conversationEpisode.relationshipEvents,
        ...conversationEpisode.currentEvents,
    ];
    const previousTimestampByEvent = new Map();
    episodeEvents.forEach((event, index) => {
        previousTimestampByEvent.set(event, episodeEvents[index - 1]?.created_at);
    });
    const totalConversationText = buildConversationEpisodeTimeline({
        episode: conversationEpisode,
        formatEvent: event => formatTimedConversationLine({
            speaker: `${event.speaker} (${event.channel})`,
            text: event.text,
            createdAt: event.created_at,
            previousCreatedAt: previousTimestampByEvent.get(event),
            now: promptNow,
        }),
    });
    const exerciseLibrarySupportBlock = buildExerciseLibrarySupportBlock({
        currentMessage: currentMessageText,
        conversationText: totalConversationText,
        recentInboundMessages,
    });
    const lastShannonConversationEvent = [...mergedConversationEvents].reverse()
        .find(event => event.speaker === 'Shannon');
    const currentTurnAnchorBlock = buildCurrentTurnAnchorBlock({
        currentMessageText,
        lastShannonText: lastShannonConversationEvent?.text || '',
    });
    const nativeStoryConfusionRepairBlock = buildNativeStoryConfusionRepairBlock({
        currentMessageText,
        nativeStoryOutreachContext,
    });
    const effectiveQualifierQuestion = nativeStoryConfusionRepairBlock ? null : qualifierQuestion;

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
        && !isPaidMetaAcquisitionMode(acquisitionMode)
        && history.length === 0
        && linkedHistory.length === 0
        && priorScheduled.length === 0;
    const firstCapturedLeadReplyBlock = isFirstCapturedLeadReply ? `

FIRST CAPTURED LEAD REPLY:
There is no reliable prior DM context in the system. Usually Shannon has already commented on or replied to their story/post from Instagram/Facebook, but that native opener was not captured by ManyChat.
- Do not ask what this is about or say you have no context.
- If the message is only a bare tag/mention notification like "mentioned you in a story photo", do not ask what they tagged Shannon in or ask them to resend it. A tiny reaction like "oh hell yeah!" is enough.
- If their message is short or ambiguous, treat it as them replying to unseen story/post context. Match their energy and keep it short. Ask a tiny clarifier only if needed.
- If their short reply is a concrete positive response to Shannon's recent story/post opener or comment, try one tiny topic-specific question so the conversation has a chance to continue. Keep reaction-only/like for thanks, filler, emoji-only, or clear closers.
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

This is ${channelShort}. ${replyMode.styleRule} Use contractions so the reply sounds like Shannon talking: it's, I'd, wouldn't, don't, can't, you're. No emojis unless they used one first. No links unless absolutely necessary. Sound like a person texting back, not a brand.
${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}
${shannonDmTuning}
${identityElicitation}
${openAiShannonVoice}
${personalVoiceNoteDraftingBlock}
${conversationLanePolicyBlock}
${acquisitionModePolicyBlock}
${dmLanguageExperimentBlock}
${paidMetaConversationWriterBlock}
${paidMetaTurnDirective}
${accountExperimentBlock}
${acquisitionMomentumBlock}
${cocosRewardLearningBlock}
${firstCapturedLeadReplyBlock}
${replyMode.extraBlock}
${nativeStoryOutreachContext?.block || ''}
${currentTurnAnchorBlock}
${nativeStoryConfusionRepairBlock}
${checkinThreadBlock}
${learningReelContextBlock}

CONVERSATION RESPONSIBILITY:
- BUSINESS/PERSONAL BOUNDARY: Shannon's acquisition inbox is for genuine human rapport that can lead to Balance, not for the system to conduct his dating or private social life. Never flirt back, call someone cute/hot/sexy, accept or arrange a social/video call, move them to Discord/WhatsApp, promise beach/personal photos, say "I'll make it up to you", or imply future personal contact. A social or flirtatious call request is not buyer intent. Do not draft a reply for it as if Shannon accepted. It requires Shannon's manual decision. A coaching/sales call is valid only when the lead explicitly connects the call to Balance, coaching, fitness/health help, the paid offer, or working with Shannon.
- Answer every live direct question before introducing a new question. A trailing "yours?", "you?", "what about you?", "wbu?", or "hbu?" asks Shannon the same question he just asked them. Include a brief first-person answer; praising their answer and moving to a different follow-up does not answer it.
- Treat the new message as an answer to Shannon's latest question when that is obvious. Continue that thread before changing topic.
- When that answer completes the small thread, do not turn it into another question by default. A practical steer, acknowledgement, or clean pause is often better for active clients.
- If they just gave their current status, feeling, pain, soreness, or symptom answer, do not ask "how's it feeling today", "how are you feeling", or "still pain?" back at them. Treat it as answered, acknowledge it, then use a statement or practical next step unless a different missing detail changes what Shannon should do.
- Older messages are not automatically unresolved. Respond to previous statements only when they are still carrying the real ask, emotion, risk, or useful context. Otherwise let them drop.
- If the newest message is light media/banter attached to a heavier earlier message, decide whether the media is just a softener before writing. Do not let a puppy photo or quick joke erase a vulnerable disclosure or practical request.
- If they send a voice note, photo, or video that was decoded, do not open with a receipt like "just listened to your voice note", "saw your photo", or "watched the video". Reply straight to what it means.
- Only add a Shannon day/work/training/pet update when they directly ask what Shannon is doing, how his day is going, or what is on his agenda. If they ask what a topic is like "by you", "near you", or where Shannon is, answer that topic briefly instead of adding a random app/Sunshine/day update. First check whether Shannon already answered that exact personal question in the recent timeline.
- Do not assume the client is currently working, just finished work, on shift, or recovering after a shift from old work-history context. Mention today's shift/work only when the latest message, the current unanswered batch, or a same-day direct answer proves it.
- Do not open with "morning", "afternoon", or "evening" when this is already an active same-day thread or Shannon already greeted them recently.
- If they admit they have been "slacking", off track, missed training, or had a rough week, don't reply with filler like "ahh yeah man" on its own, don't ask "wby"/"what about you", and don't repeat the same broad question. Validate lightly, then ask one concrete follow-up about what got in the way or what small session they can lock in next.
- The funnel should feel invisible. It can take hours or months. One smooth human question beats a forced qualifier or pitch.
- Do not default to a question. Use a question only when it is the most natural next text. If they are bantering, answering a previous question, or sending a quick update, a short reaction can be the whole reply.
- If Shannon asked whether someone was okay after a sad animal/pet story and they reply that they are okay but the animals are not, treat that as the answer. Do not ask "what happened to them" or mine the sad story for details. Acknowledge the cruelty/heartbreak, then if a question is useful bridge through values instead: how long they have been vegan/plant-based, what got them into it, or later how they go with fitness. Once vegan values plus fitness context are warm, a soft Founders Pass invite can be earned.
- If they answer a pet-name question with just a name, use the native story context and/or known memory for the species. Do not ask what kind of dog/cat/breed it is unless the species is explicit and that question is genuinely needed. A short reaction like "nero is cute" is enough.
- If dog/pet names, ownership, house-sitting status, or house-sitting timing are already in the timeline, do not ask for them again. Acknowledge the known names or give a clean reaction, then stop or move to a more useful thread.
- Do not comment on their emoji usage as a topic. Emojis are tone only.
- When they send rich personal detail, the natural question often belongs inside the paragraph that reflects that exact detail, not as a final closer. Example shape: "that makes sense, getting lost in cooking would be so therapeutic. do you have a number 1 thing you love making?" then keep responding to the other things they shared or answer what they asked Shannon.
- Keep the spotlight on them unless they directly ask about Shannon.

GROUNDING AND TIMELINE RULES:
- Specific claims must be traceable to the data below: their message, conversation history, client memory, cross-channel notes, or exact app workout logs.
- Attribution matters. A lead saying an artist, person, place, product, event, song, or business is good proves only that the lead thinks so. It does not prove Shannon knows or agrees with it. Do not convert their opinion into Shannon's personal knowledge, and do not closely echo their unusual wording back to them.
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
- For first/early replies to Shannon's story opener, default to one tiny move about their hook. That can be a short statement, not always a question. Ask a light question only when it is clearly the best next text, or when there is no better hook and Shannon has not asked a basic day/week opener yet. Skip the move when they only said thanks/emoji/filler, it is a genuinely short no-response-needed reply, the topic is a current safety/medical/rehab advice situation, or the thread is clearly closing. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is not sensitive by itself. If they share a stable limitation that affects their training but do not ask for diagnosis, treatment, or rehab advice, acknowledge it then ask one short non-medical question about what training they can still progress or how it changes their week. Keep it as light rapport, never a diagnosis or prescription. A one-word story reaction such as "cute" is not permission to reset into "are you into fitness much too?". The DM manager owns unclear context and every media type: retrieve and inspect the full unanswered batch, transcribe voice notes, and analyze photos/video. If a voice note is inaccessible, do not ask the lead to resend, repeat, or type the gist; leave no public voice-note fallback and let the media-review hold/retry path handle it. If a decoded voice-note transcript or media summary is present, it is accessible and must be answered directly, never treated as missing. Route only a credible current self-harm/imminent-danger signal or a direct AI/automation/authenticity challenge to Needs You. A Shannon-side personal aside cannot be the whole reply in this moment. Example: if they reply about InsightTimer filling your cup, "that stuff can properly reset a day" may be enough; ask whether they use it for meditations or reminders only if the thread needs a question.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}
${coachDayContextBlock}
${appNavigationGuide}
${appXpGuide}
${exerciseLibrarySupportBlock}
${funnelContext}
${challengeNextStepBlock}
${oneOnOneCoachingBlock}
${balanceCallBookingBlock}
${unansweredBatchBlock}
${storyReplyPromptContextBlock}
${lowContentStoryReplyPolicyBlock}
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
${effectiveQualifierQuestion ? `
IMPORTANT - CONVERSATIONAL ELICITATION:
Use this suggested next move only if it naturally fits this exact reply: "${effectiveQualifierQuestion}"
This is guidance, not a command. It may be a statement, label, or question. Prefer a statement they can confirm, correct, or expand. Ask a direct question only when its answer genuinely changes the next coaching, support, qualification, or offer move. If a specific reaction or direct answer handles the moment, stop there. If the latest message is only thanks/emoji/filler, closing, a genuinely short no-response-needed reply, or a current safety/medical/rehab advice situation, skip it. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is normal rapport when the reply stays non-medical. If you use the move, use only that one light elicitation move. When the reply has several things to answer, weave the move into the reflection that sparked it instead of defaulting to a standalone final bubble. Do not add a goal, age, blocker, or coaching pitch in the same reply.
If the suggested move sounds generic, ignores a fresher detail, or is unnecessary after answering their message, rewrite it around that detail or skip it. Never paste a stock line like "what does a normal day look like", "are you much of a cook or more of a takeaway person", "you training at the moment", or "what are your goals" into an auto-DM draft.
` : ''}
OUTPUT FORMAT — JSON only, nothing else:
${mediaParts.length > 0
        ? '{"messages": ["chunk 1", "chunk 2 (if needed)"], "media_summary": "one brief factual description of what is visibly or audibly relevant in the attached media"}'
        : replyMode.chunkExample}

Rules:
- ${replyMode.lengthRule}
- 1 to 3 chunks. One-liner is fine — just one item in the array.
- Split where Shannon would naturally pause: new thought, change of topic, follow-up question.
- Do not park every question at the end. If the question belongs to one specific detail, put it with that detail and keep going.
- Make each chunk a paragraph-sized bubble. If a thought is getting long, finish the sentence or paragraph, send that chunk, then continue in the next chunk.
- Don't artificially split a single sentence. Each chunk should stand on its own.
- Never put literal backslash-n escape sequences inside a chunk. Use normal punctuation, or start a new chunk if you need a pause.
- The JSON wrapper is only for the system. The chunk strings must contain only the exact DM text Shannon would send. Never put "json", "messages", "chunk", labels, or formatting instructions inside a chunk.
- When attached media is available, media_summary is required. Describe the useful visible or audible facts in one concise sentence without guessing identity, relationships, location, or intent. This is private context for later review and must not be copied mechanically into the DM.
- No quotes, labels, code-fence, or commentary outside the JSON.`;
    if (paidMetaSingleWriter) {
        prompt = buildPaidMetaAgentPrompt({
            leadName,
            channelLabel,
            timeline: totalConversationText,
            unansweredMessages: unansweredBatch,
            flowVariant: adFlowVariant,
        });
    }
    prompt = prompt.replace(
        /- 1 to 3 chunks\.[^\n]*\n- Split where/,
        `- ${replyMode.chunkRule}\n- Split where`
    );

    const inlineMediaParts = videoParts.length > 0
        ? [...mediaParts, { text: prompt }]
        : [{ text: prompt }, ...mediaParts];
    const mediaContents = [{ role: 'user', parts: inlineMediaParts }];
    const hasInlineMedia = mediaParts.length > 0;
    const textOnlyMediaFallbackNote = (hadAudioUrls || audioParts.length > 0 || audioTranscriptCount > 0)
        ? ' (NOTE: a voice note/audio attachment could not be decoded in this fallback. Do not ask them to resend, repeat, or type the gist. Answer only typed context; if the reply depends on the audio, return {"messages":[]}. Do not pretend you heard it.)'
        : ' (NOTE: attached media could not be decoded in this fallback. If the reply depends on it, casually ask them to resend it or type the gist. Do not pretend you saw or heard it.)';
    // Text-only contents — used when vision fails OR when there's no image.
    // We rebuild the prompt with the photo-failed hint so the AI knows to
    // ask casually about the photo without pretending it saw it.
    const textOnlyPrompt = hasInlineMedia
        ? prompt.replace(
            'THEIR NEW MESSAGE:\n' + currentMessageText + (mediaInstruction ? ` ${mediaInstruction}` : ''),
            'THEIR NEW MESSAGE:\n' + currentMessageText + (reelContextText
                ? ' (NOTE: use the reel caption/metadata text above if the thumbnail is unavailable in this fallback. Do not claim to have watched the full reel.)'
                : textOnlyMediaFallbackNote)
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
                paidMetaSingleWriter
                    ? await withTimeout(callOpenAITextModel(textContents, generationConfig, {
                        profile: 'coach_fallback',
                        label: 'openai-paid-meta-primary',
                        models: ['gpt-5.4-mini'],
                    }), 10000, 'paid Meta OpenAI writer')
                    : await callVertexAIModel(textContents, generationConfig),
                paidMetaSingleWriter ? 'GPT-5.4 mini paid Meta writer' : 'Vertex v7'
            );
            model = paidMetaSingleWriter
                ? (lastError ? 'openai-gpt-5.4-mini-paid-meta+media-failed' : 'openai-gpt-5.4-mini-paid-meta')
                : (lastError ? 'vertex-v7+media-failed' : 'vertex-v7');
        } catch (err) {
            lastError = `${lastError ? lastError + ' | ' : ''}${paidMetaSingleWriter ? 'openai-paid-meta' : 'vertex'}: ${err.message.slice(0, 200)}`;
            if (paidMetaSingleWriter) {
                const timeoutFallback = buildDeterministicPaidMetaConversationReply({
                    currentMessage: unansweredBatch.map(message => message.text).join('\n'),
                    qualifier,
                    history,
                    flowVariant: adFlowVariant,
                    checkoutUrl,
                    appPreviewUrl: buildMetaAppPreviewUrl(igThreadId, { flowVariant: adFlowVariant }),
                    personalVoiceNoteMode: false,
                    allowVideoAttachment: false,
                });
                if (Array.isArray(timeoutFallback?.chunks) && timeoutFallback.chunks.length) {
                    rawText = JSON.stringify({ messages: timeoutFallback.chunks });
                    model = 'deterministic_paid_meta_timeout_v1';
                    console.warn(`[ig-draft] paid Meta OpenAI timed out; used local sales fallback: ${err.message}`);
                } else {
                    return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length, audioCount: audioParts.length, videoCount: videoParts.length, reelContextCount, reelThumbnailCount, mediaDecode, timeline: totalConversationText, conversationEpisode, currentTurnAnchorBlock, storyReplyPromptContextBlock, mediaContextPromptBlock, learningReelContextBlock, learningReelReplyAnchorBlock, learningReelEvidenceBlock };
                }
            } else try {
                console.warn(`[ig-draft] Vertex failed, falling back to Gemini: ${err.message}`);
                rawText = requireNonEmptyDraftText(
                    await callGeminiFallback(textContents, generationConfig),
                    'Gemini text fallback'
                );
                model = lastError ? 'gemini-fallback+media-failed' : 'gemini-2.0-fallback';
            } catch (err2) {
                console.error('[ig-draft] Gemini fallback failed:', err2.message);
                lastError = `${lastError ? lastError + ' | ' : ''}gemini: ${err2.message.slice(0, 200)}`;
                return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length, audioCount: audioParts.length, videoCount: videoParts.length, reelContextCount, reelThumbnailCount, mediaDecode, timeline: totalConversationText, conversationEpisode, currentTurnAnchorBlock, storyReplyPromptContextBlock, mediaContextPromptBlock, learningReelContextBlock, learningReelReplyAnchorBlock, learningReelEvidenceBlock };
            }
        }
    }

    const mediaGenerationSucceeded = hasInlineMedia
        && !!rawText
        && !/media-failed/i.test(String(model || ''));
    const mediaSummary = mediaGenerationSucceeded
        ? extractMediaSummaryFromDraftRawText(rawText)
        : '';
    const analyzedKinds = [];
    if (imageParts.length > 0 && mediaGenerationSucceeded && mediaSummary) analyzedKinds.push('photo');
    if (audioTranscriptCount > 0 || (audioParts.length > 0 && mediaGenerationSucceeded)) analyzedKinds.push('audio');
    if (((videoParts.length > 0 || videoFileCount > 0) && mediaGenerationSucceeded) || reelContextCount > 0) analyzedKinds.push('video');
    mediaDecode.analyzed_kinds = analyzedKinds;
    mediaDecode.analysis_succeeded = analyzedKinds.length > 0;
    mediaDecode.audio_batch_complete = !hadAudioUrls
        || (audioParts.length >= audioUrlCount && audioTranscriptCount >= audioUrlCount);
    mediaDecode.analysis_complete = (!hadPhotoUrls || analyzedKinds.includes('photo'))
        && mediaDecode.audio_batch_complete
        && (!hadVideoUrls || analyzedKinds.includes('video'));
    mediaDecode.analysis_model = mediaDecode.analysis_succeeded ? model : null;
    mediaDecode.analyzed_at = mediaDecode.analysis_succeeded ? new Date().toISOString() : null;
    mediaDecode.media_summary = mediaSummary || null;
    mediaDecode.summary_missing = imageParts.length > 0 && mediaGenerationSucceeded && !mediaSummary;

    const hasDecodedMedia = mediaParts.length > 0;
    let emptyDraftRecovery = null;
    let cleanedChunks = finalizeDraftChunksFromRawText(rawText, {
        maxChunks: replyMode.maxChunks,
        leadName,
        currentMessageText,
        qualifier,
        leadStage,
        linkedUserId,
        checkoutUrl,
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
            leadStage,
            linkedUserId,
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
    if (isAudioPuntDraftChunks(cleanedChunks, { mediaDecode, currentMessageText })) {
        let fallbackChunks = [];
        let recoveryVia = 'audio_punt_guard';
        let recoveryError = 'audio_draft_punted_instead_of_answering';
        if (hasAudioTranscriptDraftContext({ mediaDecode, currentMessageText })) {
            const lastShannonConversationEvent = [...mergedConversationEvents].reverse()
                .find(event => event.speaker === 'Shannon');
            const recovery = await generateAudioTranscriptRecoveryDraft({
                mediaDecode,
                leadName,
                channelLabel,
                currentMessageText,
                totalConversationText,
                lastShannonText: lastShannonConversationEvent?.text || '',
                replyMode,
                allowDailyGreeting,
                qualifier,
                leadStage,
                linkedUserId,
                nativeStoryContextSummary: nativeStoryOutreachContext?.summary || null,
            });
            fallbackChunks = recovery.chunks || [];
            recoveryVia = fallbackChunks.length ? 'audio_transcript_retry' : 'audio_transcript_retry_failed';
            recoveryError = recovery.error || recoveryError;
            if (fallbackChunks.length) {
                model = `${String(model || 'none')}+${recovery.model || 'audio-transcript-retry'}`;
            }
        } else {
            fallbackChunks = buildEmptyMediaDraftFallbackChunks({ mediaDecode, currentMessageText });
            model = `${String(model || 'none')}+audio-punt-guard`;
        }
        cleanedChunks = fallbackChunks;
        emptyDraftRecovery = {
            recovered: fallbackChunks.length > 0,
            via: recoveryVia,
            model: null,
            error: recoveryError,
            recovered_at: new Date().toISOString(),
        };
        lastError = `${lastError ? lastError + ' | ' : ''}${recoveryError}`;
    }
    if (!cleanedChunks.length && !hasAudioTranscriptDraftContext({ mediaDecode, currentMessageText })) {
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
    if (lowContentStoryReplyPolicyBlock) {
        cleanedChunks = [buildLowContentStoryAcknowledgement(currentMessage)];
        model = `${String(model || 'none')}+low-content-story-reaction`;
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
        videoFileCount: videoFileCount || 0,
        reelContextCount,
        reelThumbnailCount,
        urlCount: photoUrlCount,
        audioUrlCount,
        audioTranscriptCount,
        videoUrlCount,
        mediaDecode,
        mediaSummary,
        timeline: totalConversationText,
        conversationEpisode,
        currentTurnAnchorBlock,
        storyReplyPromptContextBlock,
        nativeStoryOutreachContextBlock: nativeStoryOutreachContext?.block || '',
        nativeStoryConfusionRepairBlock,
        mediaContextPromptBlock,
        learningReelContextBlock,
        learningReelReplyAnchorBlock,
        learningReelEvidenceBlock,
        emptyDraftRecovery,
        dmLanguageExperiment,
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

function buildAudioTranscriptReviewContext(mediaDecode = {}, leadName = 'Lead') {
    if (mediaDecode?.analysis_succeeded === false) return '';
    const transcripts = Array.isArray(mediaDecode?.audio_transcripts)
        ? mediaDecode.audio_transcripts
            .map(item => String(item?.text || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];
    if (!transcripts.length) return '';
    return `\nDecoded voice-note content from ${leadName} (authoritative latest inbound evidence):\n${transcripts.map((text, index) => `- Voice note ${index + 1}: "${truncate(text, 900)}"`).join('\n')}`;
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
        // the qualifier thinks now's a move moment, title carries the MOVE tag.
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
                ? `${challengeOfferWarning?.label || 'coaching invite'} in this draft. Review before sending.`
                : `🔴 AI stopped auto-send: ${autoHoldReason.label}. Review before sending.`)
            : '';
        const challengeOfferPushWarning = challengeOfferActive
            ? `${challengeOfferWarning.dot || '🟡'} ${challengeOfferWarning.label || 'coaching invite'} in this draft. Review before sending.`
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
    generateDraft,
    isIgStoryReplyContextText,
    sanitizeIgStoryReplyContextText,
    stripObviousMediaReceiptPreamble,
    getCocosAutoContextBypass,
    getBalanceAutoContextBypass,
    getAutoDmHoldReason,
    isPaidMetaBuyerIntentOfferReplyAllowed,
    getCocosCodexReviewHold,
    isNonBlockingDraftStyleWarning,
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
    normalizeIgAutoTimingSuggestion,
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const {
        threadId,
        messageText,
        manychatMessageId,
        durableMediaIds = [],
        audioTranscriptOverrides = [],
    } = payload;
    if (!threadId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing threadId or messageText' }) };
    }

    const thread = await loadThread(threadId);
    if (!thread) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Thread not found' }) };
    }
    const idempotencyKey = manychatMessageId
        ? `ig_incoming_dm:${manychatMessageId}`
        : `ig_incoming_dm:${threadId}:${Date.now()}`;
    if (manychatMessageId) {
        try {
            const freshness = await inspectSourceMessageFreshness({
                threadId,
                manychatMessageId,
                resetAt: thread.custom_data?.internal_test_conversation_reset_at || '',
            });
            if (freshness.state === 'stale') {
                const alert = await cancelStaleReplayAlert({ idempotencyKey, freshness });
                console.warn(`[ig-draft] skipped stale replay ${manychatMessageId} for thread ${threadId}: ${freshness.reason}`);
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        skipped: 'stale_replayed_inbound',
                        reason: freshness.reason,
                        thread_id: threadId,
                        source_message_id: freshness.sourceMessage?.id || null,
                        newer_message_id: freshness.latestMessage?.id || null,
                        alert_id: alert?.id || null,
                    }),
                };
            }
        } catch (error) {
            console.warn(`[ig-draft] source freshness check failed for ${threadId}:`, error.message);
        }
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
    let history = await loadIgHistory(threadId, messageText);
    const botAccount = thread.custom_data?.bot_account || thread.custom_data?.instagram_graph?.bot_account || '';
    const algorithmFork = algorithmForkForBotAccount(botAccount);
    const cocosAutoSendLane = isCocosBotAccount(botAccount);
    const voiceReplyTestLane = isCocosToShanSunnyVoiceTest({
        botAccount,
        igUsername: thread.ig_username,
        customData: thread.custom_data,
    });
    const voiceReplyTestReason = voiceReplyTestLane
        ? resolveCocosShanSunnyVoiceTestReason({
            botAccount,
            igUsername: thread.ig_username,
            customData: thread.custom_data,
        })
        : '';
    const clientManagerAutoReplyEnabled = !!thread.linked_user_id
        && isClientManagerAutoReplyEnabled(thread);
    const clientManagerBrowserDispatchEnabled = clientManagerAutoReplyEnabled
        && isClientManagerBrowserDispatchEnabled(thread);
    const linkedClientNeedsYou = !!thread.linked_user_id && !clientManagerAutoReplyEnabled;
    const acquisitionMode = resolveIgAcquisitionMode({
        customData: thread.custom_data,
        linkedUserId: thread.linked_user_id,
    });
    const metaAdFirstInbound = isMetaAdFastLaneEligible({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
        manychatMessageId,
    });
    const metaAdConversationFastLane = isMetaAdConversationFastLaneEligible({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
    });
    const codexLivePaidMetaThread = isCodexLivePaidMetaThread({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
        acquisitionMode,
    });
    const internalMetaAdConversationTestLane = isInternalMetaAdConversationTestLane({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
    });
    const internalTestResetCustomData = buildInternalMetaAdTestResetCustomData({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
        currentMessage: messageText,
        // The webhook has already persisted the source message timestamp here.
        // Using draft-start time would put the episode boundary after the very
        // inbound that created it, causing the stale-source guard to cancel it.
        resetAt: String(thread.custom_data?.instagram_graph?.last_graph_seen_at || '').trim()
            || new Date().toISOString(),
    });
    if (internalTestResetCustomData) {
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: { custom_data: internalTestResetCustomData },
                prefer: 'return=minimal',
            });
            thread.custom_data = internalTestResetCustomData;
        } catch (error) {
            console.warn('[ig-draft] internal Meta ad test reset persist failed:', error.message);
        }
    }
    if (isMetaAdCardAttachmentTransportArtifact({
        currentMessage: messageText,
        metaAdFirstInbound,
        internalMetaAdConversationTestLane,
    })) {
        console.log(`[ig-draft] skipping Meta ad-card transport attachment for thread ${thread.id}`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                skipped: 'meta_ad_card_attachment_transport_artifact',
                thread_id: thread.id,
            }),
        };
    }
    history = filterInternalTestHistoryAfterReset({
        history,
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
    });
    const metaAdOpeningTurn = metaAdFirstInbound || isInternalMetaAdConversationOpeningTurn({
        linkedUserId: thread.linked_user_id,
        customData: thread.custom_data,
        history,
        currentMessage: messageText,
    });
    const metaAdFastLane = metaAdFirstInbound || metaAdConversationFastLane;
    const unfilteredHistoryCount = history.length;
    history = filterMetaAdCardAttachmentHistory({
        history,
        currentMessage: messageText,
        metaAdFirstInbound,
        metaAdConversationFastLane,
    });
    let metaAdCardAttachmentsSuppressed = unfilteredHistoryCount - history.length;
    const metaAdFlowVariant = resolveMetaAdFlowVariant({
        customData: thread.custom_data,
        currentMessage: messageText,
        acquisitionMode,
    });
    const metaAdCheckoutUrl = foundersPassCheckoutUrlForMessage(
        messageText,
        thread.custom_data,
        metaAdFlowVariant,
        acquisitionMode
    );
    const exerciseConversationFastLane = isExerciseConversationFastLaneEligible({
        linkedUserId: thread.linked_user_id,
        currentMessage: messageText,
        recentMessages: history,
    });
    const balanceLeadAutoSendLane = isBalanceLeadAutoSendEnabled({
        linkedUserId: thread.linked_user_id,
        threadAutoSendEnabled: thread.auto_send_enabled,
        metaAdFastLane,
        exerciseConversationFastLane,
    });
    const autoSendEnabled = !thread.linked_user_id
        && (balanceLeadAutoSendLane || cocosAutoSendLane || voiceReplyTestLane || metaAdFastLane);

    // Idempotency — when ManyChat supplied a message_id, reuse it. Otherwise
    // fall back to thread+timestamp (less robust but better than nothing
    // for ManyChat configs that don't pass message_id through).
    let regenerateExistingBlankAlert = null;

    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id,status,alert_type,priority,client_id,description,suggested_message,scheduled_reply_text,data&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            const existingAlert = existing[0];
            let existingData = existingAlert.data || {};
            let latestInboundConfirmed = false;
            if (autoSendEnabled
                && existingAlert.status === 'canceled'
                && existingData.cancel_reason === 'superseded_by_new_message') {
                try {
                    latestInboundConfirmed = await isLatestInboundMessageForThread({ threadId, manychatMessageId });
                } catch (err) {
                    console.warn(`[ig-draft] latest-inbound recovery check failed for ${existingAlert.id}:`, err.message);
                }
            }
            if (isCanceledLatestRecoveryCandidate({
                status: existingAlert.status,
                data: existingData,
                autoSendEnabled,
                isLatestInbound: latestInboundConfirmed,
            })) {
                const recoveredAt = new Date().toISOString();
                existingData = {
                    ...existingData,
                    cancel_reason: null,
                    canceled_at: null,
                    recovered_latest_inbound_at: recoveredAt,
                    recovered_latest_inbound_reason: 'out_of_order_draft_completion',
                };
                const recovered = await supabaseQuery(
                    `coach_alerts?id=eq.${encodeURIComponent(existingAlert.id)}&status=eq.canceled`,
                    {
                        method: 'PATCH',
                        body: { status: 'pending', data: existingData },
                        prefer: 'return=representation',
                    }
                );
                if (recovered?.[0]) {
                    existingAlert.status = 'pending';
                    existingAlert.data = existingData;
                    console.warn(`[ig-draft] revived latest canceled alert ${existingAlert.id} after out-of-order draft completion`);
                }
            }
            const clearedContextHold = resolveStaleContextAutoHold({ existingAlert, existingData });
            const existingReplyText = existingAlert.suggested_message
                || existingAlert.scheduled_reply_text
                || existingData.draft_text
                || '';
            const storedBalanceContextBypass = existingData.auto_send_review_hold?.code === 'context_review'
                ? getBalanceAutoContextBypass({
                    balanceAutoSendLane: balanceLeadAutoSendLane,
                    contextReview: existingData.context_review,
                    draft: { joined: existingReplyText },
                    draftReview: existingData.draft_review,
                    currentMessage: existingData.message_preview,
                })
                : null;
            const existingScheduleData = storedBalanceContextBypass?.allowed
                ? {
                    ...existingData,
                    auto_send_review_hold: null,
                    auto_send_context_bypass: {
                        ...storedBalanceContextBypass,
                        allowed_at: new Date().toISOString(),
                    },
                    auto_send_review_hold_cleared_at: new Date().toISOString(),
                    auto_send_review_hold_cleared_reason: 'safe_first_captured_opener',
                }
                : (clearedContextHold?.data || existingData);
            const canResumeAutoSchedule = autoSendEnabled
                && existingAlert.status === 'pending'
                && (!existingData.auto_send_review_hold || !!clearedContextHold || !!storedBalanceContextBypass?.allowed)
                && !existingData.auto_send_stopped
                && (!cocosAutoSendLane
                    || existingData.outbound_voice_message === true
                    || existingData.approved_link_auto_sendable === true
                    || existingData.meta_ad_fast_lane === true);
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
    const permanentNeedsYouIdentity = {
        name: leadName,
        client_name: leadName,
        profile_name: thread.profile_name,
        ig_username: thread.ig_username,
        username: thread.ig_username,
        custom_data: thread.custom_data,
    };
    const kayProgramOrFixBypass = isKayNeedsYouPerson(permanentNeedsYouIdentity)
        && isProgramUpdateOrAppFixContext({
            currentMessage: messageText,
            alertData: {
                ...(thread.custom_data || {}),
                lead_stage: thread.lead_stage,
                linked_user_id: thread.linked_user_id,
            },
        });
    const permanentNeedsYouClient = isAlwaysNeedsYouPerson(permanentNeedsYouIdentity)
        && !kayProgramOrFixBypass;
    const draftOnlyNeedsYouClient = linkedClientNeedsYou || permanentNeedsYouClient;
    const draftOnlyNeedsYouReason = linkedClientNeedsYou
        ? 'linked_client_requires_shannon_approval'
        : 'always_needs_you_person';
    let memoryBlock = '';
    // For converted leads, prefer the in-app client_memory (richer signal,
    // includes workout/mood/diet history alongside conversation).
    if (thread.linked_user_id && thread.coach_id) {
        try {
            const memory = await loadClientMemory(thread.coach_id, thread.linked_user_id);
            // The dispatcher mirrors profile research into client_memory.preferences,
            // but also carry the thread snapshot directly so an IG reply keeps its
            // context if that best-effort mirror is delayed.
            memoryBlock = buildMemoryBlock(memory ? {
                ...memory,
                public_profile_research: thread.custom_data?.public_profile_research || null,
            } : {
                public_profile_research: thread.custom_data?.public_profile_research || null,
            });
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
    const relationshipMemoryBlock = buildRelationshipMemoryBlock(thread);
    if (relationshipMemoryBlock) {
        memoryBlock = [memoryBlock, relationshipMemoryBlock].filter(Boolean).join('\n');
    }

    if (internalMetaAdConversationTestLane) {
        memoryBlock = '';
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
    if (internalMetaAdConversationTestLane) {
        profileBlock = '';
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
    const shouldPersistAcquisitionMode = thread.custom_data?.acquisition_mode !== acquisitionMode;
    const shouldPersistMetaVariant = !internalMetaAdConversationTestLane
        && isPaidMetaAcquisitionMode(acquisitionMode)
        && (thread.custom_data?.meta_ad_flow_variant !== metaAdFlowVariant
            || thread.custom_data?.offer_flow_variant !== metaAdFlowVariant);
    if (shouldPersistAcquisitionMode || shouldPersistMetaVariant) {
        const resolvedCustomData = {
            ...(thread.custom_data || {}),
            acquisition_mode: acquisitionMode,
            acquisition_mode_resolved_at: shouldPersistAcquisitionMode
                ? new Date().toISOString()
                : thread.custom_data?.acquisition_mode_resolved_at,
            meta_ad_flow_variant: shouldPersistMetaVariant
                ? metaAdFlowVariant
                : thread.custom_data?.meta_ad_flow_variant,
            offer_flow_variant: shouldPersistMetaVariant
                ? metaAdFlowVariant
                : thread.custom_data?.offer_flow_variant,
            meta_ad_flow_variant_resolved_at: shouldPersistMetaVariant
                ? new Date().toISOString()
                : thread.custom_data?.meta_ad_flow_variant_resolved_at,
            meta_ad_flow_variant_source: shouldPersistMetaVariant
                ? 'verified_meta_attribution'
                : thread.custom_data?.meta_ad_flow_variant_source,
        };
        try {
            await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
                method: 'PATCH',
                body: { custom_data: resolvedCustomData },
                prefer: 'return=minimal',
            });
            thread.custom_data = resolvedCustomData;
        } catch (e) {
            console.warn('[ig-draft] acquisition mode/variant persist failed:', e.message);
        }
    }

    const leadBlock = buildLeadBlock({
        profileName: thread.profile_name,
        igUsername: thread.ig_username,
        customData: internalMetaAdConversationTestLane
            ? buildInternalTestEpisodeCustomData(thread.custom_data, history)
            : thread.custom_data,
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
    let earlyInstagramSeenAction = null;
    let earlyInstagramTypingAction = null;
    let stopPaidMetaTypingHeartbeat = () => {};
    if (metaAdFastLane && hasInstagramGraphRoute && !getMetaAdSensitiveHoldReason({
        alertData: { meta_ad_fast_lane: true },
        currentMessage: messageText,
    })) {
        const earlyTypingDelayMs = resolveMetaAdEarlyTypingDelayMs({
            lastInboundAt: thread.last_inbound_at,
            seed: manychatMessageId || messageText,
            firstReply: metaAdOpeningTurn,
        });
        if (earlyTypingDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, earlyTypingDelayMs));
        }
        earlyInstagramSeenAction = await sendInstagramGraphTypingAction({
            channel,
            recipientId: graphRecipientId,
            accountId: graphAccountId,
            action: 'mark_seen',
            beforeChunkIndex: 0,
            gapMs: earlyTypingDelayMs,
        });
        earlyInstagramTypingAction = await sendInstagramGraphTypingAction({
            channel,
            recipientId: graphRecipientId,
            accountId: graphAccountId,
            action: 'typing_on',
            beforeChunkIndex: 0,
            gapMs: earlyTypingDelayMs,
        });
        stopPaidMetaTypingHeartbeat = startPaidMetaTypingHeartbeat({
            enabled: true,
            recipientId: graphRecipientId,
            accountId: graphAccountId,
        });
    }
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
    const currentInboundTurnMessage = replaceIgMediaMarkers(
        sanitizeIgStoryReplyContextText(buildCurrentInboundTurnText(messageText, recentInboundMessages)),
        { photo: '[photo]', audio: '[voice note]', video: '[video]' }
    );
    const meaningfulLeadReplyCount = countMeaningfulLeadReplies(history, qualifierCurrentMessage);
    const metaAdGoalReplyTurn = metaAdConversationFastLane
        && isMetaAdGoalReplyTurn(history, messageText);
    const qualifierEvaluationThread = buildInternalTestQualifierThread(thread, history);
    let qualifier = qualifierEvaluationThread.qualifier || null;
    // Paid Meta has its own conversation agent for ordinary wording. Exact
    // destination handoffs remain deterministic so an accepted preview cannot
    // turn into an invented email-collection step or lose its signed card.
    const exactPaidMetaHandoff = metaAdConversationFastLane
        ? buildDeterministicPaidMetaConversationReply({
            currentMessage: currentInboundTurnMessage,
            qualifier,
            history,
            flowVariant: metaAdFlowVariant,
            checkoutUrl: metaAdCheckoutUrl,
            appPreviewUrl: buildMetaAppPreviewUrl(thread.id, { flowVariant: metaAdFlowVariant }),
            personalVoiceNoteMode: false,
            allowVideoAttachment: hasInstagramGraphRoute,
        })
        : null;
    const earlyDeterministicProgression = (['campaign_app_preview_handoff', 'campaign_buyer_handoff']
        .includes(String(exactPaidMetaHandoff?.replyMode || ''))
        || (metaAdFlowVariant === 'broad_pain'
            && String(exactPaidMetaHandoff?.replyMode || '') === 'campaign_sales_progression'))
        ? exactPaidMetaHandoff
        : null;
    const fastDeterministicProgression = shouldApplyDeterministicPaidMetaReplyOverride(earlyDeterministicProgression)
        ? earlyDeterministicProgression
        : null;
    const qualifierEligible = !metaAdConversationFastLane && !fastDeterministicProgression && isQualifierEligible({
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
    });
    let qualifierEvaluated = false;
    let qualifierError = null;
    let qualifierModel = null;
    const priorStage = qualifier?.stage || null;
    const priorFacts = qualifier?.facts ? { ...qualifier.facts } : {};
    const priorQualifier = qualifier;
    if (qualifierEligible) {
        try {
            const result = await evaluateQualifier({
                thread: qualifierEvaluationThread,
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

    if (qualifierEligible && !cocosAutoSendLane) {
        try {
            const progressionWrites = [recordHealthProgressionAnswer({
                thread,
                currentMessage: qualifierCurrentMessage,
                manychatMessageId,
                botAccount: botAccount || 'shan_n_sunny',
                acquisitionMode,
                offerFlowVariant: metaAdFlowVariant,
            })];
            if (qualifierEvaluated) {
                progressionWrites.push(recordQualifierProgressionMilestones({
                    thread,
                    priorQualifier,
                    nextQualifier: qualifier,
                    botAccount: botAccount || 'shan_n_sunny',
                    acquisitionMode,
                    offerFlowVariant: metaAdFlowVariant,
                }));
            }
            await Promise.all(progressionWrites);
        } catch (e) {
            console.warn('[ig-draft] lead health progression tracking failed (non-fatal):', e.message);
        }
    }

    const terminalQualifierStage = ['pitched', 'won'].includes(qualifier?.stage);
    const qualifierQuestion = (!terminalQualifierStage && qualifierEligible && qualifierEvaluated && qualifier?.is_question_moment && qualifier?.next_question)
        ? qualifier.next_question.trim()
        : null;
    const recentOutboundVoiceMessage = await hasRecentOutboundVoiceMessage(
        thread.id,
        1,
        internalMetaAdConversationTestLane
            ? resolveInternalTestVoiceCooldownResetAt(thread.custom_data, history)
            : ''
    );
    const inboundVoiceMessage = hasInboundVoiceNoteInUnansweredBatch({
        currentMessage: messageText,
        recentInboundMessages,
    });
    const personalVoicePlan = resolvePersonalVoiceReplyPlan({
        channel,
        hasInstagramGraphRoute,
        linkedUserId: thread.linked_user_id,
        currentMessage: metaAdConversationFastLane ? currentInboundTurnMessage : qualifierCurrentMessage,
        qualifier,
        meaningfulLeadReplyCount,
        hasRecentVoiceMessage: recentOutboundVoiceMessage,
        inboundVoiceMessage,
        bypassRecentVoiceCooldownForInternalTest: false,
    });
    // Internal accounts exercise the same voice eligibility as real leads.
    // The Cocos -> Shan n Sunny flag opens the auto-reply test lane, but it
    // must not make a first informational reply feel unnaturally intimate.
    const outboundVoiceMessage = shouldUseOutboundSyntheticVoice({
        personalVoicePlan,
        metaAdConversationFastLane,
    });
    const outboundVoiceMessageReason = personalVoicePlan.reason;
    const dmLanguageExperiment = resolveDmLanguageExperiment({
        acquisitionMode,
        linkedUserId: thread.linked_user_id || null,
        threadId: thread.id,
        channel,
    });
    let draft;
    try {
        draft = fastDeterministicProgression || (metaAdOpeningTurn
            && (metaAdFlowVariant === 'broad_pain' || shouldUseDeterministicMetaAdFirstReply(messageText)) ? buildMetaAdFoundersPassFirstReply(messageText, {
            customData: thread.custom_data,
            flowVariant: metaAdFlowVariant,
            acquisitionMode,
        }) : await generateDraft({
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
            audioTranscriptOverrides,
            personalVoiceNoteMode: outboundVoiceMessage,
            acquisitionMode,
            adFlowVariant: metaAdFlowVariant,
            checkoutUrl: metaAdCheckoutUrl,
            dmLanguageExperiment,
        }));
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
            nativeStoryConfusionRepairBlock: '',
            learningReelContextBlock,
            learningReelReplyAnchorBlock,
            learningReelEvidenceBlock,
        };
    }

    if (metaAdConversationFastLane && isContextualMetaAdOfferLinkRequest({
        currentMessage: messageText,
        qualifier,
        history,
    })) {
        const contextualLinkReply = buildContextualMetaAdOfferLinkReply({
            checkoutUrl: metaAdCheckoutUrl,
            flowVariant: metaAdFlowVariant,
            currentMessage: messageText,
        });
        if (contextualLinkReply) draft = {
            ...draft,
            ...contextualLinkReply,
        };
    }
    if (metaAdConversationFastLane
        && hasInstagramGraphRoute
        && metaAdFlowVariant !== 'broad_pain'
        && isExplicitPaidMetaProofVideoRetry({ currentMessage: messageText, history })) {
        draft = {
            ...draft,
            ...buildPaidMetaProofVideoRetryReply(messageText),
            flowVariant: metaAdFlowVariant,
        };
    }
    if (metaAdConversationFastLane) {
        draft = attachPaidMetaWriterSelectedMedia(draft, {
            allowAttachments: hasInstagramGraphRoute,
            flowVariant: metaAdFlowVariant,
            history,
        });
        draft = ensurePaidMetaAppVideoPreviewCta(draft);
    }
    if (metaAdConversationFastLane && hasInstagramGraphRoute && graphRecipientId) {
        try {
            // Meta's typing indicator expires while the dedicated agent is
            // generating/reviewing. Refresh it here so it does not vanish and
            // then reappear immediately before delivery.
            earlyInstagramTypingAction = await sendInstagramGraphTypingAction({
                recipientId: graphRecipientId,
                accountId: graphAccountId,
                action: 'typing_on',
                beforeChunkIndex: 0,
                gapMs: 0,
            });
        } catch (error) {
            console.warn('[ig-draft] paid Meta typing refresh failed (non-fatal):', error.message);
        }
    }
    draft = removePaidMetaBlockerVoiceGreeting({
        draft,
        outboundVoiceMessage,
        outboundVoiceMessageReason,
        metaAdConversationFastLane,
        flowVariant: metaAdFlowVariant,
    });
    const dmLanguageShape = measureDmLanguageShape({
        chunks: draft.chunks,
        inboundText: currentInboundTurnMessage,
    });
    const dmLanguageObservation = {
        dm_language_contract_version: dmLanguageExperiment.contractVersion,
        dm_language_experiment: dmLanguageExperiment.experiment || undefined,
        dm_language_variant: dmLanguageExperiment.variant,
        dm_language_enrolled: dmLanguageExperiment.enrolled,
        dm_language_protected_lane: dmLanguageExperiment.protectedLane,
        dm_language_assignment_reason: dmLanguageExperiment.reason,
        dm_language_shape: dmLanguageShape,
        dm_language_stage_before: priorQualifier?.commercial_stage || 'engaged',
        dm_language_stage_after: qualifier?.commercial_stage || priorQualifier?.commercial_stage || 'engaged',
        dm_language_goal_evidence_present: !!(
            cleanFactValue(qualifier?.facts?.current_state)
            || cleanFactValue(qualifier?.facts?.motivation)
        ),
        dm_language_blocker_evidence_present: !!cleanFactValue(qualifier?.facts?.history_blockers),
    };

    if (Array.isArray(durableMediaIds) && durableMediaIds.length) {
        try {
            const verifiedDecode = draft.chunks?.length
                ? (draft.mediaDecode || {})
                : { ...(draft.mediaDecode || {}), analyzed_kinds: [], analysis_succeeded: false, analysis_complete: false };
            await markDraftAnalysis(durableMediaIds, verifiedDecode, draft.error || 'draft returned no verified media analysis');
        } catch (error) {
            console.warn('[ig-draft] durable media analysis state update failed:', error.message);
        }
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
    const displayEpisodeStartMs = Date.parse(draft.conversationEpisode?.startedAt || '');
    const displayRecentInboundMessages = recentInboundMessages.map(m => {
        const rawText = String(m?.text || '').trim();
        return {
            ...m,
            storyReplyContext: isIgStoryReplyContextText(rawText),
            text: sanitizeIgStoryReplyContextText(rawText),
        };
    }).filter(m => {
        if (!m.text) return false;
        if (draft.conversationEpisode?.isNewEpisode && Number.isFinite(displayEpisodeStartMs)) {
            const createdAtMs = conversationEventTime(m);
            if (createdAtMs != null && createdAtMs < displayEpisodeStartMs) return false;
        }
        if (!m.storyReplyContext || !displaySourceMessageKey) return true;
        return normalizedIgLeadMessageKey(m.text) !== displaySourceMessageKey;
    });
    const displayHistory = history.filter(m => {
        if (!m || m.direction !== 'in' || !displaySourceMessageKey) return true;
        const rawText = String(m.text || '').trim();
        if (!isIgStoryReplyContextText(rawText)) return true;
        return normalizedIgLeadMessageKey(sanitizeIgStoryReplyContextText(rawText)) !== displaySourceMessageKey;
    });
    const rawInboundMessageBatch = formatInboundBatchForDisplay({
        recentInboundMessages: displayRecentInboundMessages,
        currentMessage: displaySourceMessage,
        currentCreatedAt: new Date().toISOString(),
    });
    const metaAdCardPhotoSuppression = suppressUnresolvedMetaAdCardPhoto({
        inboundMessageBatch: rawInboundMessageBatch,
        currentMessage: displayMessage,
        metaAdFastLane,
    });
    const inboundMessageBatch = metaAdCardPhotoSuppression.batch;
    metaAdCardAttachmentsSuppressed += metaAdCardPhotoSuppression.suppressedCount;
    const effectiveDisplayRecentInboundMessages = metaAdCardPhotoSuppression.suppressedCount > 0
        ? displayRecentInboundMessages.filter(item => {
            const text = String(item?.text || item?.message || '').trim();
            const media = Array.isArray(item?.media) ? item.media : [];
            return !META_AD_UNRESOLVED_PHOTO_MARKER_RE.test(text) || media.length > 0;
        })
        : displayRecentInboundMessages;
    const effectiveMediaDecode = metaAdCardPhotoSuppression.suppressedCount > 0
        ? {
            ...(draft.mediaDecode || {}),
            photo_failed: false,
            photo_url_count: Math.max(0, Number(draft.mediaDecode?.photo_url_count || 0) - metaAdCardPhotoSuppression.suppressedCount),
            image_url_count: Math.max(0, Number(draft.mediaDecode?.image_url_count || 0) - metaAdCardPhotoSuppression.suppressedCount),
        }
        : (draft.mediaDecode || null);
    const effectiveTimeline = metaAdCardPhotoSuppression.suppressedCount > 0
        ? String(draft.timeline || '').split('\n').filter(line => !/:\s*(?:📷\s*)?(?:photo|\[photo\])\s*$/i.test(line)).join('\n')
        : (draft.timeline || '');
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
        image_url_count: Math.max(0, Number(draft.urlCount || 0) - metaAdCardPhotoSuppression.suppressedCount),
        audio_url_count: draft.audioUrlCount || 0,
        video_url_count: draft.videoUrlCount || 0,
        media_decode: effectiveMediaDecode,
    });
    const contextReview = buildContextReviewInfo({
        channel,
        ig_thread_id: thread.id,
        manychat_message_id: manychatMessageId || null,
        lead_stage: effectiveLeadStage,
        message_preview: displaySourceMessage,
        inbound_message_batch: inboundMessageBatch,
        recent_inbound_messages: effectiveDisplayRecentInboundMessages,
        last_outbound_message: lastOutboundMessage,
        learning_reels: learningReelHistory,
        media_decode: effectiveMediaDecode,
        audio_transcript_count: draft.audioTranscriptCount || 0,
        first_captured_lead_reply: firstCapturedLeadReply,
        draft_evidence: {
            current_message: displayMessage,
            recent_timeline: effectiveTimeline,
            story_context: draft.storyReplyPromptContextBlock || '',
            media_context: metaAdCardPhotoSuppression.suppressedCount > 0
                ? ''
                : (draft.mediaSummary || draft.mediaContextPromptBlock || ''),
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
    const metaAdFirstReplyApproval = buildMetaAdFirstReplyApproval({ metaAdFirstInbound: metaAdOpeningTurn, draft });
    const paidMetaConversationApproval = buildPaidMetaConversationApproval({
        metaAdConversationFastLane,
        draft,
        currentMessage: displayMessage,
        linkedUserId: thread.linked_user_id,
        qualifier,
        history: displayHistory,
    });
    const verifiedPaidMetaPreviewApproval = paidMetaConversationApproval?.required === false
        && paidMetaConversationApproval?.code === 'approved_meta_ad_sales_progression'
        && draft?.appPreviewHandoff === true
        && isMetaAppPreviewUrl(draft?.appPreviewUrl);
    let challengeOfferWarning = metaAdFirstReplyApproval
        || paidMetaConversationApproval
        || buildChallengeOfferWarning({ draftText: draft.joined, qualifier, currentMessage: displayMessage });
    const skipGenericPaidMetaLinkHandoff = shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression({
        approval: paidMetaConversationApproval,
        draft,
    });
    const leadOnboardingHandoffData = buildApprovedMetaAdFirstReplyHandoffData({
        approval: metaAdFirstReplyApproval,
        draft,
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
        threadId: thread.id,
        manychatMessageId,
    }) || (verifiedPaidMetaPreviewApproval ? {
        lead_onboarding_handoff: false,
        needs_you_required: false,
        operator_queue: null,
        client_manager_review_required: false,
        style_note: 'Verified paid Meta app-preview acceptance is approved for automatic sending.',
        signup_link_manual_only: false,
        signup_link_handoff_url: draft.appPreviewUrl,
        approved_link_auto_sendable: true,
        paid_meta_app_preview_handoff: true,
    } : (!skipGenericPaidMetaLinkHandoff && buildLeadOnboardingHandoffData({
        draftText: draft.joined,
        qualifier,
        leadStage: effectiveLeadStage,
        linkedUserId: thread.linked_user_id,
        threadId: thread.id,
        manychatMessageId,
        currentMessage: displayMessage,
        appPreviewHandoffUrl: draft.appPreviewHandoff ? draft.appPreviewUrl : '',
        requireActualLinkAction: metaAdConversationFastLane,
    })));
    const approvedCoachingLinkHandoff = leadOnboardingHandoffData?.approved_link_auto_sendable === true;
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
            client_manager_auto_reply_enabled: clientManagerAutoReplyEnabled || undefined,
            client_manager_browser_dispatch_enabled: clientManagerBrowserDispatchEnabled || undefined,
            custom_data: clientManagerAutoReplyEnabled ? {
                client_manager_auto_reply_enabled: true,
                client_manager_browser_dispatch_enabled: clientManagerBrowserDispatchEnabled || undefined,
            } : undefined,
            client_manager_review_required: draftOnlyNeedsYouClient || undefined,
            needs_you_required: draftOnlyNeedsYouClient || undefined,
            needs_shannon_approval: draftOnlyNeedsYouClient || undefined,
            permanent_needs_you_draft_only: draftOnlyNeedsYouClient || undefined,
            linked_client_manual_review: linkedClientNeedsYou || undefined,
            operator_queue: draftOnlyNeedsYouClient ? 'needs_you' : null,
            needs_you_reason: draftOnlyNeedsYouClient ? draftOnlyNeedsYouReason : undefined,
            needs_you_reasons: draftOnlyNeedsYouClient ? [draftOnlyNeedsYouReason] : undefined,
            codex_review: draftOnlyNeedsYouClient ? {
                source: 'balance-combined-dm-manager',
                decision: 'client_manager_review_required',
                queue: 'needs_you',
                needs_shannon_approval: true,
                reason: draftOnlyNeedsYouReason,
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
            acquisition_mode: acquisitionMode,
            offer_flow_variant: metaAdFlowVariant,
            ...dmLanguageObservation,
            conversation_episode_started_at: draft.conversationEpisode?.startedAt || null,
            conversation_episode_reason: draft.conversationEpisode?.reason || 'continuous_thread',
            conversation_episode_new: draft.conversationEpisode?.isNewEpisode === true,
            auto_send_enabled_at_draft: autoSendEnabled,
            auto_send_default_reason: metaAdFastLane
                ? 'meta_ad_fast_lane'
                : (exerciseConversationFastLane
                    ? 'balance_exercise_fast_lane'
                    : (cocosAutoSendLane ? 'cocos_auto_lane' : undefined)),
            auto_send_allow_immediate: false,
            auto_send_fast_lane_delay_ms: resolveIgFastLaneDelayMs({
                metaAdFastLane,
                voiceReplyTestLane,
                approvedCoachingLinkHandoff,
                exerciseConversationFastLane,
            }),
            meta_ad_fast_lane: metaAdFastLane || undefined,
            meta_ad_card_attachments_suppressed: metaAdCardAttachmentsSuppressed || undefined,
            meta_ad_first_inbound: metaAdOpeningTurn || undefined,
            meta_ad_conversation_fast_lane: metaAdConversationFastLane || undefined,
            meta_ad_internal_test_lane: internalMetaAdConversationTestLane || undefined,
            instagram_early_seen_action: earlyInstagramSeenAction?.attempted
                ? earlyInstagramSeenAction
                : undefined,
            instagram_early_typing_action: earlyInstagramTypingAction?.attempted
                ? earlyInstagramTypingAction
                : undefined,
            exercise_conversation_fast_lane: exerciseConversationFastLane || undefined,
            meta_ad_flow_variant: metaAdFastLane ? draft.flowVariant : metaAdFlowVariant,
            meta_ad_first_reply_intent: metaAdOpeningTurn ? draft.firstReplyIntent : undefined,
            paid_meta_conversation_step: /^deterministic_paid_meta_conversation_v\d+/i.test(String(draft.model || ''))
                ? draft.replyMode
                : undefined,
            paid_meta_conversation_approval: paidMetaConversationApproval || undefined,
            meta_ad_checkout_url: draft.checkoutUrl || undefined,
            meta_ad_attribution: metaAdFastLane ? (thread.custom_data?.meta_ad_attribution || undefined) : undefined,
            outbound_voice_message: outboundVoiceMessage || undefined,
            outbound_voice_message_reason: outboundVoiceMessageReason || undefined,
            voice_companion_text: outboundVoiceMessage ? (draft.voiceCompanionText || undefined) : undefined,
            outbound_voice_thought_pause_ms: outboundVoiceMessage ? (draft.voiceThoughtPauseMs || undefined) : undefined,
            outbound_voice_thought_pauses_ms: outboundVoiceMessage ? (draft.voiceThoughtPausesMs || undefined) : undefined,
            outbound_voice_render_mode: outboundVoiceMessage ? (draft.voiceRenderMode || undefined) : undefined,
            outbound_voice_source_text: outboundVoiceMessage ? (draft.joined || undefined) : undefined,
            paid_meta_app_preview_handoff: draft.appPreviewHandoff || undefined,
            paid_meta_app_preview_url: draft.appPreviewHandoff ? draft.appPreviewUrl : undefined,
            inbound_voice_message: inboundVoiceMessage || undefined,
            elevenlabs_voice_id: outboundVoiceMessage ? 'UHnJrglEof8vTMenwnVm' : undefined,
            elevenlabs_voice_name: outboundVoiceMessage ? 'Shannon Balance Professional 20260606' : undefined,
            personal_voice_note_policy: personalVoicePlan.useSyntheticVoice ? {
                trigger: inboundVoiceMessage
                    ? 'lead_voice_note_lane'
                    : (personalVoicePlan.reason === 'lead_accountability_connection_moment'
                        ? 'lead_accountability_connection_moment'
                        : 'lead_goal_or_blocker'),
                cooldown_days: inboundVoiceMessage ? 0 : 1,
                cooldown_bypassed_for_internal_test: internalMetaAdConversationTestLane || undefined,
                synthetic: true,
                never_for_ai_authenticity: true,
            } : undefined,
            synthetic_voice_note_forbidden: personalVoicePlan.syntheticVoiceForbidden || undefined,
            manual_native_voice_note_recommended: personalVoicePlan.manualNativeVoiceRecommended || undefined,
            manual_native_voice_note_reason: personalVoicePlan.manualNativeVoiceReason || undefined,
            manual_native_voice_note_script: personalVoicePlan.manualNativeVoiceScript || undefined,
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
            ...buildDraftVideoAttachmentData(draft),
            ...buildDraftImageAttachmentData(draft),
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || 'standard',
            draft_max_chunks: draft.maxChunks || MAX_CHUNKS,
            drafted_at: new Date().toISOString(),
            // Diagnostics so we can see from the DB why a draft failed
            // without needing Netlify function logs.
            draft_error: draft.error || null,
            empty_draft_recovery: draft.emptyDraftRecovery || null,
            image_url_count: Math.max(0, Number(draft.urlCount || 0) - metaAdCardPhotoSuppression.suppressedCount),
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            audio_transcript_count: draft.audioTranscriptCount || 0,
            video_url_count: draft.videoUrlCount || 0,
            video_inline_count: draft.videoCount || 0,
            media_decode: effectiveMediaDecode,
            durable_media_ids: Array.isArray(durableMediaIds) ? durableMediaIds : [],
            durable_media_preserved: Array.isArray(durableMediaIds) && durableMediaIds.length > 0,
            media_summary: metaAdCardPhotoSuppression.suppressedCount > 0 ? null : (draft.mediaSummary || null),
            media_review: mediaReview.required ? mediaReview : null,
            context_review: contextReview.required ? contextReview : null,
            challenge_offer_warning: challengeOfferWarning,
            ...(leadOnboardingHandoffData || {}),
            first_captured_lead_reply: firstCapturedLeadReply,
            // Trailing inbound streak, same shape as instant-coach-draft.
            // Media in those prior messages gets rendered as clean labels.
            recent_inbound_messages: effectiveDisplayRecentInboundMessages.map(m => ({
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
                prior_unanswered: effectiveDisplayRecentInboundMessages.map(m => ({
                    text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                    created_at: m.created_at,
                })),
                recent_workouts: truncate(recentWorkoutEvidence || '', 2000),
                recent_activity: truncate(weeklyAppContext || '', 3000),
                recent_timeline: truncateTail(effectiveTimeline, 4000),
                story_context: truncate(String(draft.storyReplyPromptContextBlock || '').trim(), 1400),
                native_story_context: truncate(String(draft.nativeStoryOutreachContextBlock || '').trim(), 1400),
                native_story_confusion_repair: truncate(String(draft.nativeStoryConfusionRepairBlock || '').trim(), 1400),
                media_context: metaAdCardPhotoSuppression.suppressedCount > 0 ? '' : truncate([
                    draft.mediaSummary ? `Decoded media summary: ${draft.mediaSummary}` : '',
                    String(draft.mediaContextPromptBlock || '').trim(),
                ].filter(Boolean).join('\n\n'), 1800),
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
            // produced — stage, warmth, suggested next move, behavior profile, and the
            // quote-grounded reason for the timing. The admin dashboard
            // alert card reads these to render the strategic strip
            // (stage badge / warmth / next-move / why-now). Null
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
        const coalescedOutboundVoiceMessage = metaAdConversationFastLane
            ? false
            : (!personalVoicePlan.syntheticVoiceForbidden
                && (outboundVoiceMessage || existingPending.data?.outbound_voice_message || false));
        const coalescedOutboundVoiceReason = outboundVoiceMessageReason
            || existingPending.data?.outbound_voice_message_reason
            || '';
        draft = restoreCoalescedPaidMetaVoiceDraft({
            draft,
            existingPendingData: existingPending.data,
            outboundVoiceMessage,
            metaAdConversationFastLane,
            metaAdOpeningTurn,
            metaAdGoalReplyTurn,
            currentMessage: messageText,
            qualifier,
            history,
            flowVariant: metaAdFlowVariant,
            checkoutUrl: metaAdCheckoutUrl,
            appPreviewUrl: buildMetaAppPreviewUrl(thread.id, { flowVariant: metaAdFlowVariant }),
            allowVideoAttachment: hasInstagramGraphRoute,
        });
        const mergedData = {
            ...(existingPending.data || alertRow.data),
            client_manager_auto_reply_enabled: clientManagerAutoReplyEnabled || undefined,
            client_manager_browser_dispatch_enabled: clientManagerBrowserDispatchEnabled || undefined,
            custom_data: clientManagerAutoReplyEnabled ? {
                ...(existingPending.data?.custom_data || {}),
                client_manager_auto_reply_enabled: true,
                client_manager_browser_dispatch_enabled: clientManagerBrowserDispatchEnabled || undefined,
            } : existingPending.data?.custom_data,
            client_manager_review_required: draftOnlyNeedsYouClient
                ? true
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.client_manager_review_required),
            needs_you_required: draftOnlyNeedsYouClient
                ? true
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.needs_you_required),
            needs_shannon_approval: draftOnlyNeedsYouClient
                ? true
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.needs_shannon_approval),
            linked_client_manual_review: linkedClientNeedsYou
                ? true
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.linked_client_manual_review),
            permanent_needs_you_draft_only: draftOnlyNeedsYouClient
                ? true
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.permanent_needs_you_draft_only),
            operator_queue: draftOnlyNeedsYouClient
                ? 'needs_you'
                : (clientManagerAutoReplyEnabled ? null : (existingPending.data?.operator_queue || null)),
            needs_you_reason: draftOnlyNeedsYouClient
                ? draftOnlyNeedsYouReason
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.needs_you_reason),
            needs_you_reasons: draftOnlyNeedsYouClient
                ? [...new Set([...(existingPending.data?.needs_you_reasons || []), draftOnlyNeedsYouReason])]
                : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.needs_you_reasons),
            codex_review: draftOnlyNeedsYouClient ? {
                ...(existingPending.data?.codex_review || {}),
                source: 'balance-combined-dm-manager',
                decision: 'client_manager_review_required',
                queue: 'needs_you',
                needs_shannon_approval: true,
                reason: draftOnlyNeedsYouReason,
                evidence_ids: [
                    thread.id ? `ig_threads:${thread.id}` : '',
                    thread.linked_user_id ? `users:${thread.linked_user_id}` : '',
                ].filter(Boolean),
                reviewed_at: new Date().toISOString(),
                automation_id: 'balance-combined-dm-manager',
            } : (clientManagerAutoReplyEnabled ? undefined : existingPending.data?.codex_review),
            message_preview: truncate(messageText, 400),
            last_outbound_message: lastOutboundMessage || existingPending.data?.last_outbound_message || null,
            learning_reels: learningReelHistory.length ? {
                recent: learningReelHistory,
                last_sent: learningReelHistory[0],
            } : (existingPending.data?.learning_reels || null),
            proposed_actions: mergeProposedActions(existingPending.data?.proposed_actions, proposedActions),
            manychat_message_id: manychatMessageId || (existingPending.data && existingPending.data.manychat_message_id) || null,
            lead_stage: effectiveLeadStage || thread.lead_stage || existingPending.data?.lead_stage || 'new',
            acquisition_mode: acquisitionMode,
            offer_flow_variant: metaAdFlowVariant,
            ...dmLanguageObservation,
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
            auto_send_default_reason: metaAdFastLane
                ? 'meta_ad_fast_lane'
                : (exerciseConversationFastLane
                    ? 'balance_exercise_fast_lane'
                    : (cocosAutoSendLane ? 'cocos_auto_lane' : undefined)),
            auto_send_allow_immediate: false,
            auto_send_fast_lane_delay_ms: resolveIgFastLaneDelayMs({
                metaAdFastLane,
                voiceReplyTestLane,
                approvedCoachingLinkHandoff,
                exerciseConversationFastLane,
            }) ?? existingPending.data?.auto_send_fast_lane_delay_ms ?? undefined,
            meta_ad_fast_lane: metaAdFastLane || existingPending.data?.meta_ad_fast_lane || undefined,
            meta_ad_card_attachments_suppressed: metaAdCardAttachmentsSuppressed
                || existingPending.data?.meta_ad_card_attachments_suppressed
                || undefined,
            meta_ad_first_inbound: metaAdOpeningTurn || existingPending.data?.meta_ad_first_inbound || undefined,
            meta_ad_conversation_fast_lane: metaAdConversationFastLane || existingPending.data?.meta_ad_conversation_fast_lane || existingPending.data?.meta_ad_active_conversation_fast_lane || undefined,
            meta_ad_internal_test_lane: internalMetaAdConversationTestLane || existingPending.data?.meta_ad_internal_test_lane || undefined,
            instagram_early_seen_action: earlyInstagramSeenAction?.attempted
                ? earlyInstagramSeenAction
                : existingPending.data?.instagram_early_seen_action || undefined,
            instagram_early_typing_action: earlyInstagramTypingAction?.attempted
                ? earlyInstagramTypingAction
                : existingPending.data?.instagram_early_typing_action || undefined,
            exercise_conversation_fast_lane: exerciseConversationFastLane || existingPending.data?.exercise_conversation_fast_lane || undefined,
            meta_ad_flow_variant: metaAdFastLane ? draft.flowVariant : (metaAdFlowVariant || existingPending.data?.meta_ad_flow_variant || undefined),
            meta_ad_first_reply_intent: metaAdOpeningTurn ? draft.firstReplyIntent : existingPending.data?.meta_ad_first_reply_intent,
            meta_ad_checkout_url: draft.checkoutUrl || existingPending.data?.meta_ad_checkout_url || undefined,
            meta_ad_attribution: metaAdFastLane
                ? (thread.custom_data?.meta_ad_attribution || existingPending.data?.meta_ad_attribution || undefined)
                : existingPending.data?.meta_ad_attribution,
            outbound_voice_message: coalescedOutboundVoiceMessage || undefined,
            outbound_voice_message_reason: coalescedOutboundVoiceMessage ? coalescedOutboundVoiceReason : undefined,
            voice_companion_text: coalescedOutboundVoiceMessage
                ? (draft.voiceCompanionText || existingPending.data?.voice_companion_text || undefined)
                : undefined,
            outbound_voice_thought_pause_ms: coalescedOutboundVoiceMessage
                ? (draft.voiceThoughtPauseMs || existingPending.data?.outbound_voice_thought_pause_ms || undefined)
                : undefined,
            outbound_voice_thought_pauses_ms: coalescedOutboundVoiceMessage
                ? (draft.voiceThoughtPausesMs || existingPending.data?.outbound_voice_thought_pauses_ms || undefined)
                : undefined,
            outbound_voice_render_mode: coalescedOutboundVoiceMessage
                ? (draft.voiceRenderMode || existingPending.data?.outbound_voice_render_mode || undefined)
                : undefined,
            outbound_voice_source_text: coalescedOutboundVoiceMessage
                ? (draft.joined || existingPending.data?.outbound_voice_source_text || undefined)
                : undefined,
            paid_meta_app_preview_handoff: draft.appPreviewHandoff || existingPending.data?.paid_meta_app_preview_handoff || undefined,
            paid_meta_app_preview_url: draft.appPreviewHandoff
                ? draft.appPreviewUrl
                : existingPending.data?.paid_meta_app_preview_url,
            inbound_voice_message: inboundVoiceMessage || existingPending.data?.inbound_voice_message || undefined,
            elevenlabs_voice_id: coalescedOutboundVoiceMessage
                ? (existingPending.data?.elevenlabs_voice_id || 'UHnJrglEof8vTMenwnVm')
                : undefined,
            elevenlabs_voice_name: coalescedOutboundVoiceMessage
                ? (existingPending.data?.elevenlabs_voice_name || 'Shannon Balance Professional 20260606')
                : undefined,
            personal_voice_note_policy: personalVoicePlan.useSyntheticVoice ? {
                trigger: inboundVoiceMessage
                    ? 'lead_voice_note_lane'
                    : (personalVoicePlan.reason === 'lead_accountability_connection_moment'
                        ? 'lead_accountability_connection_moment'
                        : 'lead_goal_or_blocker'),
                cooldown_days: inboundVoiceMessage ? 0 : 1,
                cooldown_bypassed_for_internal_test: internalMetaAdConversationTestLane || undefined,
                synthetic: true,
                never_for_ai_authenticity: true,
            } : existingPending.data?.personal_voice_note_policy,
            synthetic_voice_note_forbidden: personalVoicePlan.syntheticVoiceForbidden || undefined,
            manual_native_voice_note_recommended: personalVoicePlan.manualNativeVoiceRecommended || undefined,
            manual_native_voice_note_reason: personalVoicePlan.manualNativeVoiceReason || undefined,
            manual_native_voice_note_script: personalVoicePlan.manualNativeVoiceScript || undefined,
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            ...buildDraftVideoAttachmentData(draft),
            ...buildDraftImageAttachmentData(draft),
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || 'standard',
            draft_max_chunks: draft.maxChunks || MAX_CHUNKS,
            drafted_at: new Date().toISOString(),
            coalesced_count: newCount,
            draft_error: draft.error || null,
            empty_draft_recovery: draft.emptyDraftRecovery || null,
            image_url_count: Math.max(0, Number(draft.urlCount || 0) - metaAdCardPhotoSuppression.suppressedCount),
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            audio_transcript_count: draft.audioTranscriptCount || existingPending.data?.audio_transcript_count || 0,
            video_url_count: draft.videoUrlCount || 0,
            video_inline_count: draft.videoCount || 0,
            media_decode: effectiveMediaDecode || existingPending.data?.media_decode || null,
            media_review: mediaReview.required ? mediaReview : null,
            context_review: contextReview.required ? contextReview : null,
            challenge_offer_warning: challengeOfferWarning,
            ...(leadOnboardingHandoffData || {}),
            first_captured_lead_reply: firstCapturedLeadReply || !!existingPending.data?.first_captured_lead_reply,
            // Refresh on every coalesce — `history` already includes every
            // unanswered inbound up to (but excluding) the current one, so
            // the saved streak grows naturally as messages roll in.
            recent_inbound_messages: effectiveDisplayRecentInboundMessages.map(m => ({
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
                prior_unanswered: effectiveDisplayRecentInboundMessages.map(m => ({
                    text: truncate(replaceIgMediaMarkers(m.text || ''), 280),
                    created_at: m.created_at,
                })),
                recent_workouts: truncate(recentWorkoutEvidence || '', 2000),
                recent_activity: truncate(weeklyAppContext || '', 3000),
                recent_timeline: truncateTail(effectiveTimeline, 4000),
                story_context: truncate(String(draft.storyReplyPromptContextBlock || '').trim(), 1400),
                native_story_context: truncate(String(draft.nativeStoryOutreachContextBlock || '').trim(), 1400),
                native_story_confusion_repair: truncate(String(draft.nativeStoryConfusionRepairBlock || '').trim(), 1400),
                media_context: metaAdCardPhotoSuppression.suppressedCount > 0
                    ? ''
                    : truncate(String(draft.mediaContextPromptBlock || '').trim(), 1800),
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
        const audioTranscriptReviewContext = buildAudioTranscriptReviewContext(draft.mediaDecode, leadName);
        const mediaSummaryReviewContext = draft.mediaSummary
            ? `\nDecoded media summary: ${truncate(draft.mediaSummary, 900)} (private evidence, not the lead's typed words)`
            : '';
        const learningReelReviewText = draft.learningReelEvidenceBlock || learningReelEvidenceBlock || draft.learningReelContextBlock || '';
        const learningReelReviewContext = learningReelReviewText
            ? `\nRecent sent learning reel context:\n${truncate(learningReelReviewText, 1800)}`
            : '';
        const reviewContextBlocks = `LATEST just-arrived ${channelLabel} message from ${leadName} (this is the message the draft must answer): "${reviewLatestForPrompt}"${mediaSummaryReviewContext}${audioTranscriptReviewContext}${priorText}${timelineText}${workoutText}${memoryText}${crossChannelText}${learningReelReviewContext}`;
        const reviewTimeoutMs = cocosAutoSendLane ? COCOS_DRAFT_REVIEW_TIMEOUT_MS : IG_DRAFT_REVIEW_TIMEOUT_MS;
        const approvedDeterministicReview = buildApprovedDeterministicMetaAdFirstReplyReview({
            metaAdFirstInbound: metaAdOpeningTurn,
            metaAdGoalReplyTurn,
            metaAdConversationFastLane,
            draft,
            approval: metaAdFirstReplyApproval,
            linkedUserId: thread.linked_user_id,
            mediaReview,
            contextReview,
            currentMessage: currentInboundTurnMessage,
            qualifier,
            history: displayHistory,
        });
        const paidMetaFastContractIssues = metaAdConversationFastLane
            ? collectPaidMetaWriterContractIssues({
                draft,
                currentMessage: currentInboundTurnMessage,
                qualifier,
                history: displayHistory,
                flowVariant: metaAdFlowVariant,
            })
            : [];
        const approvedPaidMetaFastReview = metaAdConversationFastLane
            && !thread.linked_user_id
            && !mediaReview?.required
            && !contextReview?.required
            && !getMetaAdSensitiveHoldReason({
                alertData: currentAlertData || {},
                currentMessage: currentInboundTurnMessage,
            })
            && !paidMetaFastContractIssues.some(isBlockingPaidMetaWriterContractIssue)
            && !hasFirstPersonHealthClaim(draft.joined)
            && !draftParrotsLatestInbound(draft.joined, displayMessage)
            ? {
                verdict: 'pass',
                confidence: 1,
                summary: 'Clean paid Meta text passed the local sales and safety contract.',
                issues: [],
                suggested_fix: '',
                context_loss_suspected: false,
                notification_required: false,
                notification_reason: null,
                reviewed_at: new Date().toISOString(),
                reviewer_model: 'deterministic-paid-meta-fast-contract-v1',
            }
            : null;
        const approvedFastReview = approvedDeterministicReview || approvedPaidMetaFastReview;
        if (approvedFastReview) {
            draftReview = approvedFastReview;
            effectiveContextReview = approvedFastReview.context_warning_overridden
                ? {
                    ...(contextReview || {}),
                    required: false,
                    original_reasons: contextReview?.reasons || [],
                    reasons: [],
                    resolved_by: 'deterministic_meta_ad_first_reply_approval',
                    resolved_at: new Date().toISOString(),
                }
                : contextReview;
            console.log(`[ig-draft] skipped serial model review for approved paid Meta reply ${alertId}`);
        } else try {
            const reviewResult = await withTimeout(reviewDraftAndUpdateAlert({
                alertId,
                draftText: draft.joined,
                alertType,
                contextBlocks: reviewContextBlocks,
                clientName: leadName,
                channelLabel,
                existingContextReview: contextReview,
                qualifier,
                linkedUserId: thread.linked_user_id,
                meaningfulLeadReplyCount,
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
        const effectiveOutboundVoiceMessage = !metaAdConversationFastLane
            && !personalVoicePlan.syntheticVoiceForbidden
            && (outboundVoiceMessage || !!existingPending?.data?.outbound_voice_message);
        const verifiedPaidMetaPreviewHandoff = paidMetaConversationApproval?.required === false
            && draft?.appPreviewHandoff === true
            && isMetaAppPreviewUrl(draft?.appPreviewUrl);
        const baseRepairIssues = verifiedPaidMetaPreviewHandoff ? [] : collectCocosAutoRepairIssues({
            draft,
            draftReview,
            challengeOfferWarning,
            currentMessage: displayMessage,
            qualifier,
            leadStage: effectiveLeadStage,
            linkedUserId: thread.linked_user_id,
            meaningfulLeadReplyCount,
            voiceNoteMode: effectiveOutboundVoiceMessage,
            metaAdConversationFastLane,
            flowVariant: metaAdFlowVariant,
        });
        const paidMetaWriterContractIssues = metaAdConversationFastLane
            ? collectPaidMetaWriterContractIssues({
                draft,
                currentMessage: currentInboundTurnMessage,
                qualifier,
                history: displayHistory,
                flowVariant: metaAdFlowVariant,
            })
            : [];
        const repairIssues = [...new Set([
            ...baseRepairIssues,
            ...paidMetaWriterContractIssues,
        ])];
        const autoDraftRepairField = cocosAutoSendLane ? 'cocos_auto_repair' : 'balance_auto_repair';
        const autoDraftRepairBusinessName = cocosAutoSendLane ? "Coco's PT Studio" : 'Balance';
        const originalStyleWarningDraft = draft.joined;
        const safeMetaAdStyleFallback = metaAdFastLane
            ? buildSafeMetaAdStyleFallback({
                draft,
                draftReview,
                currentMessage: displayMessage,
            })
            : null;
        if (safeMetaAdStyleFallback?.joined) {
            draft = safeMetaAdStyleFallback;
            currentAlertData = await persistCocosDraftRepair({
                alertId,
                currentAlertData: {
                    ...(currentAlertData || {}),
                    meta_ad_style_warning_safe_after_sanitize: true,
                },
                draft,
                repairMeta: {
                    status: 'accepted',
                    repaired_at: new Date().toISOString(),
                    strategy: 'deterministic_option_menu_cleanup',
                    original_draft_text: truncate(originalStyleWarningDraft, 1200),
                    reviewer_verdict: draftReview?.verdict || null,
                },
                challengeOfferWarning,
                repairField: 'meta_ad_style_sanitizer',
            });
            console.log(`[ig-draft] Meta ad style warning sanitized without another model round for alert ${alertId}`);
        }
        if (!safeMetaAdStyleFallback && shouldAttemptCocosDraftRepair({
            cocosAutoSendLane,
            balanceAutoSendLane: balanceLeadAutoSendLane,
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
                    currentMessage: displayMessage,
                    qualifier,
                    businessName: autoDraftRepairBusinessName,
                    paidMetaMode: metaAdConversationFastLane,
                }), COCOS_DRAFT_REPAIR_TIMEOUT_MS, `${autoDraftRepairBusinessName} draft repair`);
                if (repaired?.joined) {
                    const repairedPaidMetaContractIssues = metaAdConversationFastLane
                        ? collectPaidMetaWriterContractIssues({
                            draft: repaired,
                            currentMessage: currentInboundTurnMessage,
                            qualifier,
                            history: displayHistory,
                            flowVariant: metaAdFlowVariant,
                        })
                        : [];
                    const repairedReviewResult = await withTimeout(reviewDraftAndUpdateAlert({
                        alertId,
                        draftText: repaired.joined,
                        alertType,
                        contextBlocks: reviewContextBlocks,
                        clientName: leadName,
                        channelLabel,
                        existingContextReview: contextReview,
                        qualifier,
                        linkedUserId: thread.linked_user_id,
                        meaningfulLeadReplyCount,
                    }), IG_DRAFT_REVIEW_TIMEOUT_MS, 'Coco repaired draft review');
                    const repairedReview = repairedReviewResult?.review || null;
                    const earnedPaidMetaOfferRepair = metaAdConversationFastLane
                        && repairIssues.some(issue => /earned offer|complete offer|offer is now earned/i.test(String(issue || '')));
                    const acceptRepair = !!repairedReview
                        && isDraftReviewAutoSendSafe(repairedReview)
                        && !repairedPaidMetaContractIssues.some(isBlockingPaidMetaWriterContractIssue)
                        && (!effectiveOutboundVoiceMessage || inspectVoiceScriptQuality(repaired.joined).valid)
                        && !hasFirstPersonHealthClaim(repaired.joined)
                        && !draftParrotsLatestInbound(repaired.joined, displayMessage)
                        && (!repairRequiresQuestionFreeReply(repairIssues)
                            || repaired.chunks.every(chunk => !isQuestionLikeText(chunk)))
                        && (earnedPaidMetaOfferRepair || !isUnrequestedOfferInjection({
                            originalDraft: originalDraftText,
                            repairedDraft: repaired.joined,
                            currentMessage: displayMessage,
                            qualifier,
                        }));
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
                            repairField: autoDraftRepairField,
                        });
                        console.log(`[ig-draft] ${autoDraftRepairBusinessName} auto draft repaired and rechecked for alert ${alertId}: ${draftReview.verdict}`);
                    } else {
                        currentAlertData = await persistCocosDraftRepair({
                            alertId,
                            currentAlertData: {
                                ...(currentAlertData || {}),
                                [autoDraftRepairField]: {
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
                            repairField: autoDraftRepairField,
                        });
                    }
                }
            } catch (err) {
                console.warn(`[ig-draft] ${autoDraftRepairBusinessName} draft repair failed:`, err.message);
                currentAlertData = await persistCocosDraftRepair({
                    alertId,
                    currentAlertData: {
                        ...(currentAlertData || {}),
                        [autoDraftRepairField]: {
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
                    repairField: autoDraftRepairField,
                });
            }
        }
        if (metaAdConversationFastLane
            && !effectiveContextReview?.required
            && isNonBlockingDraftStyleWarning(draftReview)) {
            const warningBeforeRelease = draftReview;
            const nonBlockingFallback = buildPaidMetaNonBlockingReviewFallback({
                draft,
                draftReview,
                currentMessage: currentInboundTurnMessage,
                qualifier,
                history: displayHistory,
                flowVariant: metaAdFlowVariant,
                checkoutUrl: metaAdCheckoutUrl,
                appPreviewUrl: buildMetaAppPreviewUrl(thread.id, { flowVariant: metaAdFlowVariant }),
            });
            if (nonBlockingFallback?.joined) {
                const releasedAt = new Date().toISOString();
                draft = nonBlockingFallback;
                draftReview = {
                    verdict: 'pass',
                    confidence: 1,
                    summary: 'A non-blocking paid Meta wording warning was released through the verified stage fallback.',
                    issues: [],
                    suggested_fix: '',
                    notification_required: false,
                    notification_reason: null,
                    context_loss_suspected: false,
                    reviewed_at: releasedAt,
                    reviewer_model: 'deterministic-paid-meta-nonblocking-release-v1',
                };
                currentAlertData = await persistCocosDraftRepair({
                    alertId,
                    currentAlertData: {
                        ...(currentAlertData || {}),
                        draft_review: draftReview,
                        context_review: null,
                    },
                    draft,
                    repairMeta: {
                        status: 'accepted',
                        repaired_at: releasedAt,
                        strategy: 'paid_meta_nonblocking_review_release',
                        original_warning: warningBeforeRelease,
                    },
                    challengeOfferWarning,
                    repairField: 'paid_meta_nonblocking_review_release',
                });
            }
        }
        let unresolvedPaidMetaContractIssues = metaAdConversationFastLane
            ? collectPaidMetaWriterContractIssues({
                draft,
                currentMessage: currentInboundTurnMessage,
                qualifier,
                history: displayHistory,
                flowVariant: metaAdFlowVariant,
            })
            : [];
        let blockingPaidMetaContractIssues = unresolvedPaidMetaContractIssues.filter(isBlockingPaidMetaWriterContractIssue);
        if (blockingPaidMetaContractIssues.length > 0) {
            const guaranteedFallback = buildPaidMetaGuaranteedContractFallback({
                draft,
                currentMessage: currentInboundTurnMessage,
                issues: blockingPaidMetaContractIssues,
                qualifier,
                history: displayHistory,
                flowVariant: metaAdFlowVariant,
            });
            if (guaranteedFallback?.joined) {
                draft = guaranteedFallback;
                unresolvedPaidMetaContractIssues = collectPaidMetaWriterContractIssues({
                    draft,
                    currentMessage: currentInboundTurnMessage,
                    qualifier,
                    history: displayHistory,
                    flowVariant: metaAdFlowVariant,
                });
                blockingPaidMetaContractIssues = unresolvedPaidMetaContractIssues.filter(isBlockingPaidMetaWriterContractIssue);
                if (blockingPaidMetaContractIssues.length === 0) {
                    const repairedAt = new Date().toISOString();
                    draftReview = {
                        verdict: 'pass',
                        confidence: 1,
                        summary: 'Paid Meta ordinary flow repaired to a guaranteed sendable guided reply.',
                        issues: [],
                        suggested_fix: '',
                        notification_required: false,
                        notification_reason: null,
                        context_loss_suspected: false,
                        reviewed_at: repairedAt,
                        reviewer_model: 'deterministic-paid-meta-guaranteed-send-v1',
                    };
                    effectiveContextReview = {
                        ...(effectiveContextReview || contextReview || {}),
                        required: false,
                        reasons: [],
                        resolved_by: 'paid_meta_guaranteed_contract_repair',
                        resolved_at: repairedAt,
                    };
                    currentAlertData = await persistCocosDraftRepair({
                        alertId,
                        currentAlertData: {
                            ...(currentAlertData || {}),
                            draft_review: draftReview,
                            context_review: null,
                        },
                        draft,
                        repairMeta: {
                            status: 'accepted',
                            repaired_at: repairedAt,
                            strategy: 'paid_meta_guaranteed_contract_repair',
                            remaining_non_blocking_issues: unresolvedPaidMetaContractIssues,
                        },
                        challengeOfferWarning,
                        repairField: 'paid_meta_guaranteed_send',
                    });
                }
            }
        }
        const nonBlockingPaidMetaContractIssues = unresolvedPaidMetaContractIssues
            .filter(issue => !isBlockingPaidMetaWriterContractIssue(issue));
        if (nonBlockingPaidMetaContractIssues.length > 0 && blockingPaidMetaContractIssues.length === 0) {
            currentAlertData = {
                ...(currentAlertData || {}),
                paid_meta_non_blocking_quality_notes: nonBlockingPaidMetaContractIssues,
            };
        }
        if (blockingPaidMetaContractIssues.length > 0) {
            const paidMetaContractSummary = `Paid Meta reply held: ${blockingPaidMetaContractIssues.join(' ')}`;
            draftReview = {
                ...(draftReview || {}),
                verdict: 'warn',
                confidence: 0,
                summary: paidMetaContractSummary,
                issues: blockingPaidMetaContractIssues,
                notification_required: true,
                notification_reason: 'paid_meta_writer_contract',
                context_loss_suspected: true,
                reviewed_at: new Date().toISOString(),
                reviewer_model: 'deterministic-paid-meta-writer-contract-v1',
            };
            effectiveContextReview = {
                ...(effectiveContextReview || contextReview || {}),
                required: true,
                reasons: [
                    ...new Set([
                        ...((Array.isArray(effectiveContextReview?.reasons)
                            ? effectiveContextReview.reasons
                            : [effectiveContextReview?.reason]).filter(Boolean).map(String)),
                        'paid_meta_writer_contract',
                    ]),
                ],
                label: paidMetaContractSummary,
                warning: paidMetaContractSummary,
                draft_review_verdict: 'warn',
                draft_review_summary: paidMetaContractSummary,
            };
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

    // Verified current Meta ad openings and clear exercise conversations use the AI coach fast lane.
    // They still require a clean reviewer pass or a narrow deterministic cleanup of a
    // non-blocking style warning. Other leads stay pending for manager review;
    // linked clients stay approval-only.
    let autoHandled = false;
    const blockedStage = ['churned'].includes(effectiveLeadStage);
    const balanceAutoSendLane = balanceLeadAutoSendLane;
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
            alertData: currentAlertData,
            allowTestLaneDraftReviewWarning: voiceReplyTestLane,
            allowBalanceLeadDraftReviewWarning: false,
        })
        : null;
    if (!autoHoldReason) {
        autoHoldReason = getCocosCodexReviewHold({
            cocosAutoSendLane,
            voiceReplyTestLane,
            approvedCoachingLinkHandoff,
            metaAdFastLane,
        });
    }
    if (!autoHoldReason && autoSendEnabled && blockedStage) {
        autoHoldReason = {
            code: 'blocked_stage',
            label: 'lead is churned',
        };
    }
    if (!autoHoldReason && autoSendEnabled && permanentNeedsYouClient) {
        autoHoldReason = {
            code: 'always_needs_you_person',
            label: 'permanent Needs You client',
        };
    }
    if (!autoHoldReason && autoSendEnabled
        && personalVoicePlan.manualNativeVoiceReason === 'inbound_voice_requires_manual_route') {
        autoHoldReason = {
            code: 'voice_reply_route_unavailable',
            label: 'voice reply needs a native Instagram send',
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

    let codexLiveWakeReady = false;
    if (codexLivePaidMetaThread && alertId && draft.joined) {
        const requestedAt = new Date().toISOString();
        const existingLiveActionId = currentAlertData?.codex_live_chat_action_id || null;
        const existingLiveOwner = currentAlertData?.codex_live_chat_action_owner || null;
        const existingLiveStatus = String(currentAlertData?.codex_live_chat_status || '');
        const existingLiveRoute = !!existingLiveActionId
            && existingLiveOwner === 'codex_live_worker'
            && ['waiting_for_local_worker', 'active', 'sending_settled_batch'].includes(existingLiveStatus);
        const liveData = {
            ...(currentAlertData || {}),
            codex_live_chat_required: true,
            codex_live_chat_status: existingLiveRoute ? existingLiveStatus : 'waiting_for_local_worker',
            codex_live_chat_requested_at: requestedAt,
            codex_live_chat_ig_thread_id: thread.id,
            codex_live_chat_source_message_id: manychatMessageId || null,
            codex_live_chat_fallback: 'balance_lead_client_dm_manager',
        };
        try {
            const rows = await supabaseQuery(
                `coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`,
                {
                    method: 'PATCH',
                    body: { data: liveData },
                    prefer: 'return=representation',
                }
            );
            if (rows?.[0]) {
                currentAlertData = rows[0].data || liveData;
                if (existingLiveRoute) {
                    codexLiveWakeReady = true;
                    console.log(`[ig-draft] refreshed active live-worker batch for paid-Meta thread ${thread.id}, alert ${alertId}`);
                } else {
                    const routedRows = await supabaseQuery('rpc/route_paid_meta_live_codex_action', {
                        method: 'POST',
                        body: { p_thread_id: thread.id, p_alert_id: alertId },
                    });
                    const routedAction = Array.isArray(routedRows) ? routedRows[0] : routedRows;
                    if (!routedAction?.id) {
                        throw new Error('live Codex controller action was already claimed or unavailable');
                    }
                    codexLiveWakeReady = true;
                    const routedData = {
                        ...currentAlertData,
                        codex_live_chat_action_id: routedAction.id,
                        codex_live_chat_action_version: routedAction.action_version ?? null,
                        codex_live_chat_action_owner: routedAction.owner,
                    };
                    const routedAlertRows = await supabaseQuery(
                        `coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`,
                        { method: 'PATCH', body: { data: routedData }, prefer: 'return=representation' }
                    );
                    currentAlertData = routedAlertRows?.[0]?.data || routedData;
                    console.log(`[ig-draft] exclusively routed live Codex wake for paid-Meta thread ${thread.id}, alert ${alertId}`);
                }
            }
        } catch (error) {
            console.warn(`[ig-draft] live Codex wake stamp failed for ${alertId}; preserving immediate sender fallback:`, error.message);
            currentAlertData = {
                ...(currentAlertData || {}),
                codex_live_chat_required: false,
                codex_live_chat_status: 'controller_route_failed_manager_fallback',
                codex_live_chat_error: truncate(error.message || String(error), 260),
            };
            try {
                await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`, {
                    method: 'PATCH',
                    body: { data: currentAlertData },
                });
            } catch (stampError) {
                console.warn(`[ig-draft] live Codex fallback stamp failed for ${alertId}:`, stampError.message);
            }
        }
    }

    const igAutoSendAllowedForDelay = autoSendEnabled
        && !isDirectGraphManual
        && !autoHoldReason
        && !blockedStage
        && !codexLiveWakeReady
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
            const immediateDispatchFailed = hasImmediateMetaDispatchFailure(scheduleResult);
            if (immediateDispatchFailed) {
                autoHoldReason = {
                    code: 'immediate_dispatch_failed',
                    label: 'immediate Meta reply failed to send',
                };
                currentAlertData = await stampIgAutoSendHoldForReview({
                    thread,
                    alertId,
                    alertData: currentAlertData,
                    reason: autoHoldReason,
                }) || currentAlertData;
                console.warn(`[ig-draft] immediate Meta ad dispatch failed for ${alertId}; falling back to approve-gate`);
            } else {
                autoHandled = true;
            }
            if (scheduleResult.immediateDispatch?.ok) {
                console.log(`[ig-draft] immediately dispatched clean Meta ad alert ${alertId} for ${leadName}`);
            } else if (scheduleResult.alreadyActioned) {
                console.log(`[ig-draft] auto alert ${alertId} already actioned before direct schedule`);
            } else if (!immediateDispatchFailed) {
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

    stopPaidMetaTypingHeartbeat();
    if (!autoHandled && balanceLeadAutoSendLane && !cocosAutoSendLane) {
        console.log(`[ig-draft] Balance AI coach did not auto-schedule thread ${thread.id}; preserving its explicit hold for review`);
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
    generateDraft,
    isIgStoryReplyContextText,
    sanitizeIgStoryReplyContextText,
    stripObviousMediaReceiptPreamble,
    buildNativeStoryOutreachContextBlock,
    detectConversationEpisode,
    buildConversationEpisodeTimeline,
    isSalesAcquisitionThread,
    buildAcquisitionStyleBlock,
    buildAcquisitionMomentumBlock,
    buildConversationLanePolicyBlock,
    buildPaidMetaConversationWriterBlock,
    buildPaidMetaAgentPrompt,
    buildPaidMetaTurnDirective,
    collectPaidMetaWriterContractIssues,
    isBlockingPaidMetaWriterContractIssue,
    buildPaidMetaGuaranteedContractFallback,
    buildPaidMetaNonBlockingReviewFallback,
    buildLowContentStoryAcknowledgement,
    buildLowContentStoryReplyPolicyBlock,
    suppressAlreadyKnownContextQuestionsInDraftChunks,
    suppressPetSpeciesGuessingInDraftChunks,
    suppressStoryLocationQuestionsInDraftChunks,
    hasKnownStoryLocationContext,
    isBareStoryMentionNotificationText,
    isLowContentIgStoryReply,
    isQuestionLikeText,
    suppressBareStoryMentionClarifierInDraftChunks,
    getCocosAutoContextBypass,
    getBalanceAutoContextBypass,
    getAutoDmHoldReason,
    isPaidMetaBuyerIntentOfferReplyAllowed,
    isContextualMetaAdOfferLinkRequest,
    buildContextualMetaAdOfferLinkReply,
    buildDeterministicPaidMetaConversationReply,
    isExplicitPaidMetaProofVideoRetry,
    buildPaidMetaProofVideoRetryReply,
    shouldApplyDeterministicPaidMetaReplyOverride,
    shouldUseOutboundSyntheticVoice,
    restoreCoalescedPaidMetaVoiceDraft,
    removePaidMetaBlockerVoiceGreeting,
    buildPaidMetaConversationApproval,
    hasDirectPaidMetaCheckoutIntent,
    buildDraftVideoAttachmentData,
    buildDraftImageAttachmentData,
    attachPaidMetaWriterSelectedMedia,
    ensurePaidMetaAppVideoPreviewCta,
    ensureMetaAdSalesProgressionQuestion,
    resolveMetaAdEarlyTypingDelayMs,
    resolveRecentVoiceSince,
    getCocosCodexReviewHold,
    isBalanceLeadAutoSendEnabled,
    isCanceledLatestRecoveryCandidate,
    classifySourceMessageFreshness,
    isCurrentMetaAdInbound,
    isMetaAdFastLaneEligible,
    isMetaAdConversationFastLaneEligible,
    isInternalMetaAdConversationTestLane,
    isInternalMetaAdConversationOpeningTurn,
    buildInternalMetaAdTestResetCustomData,
    resolveInternalTestConversationResetAt,
    resolveInternalTestVoiceCooldownResetAt,
    buildCurrentInboundTurnText,
    buildInternalTestQualifierThread,
    filterInternalTestHistoryAfterReset,
    isExerciseConversationFastLaneEligible,
    resolveMetaAdFlowVariant,
    resolveMetaAdFirstReplyIntent,
    isMetaAdGoalReplyTurn,
    buildMetaAdGoalProofReply,
    applyMetaAdGoalProofReply,
    shouldUseDeterministicMetaAdFirstReply,
    getMetaAdSensitiveHoldReason,
    buildMetaAdCheckoutUrl,
    buildMetaAdFoundersPassFirstReply,
    buildMetaAdFirstReplyApproval,
    buildApprovedMetaAdFirstReplyHandoffData,
    shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression,
    buildApprovedDeterministicMetaAdFirstReplyReview,
    filterMetaAdCardAttachmentHistory,
    isMetaAdCardAttachmentTransportArtifact,
    suppressUnresolvedMetaAdCardPhoto,
    collectCocosAutoRepairIssues,
    shouldAttemptCocosDraftRepair,
    repairCocosDraftFromReview,
    repairRequiresQuestionFreeReply,
    hasFirstPersonHealthClaim,
    normalizeCocosRepairedDraft,
    normalizeQuestionFreeRepairedDraft,
    buildSafeMetaAdStyleFallback,
    draftParrotsLatestInbound,
    reviewLooksLikePureContextGap,
    isSignupLinkHandoffText,
    isBalanceCallBookingLinkText,
    isExplicitCallBookingRequest,
    buildLeadOnboardingHandoffData,
    finalizeDraftChunksFromRawText,
    extractMediaSummaryFromDraftRawText,
    repairMissingChallengeBioLinkChunks,
    suppressExistingClientSignupLinkHandoffInDraftChunks,
    isExistingClientThread,
    buildChallengeNextStepBlock,
    buildCommentResourceContextFromFulfillment,
    buildCommentResourceHandoffBlock,
    buildEmptyMediaDraftFallbackChunks,
    buildAudioTranscriptReviewContext,
    transcriptTextFromMediaDecode,
    hasAudioTranscriptDraftContext,
    isAudioPuntDraftText,
    isAudioPuntDraftChunks,
    buildCurrentTurnAnchorBlock,
    isStoryOpenerConfusionMessage,
    buildNativeStoryConfusionRepairBlock,
    normalizeIgAutoTimingSuggestion,
    shouldDispatchMetaAdReplyImmediately,
    isCodexLivePaidMetaThread,
    hasImmediateMetaDispatchFailure,
    resolveIgFastLaneDelayMs,
    isCocosToShanSunnyVoiceTest,
    buildPersonalVoiceNoteDraftingBlock,
    hasInboundVoiceNoteInUnansweredBatch,
};
