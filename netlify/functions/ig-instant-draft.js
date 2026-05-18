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
    cancelPriorScheduledForIgThread,
    selectRecentInboundSinceLastReplyIg,
    resolveLifecycleStage,
    lifecycleForFcmData,
    fireDraftReasoning,
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
    buildShannonDmTuningBlock,
    loadEditExamples,
    loadResponseTimingProfile,
    buildReplyTimingSuggestion,
    loadOnboardingPhase,
    loadRecentWorkouts,
    formatRecentWorkoutEvidence,
    loadWeeklyAppContext,
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
} = require('./_lib/qualifier-engine');
const {
    detectProposedCoachActions,
    mergeProposedActions,
} = require('./_lib/coach-actions');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const HISTORY_LIMIT = 40;
const MAX_CHUNKS = 3;
const DEEP_REPLY_MAX_CHUNKS = 10;
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
        candidates.push(subscriberId.slice(GRAPH_SUBSCRIBER_PREFIX.length));
    }
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function resolveThreadGraphAccountId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return String(
        graph.ig_account_id
        || graph.account_id
        || customData.ig_graph_account_id
        || customData.ig_account_id
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
        ? Math.min(IG_AUTO_SEND_MAX_DELAY_MS, Math.max(0, Math.round(rawDelay)))
        : IG_AUTO_SEND_DEFAULT_DELAY_MS;
    const action = timingSuggestion?.action === 'send_now' || normalizedDelayMs === 0
        ? 'send_now'
        : 'schedule';
    return {
        action,
        delay_ms: normalizedDelayMs,
        preset_value: String(timingSuggestion?.preset_value || '').slice(0, 40),
        label: String(timingSuggestion?.label || timingLabel || formatAutoDelayLabel(normalizedDelayMs)).slice(0, 40),
        reason: String(timingSuggestion?.reason || 'auto DM contextual timing').slice(0, 240),
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

function getAutoDmHoldReason({ mediaReview, contextReview, onboardingPhase, draft, draftReview }) {
    if (mediaReview?.required) {
        return {
            code: 'media_review',
            label: `${mediaReview.label || 'Media'} needs Shannon review`,
        };
    }
    if (contextReview?.required) {
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
    if (isUnsafeStockDiscoveryQuestion(draft.joined)) {
        return {
            code: 'stock_question',
            label: 'stock discovery question needs Shannon review',
        };
    }
    if (draftReview && !isDraftReviewAutoSendSafe(draftReview)) {
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

/**
 * Funnel context for leads coming through Shannon's Meta (IG/FB) ads. The ad
 * opens a Click-to-Messenger / Click-to-IG conversation with three quick-reply
 * prompts they can tap, OR they may DM organically asking about the challenge.
 * Either way, the AI needs to recognise challenge intent and mirror Shannon's
 * actual qualifier flow.
 *
 * Update this block when the ad's quick-replies or offering structure changes.
 */
const META_AD_FUNNEL_CONTEXT = `
LEAD ACQUISITION CONTEXT:
Shannon finds leads by browsing Instagram/Facebook stories, reels, and posts, then DMs them first. He initiates the conversation. Some leads also come from Shannon's Meta ad for his 30-day plant-based wellness challenge (the ad opens the DM with quick-reply buttons). Either way, the words below trigger challenge-inquiry mode:
  1. "What's actually included?"
  2. "Do I need to already be Plant Based?"
  3. "I'm In - save me a spot!"
Also treat as challenge inquiry: any mention of "the challenge", "your program", "your thing", "saw your ad", "wanna join", "interested in".

Important: when there is no prior tracked conversation, do NOT assume the lead started the DM. Most first captured lead messages happen because Shannon commented on or replied to their story/post natively, and that opener is not visible in ManyChat. Their reply may be tiny or ambiguous because they are answering that unseen opener. Treat it as an open door, build rapport from whatever signal exists, and ask one light human question unless they are clearly asking about the challenge or link.

THE OFFERING (for context — never list as a brochure; speak like a friend):
- The FIRST offer is a free 30-day challenge, not a standalone custom meal plan or workout program.
- If they are plant-based / vegan / vegetarian-curious, route them to the plant-based challenge.
- If they just want fitness, muscle, weight loss, energy, or consistency with no plant-based signal, route them to the generic transformation challenge.
- Once they join, the Balance app tailors their workout program and meal plan. Shannon can edit it if needed after they sign up.
- Shannon checks in Monday, Wednesday, Friday. Friday is a weekly review and adjustment check-in.
- Keep it free/no pressure. The paid coaching pitch comes later, after the challenge has built trust.

RESPONSE PATTERNS (mimic Shannon's actual voice for each prompt):
- "What's actually included?" -> explain the free challenge casually: app sets up workouts/meals, Shannon checks in Mon/Wed/Fri, he can tweak the plan if needed. Don't dump a brochure.
- "Do I need to already be Plant Based?" -> warm reassurance ("not at all, lots of my crew start curious"), then ask their current eating situation, ever cooked plant-based before.
- "I'm In - save me a spot!" / "let's do it" / "keen" -> if they have already shared enough context or clearly accepted, send the relevant challenge link and explain the next step. Do NOT ask a Name + Age + Main goal intake bundle.

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
        return "EARLY in this DM thread. If there are no visible prior messages, assume Shannon's native story/post opener is missing from ManyChat and this is the lead's first captured reply. Just chat. A short reaction is fine. Ask one light follow-up only if their words give you a clear opening. Prefer light human context before fitness goals, but do not force it. DO NOT pitch the app, the challenge, or anything else yet.";
    }
    switch (stage) {
        case 'qualifying':
            return "Conversation is warming up. Stay in the topic and keep rapport natural before coaching discovery. Ask one useful follow-up only when it feels like normal texting. If the current message is simple banter, just banter. Only mention the free challenge when they ask how to start, ask for help, or there is a very clear opening. Do not offer to write a standalone meal plan or workout program in DMs. The app tailors those after they join the challenge.";
        case 'invited':
            return "You've already mentioned the challenge or app. DON'T re-pitch. Answer their questions plainly. If they're close to signing up, help them across the line. If they are not ready yet, ask one useful question only if it helps the next step.";
        case 'in_app':
            return "They're already in the app. Coach them like a normal client. The IG thread is just a parallel channel — same voice, same memory. Keep it short unless they ask for more. Ask a specific question only when it is actually useful.";
        case 'churned':
            return "They went cold or opted out earlier. Respect the no. Be friendly, no pitch, no follow-up bait.";
        case 'new':
        default:
            return "EARLY in this DM thread. Just chat. Ask one genuine follow-up question that builds on what they said. DO NOT pitch the app, the challenge, or anything else yet — they're a stranger.";
    }
}

function challengeUrlForRoute(route) {
    return route === 'vegan'
        ? 'https://plantbased-balance.org/vegan-challenge.html'
        : 'https://plantbased-balance.org/transform-challenge.html';
}

function buildChallengeNextStepBlock(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return '';
    const url = challengeUrlForRoute(qualifier.challenge_route || 'generic');
    if (qualifier.stage === 'won') {
        return `

CHALLENGE ACCEPTED NEXT STEP:
They have accepted the free 30-day challenge. Do NOT ask more qualifier/intake questions in this reply.
Your reply should:
- Send this link: ${url}
- Say the next free challenge starts Monday, but do not invent a date.
- Explain simply that the app will tailor their workout program and meal plan.
- Mention Shannon can edit/tweak the plan if needed after they sign up.
- Mention Shannon checks in Mon/Wed/Fri, and Friday is the weekly review/check-in.
- Keep it casual and direct, one clear CTA to jump on the link.
Do not offer to manually write a meal plan or workout program in DMs before signup.`;
    }
    if (qualifier.stage === 'pitched') {
        return `

CHALLENGE PITCHED:
The free 30-day challenge has already been offered. If they sound keen or ask how to start, send this link: ${url}. If they are still unsure, answer the concern and keep it easy.`;
    }
    return '';
}

function replaceIgMediaMarkers(text, { photo = '📷 photo', audio = '🎙️ voice note', video = '🎥 video' } = {}) {
    return replaceVideoMarkers(
        replaceAudioMarkers(
            replacePhotoMarkers(String(text || ''), () => photo),
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

This is Shannon's story/post context, not ${leadName || 'the lead'}'s own message. Use it only to understand what they replied to. Do not write as if ${leadName || 'the lead'} logged, ate, posted, or said those story details unless their actual reply says so.`;
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
            chunkRange: '4-10',
            chunkExample: '{"messages": ["chunk 1", "chunk 2", "chunk 3", "chunk 4", "chunk 5 (if needed)", "chunk 6 (if needed)", "chunk 7 (if needed)", "chunk 8 (if needed)", "chunk 9 (if needed)", "chunk 10 (if needed)"]}',
            chunkRule: '4 to 10 chunks. Use enough separate bubbles to cover every important point in order without becoming one wall of text.',
            lengthRule: 'Aim for 1800-3600 characters total for long multi-message batches. Go longer if that is what it takes to answer every meaningful question or share.',
            styleRule: 'Detailed support chunks: each message 1-3 sentences max, lowercase-friendly, Australian casual.',
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
            styleRule: 'Quick chunks: direct, helpful, lowercase-friendly, Australian casual.',
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
                styleRule: 'Short chunks: direct, warm, lowercase-friendly, Australian casual.',
                extraBlock: `

ONGOING CLIENT RAPPORT MODE:
They are past signup/onboarding. Treat this as Shannon getting to know an active challenge or app client, not as a setup flow.
- No intake bundle, no challenge pitch, no "are you ready to start?" framing.
- Do not ask a question every reply. For friendly banter, story replies, pets, travel, birthdays, movies, food photos, or quick updates, a short reaction is often better.
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
            styleRule: 'Tight chunks: each message 1-2 sentences max, lowercase-friendly, Australian casual.',
            extraBlock: '',
        };
    }

    return {
        name: 'deep',
        maxChunks: DEEP_REPLY_MAX_CHUNKS,
        maxOutputTokens: DEEP_REPLY_MAX_OUTPUT_TOKENS,
        intro: 'Draft a thoughtful',
        chunkRange: '4-10',
        chunkExample: '{"messages": ["chunk 1", "chunk 2", "chunk 3", "chunk 4", "chunk 5 (if needed)", "chunk 6 (if needed)", "chunk 7 (if needed)", "chunk 8 (if needed)", "chunk 9 (if needed)", "chunk 10 (if needed)"]}',
        chunkRule: '4 to 10 chunks. Use enough separate bubbles to answer the whole message without becoming one wall of text.',
        lengthRule: 'Aim for 1400-2800 characters total when the inbound is long, emotional, or multi-topic. Go longer if several long messages need separate answers.',
        styleRule: 'Thoughtful chunks: each message 1-3 sentences max, lowercase-friendly, Australian casual.',
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

async function generateDraft({ leadName, leadBlock, profileBlock, memoryBlock, history, currentMessage, recentInboundMessages = [], leadStage, channel, igThreadId, linkedUserId, priorScheduledDrafts, linkedNudges, recentWorkoutEvidence, weeklyAppContext, onboardingPhase, qualifier, qualifierQuestion }) {
    // Scope edits to THIS conversation first. Pulls per-IG-thread edits
    // (and per-app-user when a converted lead has been linked) so the AI
    // picks up the specific voice Shannon uses with this person. General
    // edits fill remaining slots when person-specific is sparse.
    const editExamples = await loadEditExamples({
        igThreadId,
        clientId: linkedUserId,
    });
    const coachBio = buildCoachBioBlock();
    const appNavigationGuide = buildAppNavigationGuideBlock();
    const appXpGuide = buildAppXpGuideBlock();
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();
    const shannonDmTuning = buildShannonDmTuningBlock();

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
    } = await buildMessageMediaBatchParts(mediaSourceMessages);
    const rewrittenPriorMessages = rewrittenMessages.slice(0, sanitizedPriorInboundMessages.length);
    const rewrittenMessage = rewrittenMessages[rewrittenMessages.length - 1] || promptCurrentMessage;
    // Detect when the message had photo URLs but the fetch failed (Meta CDN
    // rejected us, signed URL expired, image too large, etc). In that case
    // imageParts is empty even though the original message had `[PHOTO:url]`
    // markers — the AI should still know a photo came in so it can reply
    // naturally ("can you re-send that, didn't open for me") instead of
    // producing a confused or empty draft.
    const hadPhotoUrls = mediaSourceMessages.some(m => /\[PHOTO:https?:\/\//i.test(String(m || '')));
    const hadAudioUrls = mediaSourceMessages.some(m => /\[AUDIO:https?:\/\//i.test(String(m || '')));
    const hadVideoUrls = mediaSourceMessages.some(m => extractVideoUrls(m).length > 0);
    const photoFetchFailed = hadPhotoUrls && imageParts.length === 0;
    const audioFetchFailed = hadAudioUrls && audioParts.length === 0;
    const videoFetchFailed = hadVideoUrls && videoParts.length === 0;
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
    };
    const currentMessageText = mediaFailureNotes.length
        ? rewrittenMessage + ` (NOTE: ${mediaFailureNotes.join('. ')}. Don't pretend you saw or heard it.)`
        : rewrittenMessage;
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
    const isOnboardedOrPostFunnel = ['in_app', 'paying', 'churned'].includes(leadStage)
        || !!linkedUserId;
    const funnelContext = isOnboardedOrPostFunnel ? '' : META_AD_FUNNEL_CONTEXT;
    const challengeNextStepBlock = buildChallengeNextStepBlock(qualifier);
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
- If they clearly ask about the challenge, what is included, plant-based stuff, or a signup link, answer that directly and keep it casual.
- No coaching intake, no pitch, no name/age/goal bundle on this first captured reply.` : '';

    const mediaInstruction = [
        imageParts.length
            ? `(${imageParts.length} photo${imageParts.length === 1 ? '' : 's'} from the unanswered batch attached below, look at ${imageParts.length === 1 ? 'it' : 'them'} and let what you see shape your reply. Match the numbered photo references in the batch above. If it's food, react to what you see. If it's a body/progress shot, give specific feedback. If it's something casual or funny, react naturally, don't pretend you can't see it.)`
            : '',
        audioParts.length
            ? `(${audioParts.length} voice note${audioParts.length === 1 ? '' : 's'} from the unanswered batch attached below, listen to ${audioParts.length === 1 ? 'it' : 'them'} and respond to what they actually said. Match the numbered voice-note references in the batch above. Treat it like a normal DM, not a transcription task.)`
            : '',
        videoParts.length
            ? `(${videoParts.length} video${videoParts.length === 1 ? '' : 's'} from the unanswered batch attached below, watch/listen to ${videoParts.length === 1 ? 'it' : 'them'} and let what actually happens in the clip shape your reply. Match the numbered video references in the batch above. If the clip is just casual context, react naturally. Do not over-explain that you watched it.)`
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
${firstCapturedLeadReplyBlock}
${replyMode.extraBlock}
${currentTurnAnchorBlock}

CONVERSATION RESPONSIBILITY:
- Treat the new message as an answer to Shannon's latest question when that is obvious. Continue that thread before changing topic.
- Older messages are not automatically unresolved. Respond to previous statements only when they are still carrying the real ask, emotion, risk, or useful context. Otherwise let them drop.
- If the newest message is light media/banter attached to a heavier earlier message, decide whether the media is just a softener before writing. Do not let a puppy photo or quick joke erase a vulnerable disclosure or practical request.
- If they ask what Shannon is doing, how his morning is going, or what is on his agenda, first check whether Shannon already answered that exact personal question in the recent timeline. Do not repeat the same rain/walk/work/training detail as if it just happened again. Give a tiny fresh update, acknowledge that he is still on that thing, or turn the spotlight back to them.
- Do not open with "morning", "afternoon", or "evening" when this is already an active same-day thread or Shannon already greeted them recently.
- If they admit they have been "slacking", off track, missed training, or had a rough week, don't reply with filler like "ahh yeah man" on its own, don't ask "wby"/"what about you", and don't repeat the same broad question. Validate lightly, then ask one concrete follow-up about what got in the way or what small session they can lock in next.
- The funnel should feel invisible. It can take hours or months. One smooth human question beats a forced qualifier or pitch.
- Do not default to a question. Use a question only when it is the most natural next text. If they are bantering, answering a previous question, or sending a quick update, a short reaction can be the whole reply.
- When they send rich personal detail, the natural question often belongs inside the paragraph that reflects that exact detail, not as a final closer. Example shape: "that makes sense, getting lost in cooking would be so therapeutic. do you have a number 1 thing you love making?" then keep responding to the other things they shared or answer what they asked Shannon.
- Keep the spotlight on them unless they directly ask about Shannon.

GROUNDING AND TIMELINE RULES:
- Specific claims must be traceable to the data below: their message, conversation history, client memory, cross-channel notes, or exact app workout logs.
- Only mention exact weights, reps, exercise names, dates, injuries, goals, events, or personal facts when they appear in those sources.
- If the app logs do not show a weight or exercise, keep the workout reference general. Do not invent numbers like "5kg weights".
- Equipment access is not workout performance. If memory says they own equipment but logs/messages do not say they used it, phrase it as available equipment, not something they did.
- Read timestamps. If history shows an event already happened, do not ask when it is. Ask how it went, react to what they sent, or ask what the photo/object is.
- If Shannon already said "happy birthday", "how did the big day go", "how was the party", or similar, treat the party/event as past unless the client clearly introduces a different future event.

ACTION CLAIMS:
- You are only drafting text. Do not claim Shannon has updated, moved, fixed, re-linked, checked, created, sent, or changed anything unless the conversation or app data below shows that action already happened.
- Never write a sequence like "I'll do that now" and then "done" / "just finished" in the same draft. That is fake and unnatural.
- If the client asks Shannon to change something, either tell them where they can do it in the app, or say Shannon can sort it / will have a look. Do not claim completion.
- If they report a weird food/meal name from the app, correct obvious voice-to-text or typo errors using the conversation and app context instead of repeating the nonsense phrase as a real meal. Example: if the likely plan meal is "Berry Almond Baked Oats", do not call it "very almond mixed oats".
- If they report a calorie/logging discrepancy, acknowledge it as something Shannon should check. Do not promise to manually adjust or log anything unless the app data below proves it has already been done.

ACQUISITION STYLE:
- Human first, coach second. Before goals/blockers, learn one normal-life anchor when it fits: where they're based, kids/family, work/life rhythm, cooking situation, training background, why they replied, what they really love, or what genuinely ticks them off/stresses them.
- When you ask a question, it should help Shannon understand the person, not just move the funnel. But do not turn every reply into discovery. Normal back-and-forth is allowed.
- If they reveal something they love or something that annoys/stresses them, stay with that thread for a beat. Relate only if it is honest and light, then bring the spotlight back to them.
- A relationship question does not have to be the last bubble. If it is sparked by a specific thing they said, ask it while talking about that thing, then continue the reply.
- Do not bundle questions. Never ask name + age + goal + blocker together.
- If the discovery question is about relationship context, ask one light version and stop. Do not tack on a fitness goal in the same reply.
- If they are already asking how to join, accepted the challenge, or clearly want the link, move them forward instead of slowing them down with more questions.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}
${appNavigationGuide}
${appXpGuide}
${funnelContext}
${challengeNextStepBlock}
${unansweredBatchBlock}
${storyReplyPromptContextBlock}

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
This is guidance, not a command. If the latest message is banter, a story/post reply with missing context, a direct answer to Shannon's last question, or the reply would feel better without a question, skip it. If you do use it, ask only that one light question. When the reply has several things to answer, weave the question into the reflection that sparked it instead of defaulting to a standalone final bubble. Do not add a goal, age, blocker, or challenge pitch in the same reply.
If the question sounds generic or ignores a fresher detail from their latest message, rewrite it around that detail or skip the question. Never paste a stock line like "what does a normal day look like" into an auto-DM draft.
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
            'THEIR NEW MESSAGE:\n' + currentMessageText + ' (NOTE: attached media could not be decoded in this fallback. If the reply depends on it, casually ask them to resend it or type the gist. Do not pretend you saw or heard it.)'
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
                return { chunks: [], joined: '', model: 'none', error: lastError, imageCount: imageParts.length, audioCount: audioParts.length, videoCount: videoParts.length, mediaDecode, timeline: totalConversationText, currentTurnAnchorBlock, storyReplyPromptContextBlock };
            }
        }
    }

    const parsed = parseDraftChunks(rawText, replyMode.maxChunks);
    // Allow the one daily opener only on the first chunk; keep later chunks clean.
    const cleanedChunks = splitCoachDraftIntoDmBubbles(
        parsed.chunks.map((c, i) => i === 0 ? stripLeadingGreeting(c, leadName, { allowGreeting: allowDailyGreeting }) : stripLeadingGreeting(c, leadName)).filter(Boolean)
    );
    return {
        chunks: cleanedChunks,
        joined: cleanedChunks.join('\n'),
        model,
        replyMode: replyMode.name,
        maxChunks: replyMode.maxChunks,
        error: lastError,
        imageCount: imageParts.length,
        audioCount: audioParts.length,
        videoCount: videoParts.length,
        urlCount: photoUrlCount,
        audioUrlCount,
        videoUrlCount,
        mediaDecode,
        timeline: totalConversationText,
        currentTurnAnchorBlock,
        storyReplyPromptContextBlock,
    };
}

function _notifyQualifierAdvance({ priorStage, priorFacts, nextQualifier, leadName, channel, coachId }) {
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

async function sendDraftReadyPush({ adminId, alertId, leadName, leadMessage, draftText, clientId, channel, recentInboundMessages, qualifier, qualifierEligible, lifecycle, mediaReview, contextReview, autoHoldReason }) {
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
        const title = lifecycle?.dot ? `${lifecycle.dot} ${titleCore}` : titleCore;
        const mediaWarning = mediaReview?.required
            ? `Warning: ${mediaReview.label} sent. Check media before sending.`
            : '';
        const contextWarning = contextReview?.required
            ? 'Context check: tracked DM context may be incomplete. Open IG before sending.'
            : '';
        const autoHoldWarning = autoHoldReason
            ? `Auto held for review: ${autoHoldReason.label}. Auto mode stays on.`
            : '';
        const body = autoHoldWarning || mediaWarning || contextWarning || (hasDraft
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

async function sendContextCheckNotification({ adminId, alertId, leadName, clientId, channel, draftReview, contextReview }) {
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
                url: './admin-dashboard.html?tab=alerts',
            }),
        }).catch(e => console.warn('[ig-draft] context-check push failed:', e.message));
    } catch (err) {
        console.warn('[ig-draft] context-check push errored:', err.message);
    }
}

exports._test = {
    isIgStoryReplyContextText,
    sanitizeIgStoryReplyContextText,
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
            const canResumeAutoSchedule = !!thread.auto_send_enabled
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
            || thread.custom_data?.manual_ig_required === true
            || thread.custom_data?.instagram_graph?.source === 'instagram_graph'
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
                currentMessage: replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(messageText), { photo: '[photo]', audio: '[voice note]', video: '[video]' }),
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

    const draft = await generateDraft({
        leadName,
        leadBlock,
        profileBlock,
        memoryBlock,
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
    });

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
        first_captured_lead_reply: firstCapturedLeadReply,
        draft_evidence: {
            current_message: displayMessage,
            recent_timeline: draft.timeline || '',
            story_context: draft.storyReplyPromptContextBlock || '',
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
            profile_name: thread.profile_name || null,
            thread_display_name: threadDisplayName,
            linked_client_name: linkedClientName || null,
            display_name_source: linkedClientName ? 'linked_user' : 'ig_thread',
            lead_stage: effectiveLeadStage || thread.lead_stage || 'new',
            auto_send_enabled_at_draft: !!thread.auto_send_enabled,
            manychat_message_id: manychatMessageId || null,
            message_preview: truncate(displaySourceMessage, 400),
            last_outbound_message: lastOutboundMessage,
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
            image_url_count: draft.urlCount || 0,
            image_inline_count: draft.imageCount || 0,
            audio_url_count: draft.audioUrlCount || 0,
            audio_inline_count: draft.audioCount || 0,
            video_url_count: draft.videoUrlCount || 0,
            video_inline_count: draft.videoCount || 0,
            media_decode: draft.mediaDecode || null,
            media_review: mediaReview.required ? mediaReview : null,
            context_review: contextReview.required ? contextReview : null,
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
                current_turn_anchor: truncate(String(draft.currentTurnAnchorBlock || '').trim(), 900),
                memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
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
            auto_send_enabled_at_draft: !!thread.auto_send_enabled,
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            draft_reply_mode: draft.replyMode || 'standard',
            draft_max_chunks: draft.maxChunks || MAX_CHUNKS,
            drafted_at: new Date().toISOString(),
            coalesced_count: newCount,
            draft_error: draft.error || null,
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
                memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
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
                if (!thread.auto_send_enabled) {
                    return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: alertId }) };
                }
                console.warn(`[ig-draft] duplicate alert ${alertId}, resuming auto-send handling if still pending`);
            }
        } catch (err) {
            console.error('[ig-draft] alert insert failed:', err.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
        }
    }

    let draftReview = null;
    let effectiveContextReview = contextReview;
    if (alertId && draft.joined) {
        const priorCount = Array.isArray(displayRecentInboundMessages) ? displayRecentInboundMessages.length : 0;
        const priorText = priorCount > 0
            ? `\nPrior unanswered messages from ${leadName}:\n${displayRecentInboundMessages.map(m => `- "${truncate(replaceIgMediaMarkers(m.text || ''), 200)}"`).join('\n')}`
            : '';
        const timelineText = displayHistory.length
            ? `\nRecent timestamped ${channelLabel} timeline:\n${truncate(displayHistory.slice(-20).map(m => {
                const speaker = m.direction === 'in' ? leadName : 'Shannon';
                return `${speaker} [${formatCoachLocalTimestamp(m.created_at)}]: ${replaceIgMediaMarkers(sanitizeIgStoryReplyContextText(m.text || ''))}`;
            }).join('\n'), 1600)}`
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
        const reviewContextBlocks = `Just-arrived ${channelLabel} message from ${leadName}: "${truncate(displayMessage, 400)}"${priorText}${timelineText}${workoutText}${memoryText}${crossChannelText}`;
        try {
            const reviewResult = await withTimeout(reviewDraftAndUpdateAlert({
                alertId,
                draftText: draft.joined,
                alertType,
                contextBlocks: reviewContextBlocks,
                clientName: leadName,
                channelLabel,
                existingContextReview: contextReview,
            }), IG_DRAFT_REVIEW_TIMEOUT_MS, 'draft review');
            draftReview = reviewResult?.review || null;
            effectiveContextReview = reviewResult?.contextReview || contextReview;
        } catch (err) {
            console.warn('[ig-draft] draft review failed:', err.message);
        }
        await sendContextCheckNotification({
            adminId: thread.coach_id,
            alertId,
            leadName,
            clientId: thread.linked_user_id || thread.subscriber_id,
            channel,
            draftReview,
            contextReview: effectiveContextReview,
        });
    }

    // Auto-DM path: explicit per-thread opt-in only. Even when allowed, it
    // schedules through Send Later so cold leads never get instant replies.
    // Review flags hold this one reply for Shannon, but auto mode stays on
    // until Shannon explicitly cancels it from the admin dashboard.
    let autoHandled = false;
    const blockedStage = ['churned'].includes(effectiveLeadStage);
    let autoHoldReason = thread.auto_send_enabled
        ? getAutoDmHoldReason({ mediaReview, contextReview: effectiveContextReview, onboardingPhase, draft, draftReview })
        : null;
    if (!autoHoldReason && thread.auto_send_enabled && blockedStage) {
        autoHoldReason = {
            code: 'blocked_stage',
            label: 'lead is churned',
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
    }

    const igAutoSendAllowedForDelay = !!thread.auto_send_enabled
        && !isDirectGraphManual
        && !autoHoldReason
        && !blockedStage
        && ['instagram', 'messenger'].includes(channel);
    if (thread.auto_send_enabled && blockedStage) {
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

    // Auto DMs now always schedule through schedule-coach-reply.
    // Auto-send path: only converted IG/FB threads can bypass the approve
    // gate. Cold leads still need Shannon's approval even if a stale admin
    // toggle was left on.
    let autoSent = autoHandled;
    const igAutoSendAllowed = !!thread.linked_user_id
        && ['in_app', 'paying'].includes(effectiveLeadStage);
    if (!autoHandled && thread.auto_send_enabled && !igAutoSendAllowed) {
        console.warn(`[ig-draft] auto-send blocked for cold/non-converted thread ${thread.id}`);
    }
    if (!autoHandled && thread.auto_send_enabled && igAutoSendAllowed && mediaReview.required) {
        console.warn(`[ig-draft] auto-send blocked for media-review thread ${thread.id}`);
    }
    if (!autoHandled && thread.auto_send_enabled && igAutoSendAllowed && effectiveContextReview.required) {
        console.warn(`[ig-draft] auto-send blocked for context-review thread ${thread.id}`);
    }
    if (false && thread.auto_send_enabled && igAutoSendAllowed && !mediaReview.required && !effectiveContextReview.required && alertId && draft.joined) {
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

    if (!autoSent) {
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
        });
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
        const contextBlocks = `Just-arrived ${channelLabel} message from ${leadName}: "${truncate(displayMessage, 400)}"${priorText}${timelineText}${workoutText}${memoryText}${crossChannelText}`;
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
