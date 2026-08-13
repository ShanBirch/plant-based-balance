/**
 * send-ig-reply — outbound for the Instagram channel via ManyChat.
 *
 * Called by send-coach-reply.js when an inline-reply lands on a coach_alert
 * whose data.channel === 'instagram'. Two responsibilities:
 *
 *   1. POST the reply to ManyChat's send-content API so the IG user receives
 *      the message in their DM.
 *   2. Insert an ig_messages row (direction='out') so the next AI draft has
 *      the conversation history. Mark the coach_alert as sent.
 *
 * Auth: same capability-token model as send-coach-reply — the alert UUID
 * gates the call, status flips to 'sent' to prevent replays. Forwarder
 * (send-coach-reply) has already verified status was 'pending' but we
 * re-check here so this function is also safe to call directly during
 * testing.
 *
 * Required env:
 *   MANYCHAT_API_TOKEN  — page token from manychat.com -> Settings -> API
 *
 * Optional env:
 *   MANYCHAT_SEND_URL    — overrides default https://api.manychat.com/fb/sending/sendContent
 *   MANYCHAT_MESSAGE_TAG — optional legacy ManyChat message tag. Leave blank
 *                          unless Meta/ManyChat have explicitly approved it.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN;
const MANYCHAT_SEND_URL = process.env.MANYCHAT_SEND_URL || 'https://api.manychat.com/fb/sending/sendContent';
const {
    mergeLearningReelContext,
    normalizeLearningReelItems,
} = require('./_lib/client-context');
const { isMetaAppPreviewUrl } = require('./_lib/meta-app-preview-ref');
const {
    OUTBOUND_TEXT_ENCODING_CORRUPTION_CODE,
    resolveUtf8TransportText,
    validateOutboundTextIntegrity,
} = require('./_lib/outbound-text-integrity');
const { maySendDraftImageAttachment } = require('./_lib/paid-meta-proof-media');
function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function envFlagEnabled(value) {
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function isBlockedDraftReview(review) {
    if (!review || typeof review !== 'object') return false;
    return String(review.verdict || '').toLowerCase() === 'block';
}

function blockedDraftReviewMessage(review) {
    const summary = String(review?.summary || '').trim();
    return summary
        ? `AI check blocked this draft: ${summary} Edit the reply or redraft before sending.`
        : 'AI check blocked this draft. Edit the reply or redraft before sending.';
}

const INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN
    || process.env.IG_GRAPH_ACCESS_TOKEN
    || process.env.META_IG_ACCESS_TOKEN
    || process.env.INSTAGRAM_ACCESS_TOKEN
    || '';
let cachedInstagramGraphAccessToken = INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV || '';
const INSTAGRAM_GRAPH_ACCOUNT_ID = process.env.INSTAGRAM_GRAPH_ACCOUNT_ID
    || process.env.IG_GRAPH_BUSINESS_ACCOUNT_ID
    || process.env.META_IG_USER_ID
    || '';
const INSTAGRAM_GRAPH_API_VERSION = normalizeGraphApiVersion(
    process.env.IG_GRAPH_API_VERSION
    || process.env.INSTAGRAM_GRAPH_API_VERSION
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);
const INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED = envFlagEnabled(
    process.env.INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.IG_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.META_HUMAN_AGENT_ENABLED
);
const HUMAN_AGENT_NOT_APPROVED_MESSAGE = 'Meta Human Agent is still only ready for testing, so API sends after 24 hours must be copied/sent manually in Instagram until the feature is approved.';
const HUMAN_AGENT_MANUAL_ONLY_MESSAGE = 'Meta Human Agent 7-day replies must be sent by a human agent. Auto-send and scheduled worker sends are blocked for this window.';
const COCOS_BOT_ACCOUNT = 'cocos_pt_studio';
const COCOS_ALGORITHM_FORK = 'cocos_acquisition_v1';
const COCOS_OWNER_IDS = new Set(['17841435394720504', '26328183736859579']);
const IG_THREAD_SEND_SELECT = 'id,subscriber_id,channel,ig_username,profile_name,linked_user_id,lead_stage,last_inbound_at,last_outbound_at,custom_data';
// Optional. ManyChat rejects most Meta message tags (HUMAN_AGENT, ACCOUNT_UPDATE,
// etc.) with "Unsupported message tag" — they're only valid when the Page has
// the corresponding subscription explicitly approved by Meta. Within the 24h
// messaging window (which covers most reply scenarios) NO tag is needed at all.
// Leave unset by default; only set if Shannon needs to send outside the 24h
// window AND the Page has the tag pre-approved.
const MANYCHAT_MESSAGE_TAG = process.env.MANYCHAT_MESSAGE_TAG || '';
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const {
    normalizeCoachDraftChunks,
    normalizeGeneratedCoachDraftText,
    sanitizeVisibleOutboundDmText,
    splitCoachDraftIntoDmBubbles,
    fireCoachEditAnalysis,
    isClientManagerAutoReplyEnabled,
    isClientManagerBrowserDispatchEnabled,
    isAlwaysNeedsYouPerson,
    shouldBypassKayNeedsYouForAlert,
} = require('./_lib/client-context');
const {
    resolveMetaIgAccessToken,
} = require('./_lib/meta-ig-accounts');
const { recordGrowthOutcome } = require('./_lib/growth-outcomes');
const {
    classifyHealthProgressionAttempt,
    isAutomatedManagerDelivery,
} = require('./_lib/lead-health-progression');
const {
    isChallengeOfferWarningText,
} = require('./_lib/qualifier-engine');
const {
    createVoiceMessageAudio,
    resolveOutboundVoiceMessageConfig,
} = require('./_lib/elevenlabs-voice-message');
const {
    buildAlternateIgDeliveryData,
    resolveAlternateIgDeliveryThread,
} = require('./_lib/ig-thread-routing');
const {
    collectAlertInboundText,
    classifyPersonalDmBoundary,
} = require('./_lib/personal-dm-boundary');

// Inter-chunk delay. Keep multi-bubble IG/Messenger replies paced like a
// person typing, not a bot dumping a batch. Dashboard-approved big replies use
// the background sender so they can take longer between bubbles without
// timing out the approve path.
const CHUNK_GAP_MIN_MS = 4200;
const CHUNK_GAP_MAX_MS = 9500;
const CHUNK_GAP_PER_CHAR_MS = 18;
const CHUNK_GAP_JITTER_MS = 1200;
const LONG_REPLY_CHUNK_GAP_MIN_MS = 4800;
const LONG_REPLY_CHUNK_GAP_MAX_MS = 10500;
const LONG_REPLY_CHUNK_GAP_PER_CHAR_MS = 15;
const LONG_REPLY_CHUNK_GAP_JITTER_MS = 1500;
const HUMAN_REPLY_CHUNK_GAP_MIN_MS = 12000;
const HUMAN_REPLY_CHUNK_GAP_MAX_MS = 24000;
const HUMAN_REPLY_CHUNK_GAP_PER_CHAR_MS = 28;
const HUMAN_REPLY_CHUNK_GAP_JITTER_MS = 2500;
const SYNC_SEND_GAP_BUDGET_MS = 46000;
const EDIT_ANALYSIS_RESPONSE_BUDGET_MS = 1600;
const EDIT_ANALYSIS_ADMIN_BUDGET_MS = 4500;
const EDIT_ANALYSIS_BACKGROUND_BUDGET_MS = 7000;
const INSTAGRAM_GRAPH_TYPING_ACTION_TIMEOUT_MS = 1200;
const FIRST_ITEM_TYPING_MIN_MS = 1800;
const FIRST_ITEM_TYPING_MAX_MS = 4200;
const VOICE_COMPANION_GAP_MS = 1800;
const SEND_CLAIM_STALE_MS = 10 * 60 * 1000;
const INSTAGRAM_GRAPH_DM_BUBBLE_TARGET_CHARS = 210;
const INSTAGRAM_GRAPH_DM_BUBBLE_HARD_MAX_CHARS = 240;

function resolveOutboundDmBubbleOptions({ shouldUseGraph = false, channel = '' } = {}) {
    if (shouldUseGraph && String(channel || '').toLowerCase() === 'instagram') {
        return {
            targetChars: INSTAGRAM_GRAPH_DM_BUBBLE_TARGET_CHARS,
            hardMaxChars: INSTAGRAM_GRAPH_DM_BUBBLE_HARD_MAX_CHARS,
            preferredMaxBubbles: 4,
        };
    }
    return {};
}

function shouldForceTextDelivery(body = {}) {
    return body.forceText === true
        || body.force_text === true
        || String(body.deliveryMode || body.delivery_mode || '').toLowerCase() === 'text';
}
const PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE = 'Permanent Needs You contacts require Shannon approval before sending.';
const LINKED_CLIENT_AUTOMATED_SEND_MESSAGE = 'Linked Instagram clients require Shannon approval from Needs You before sending.';
const PERSONAL_DM_BOUNDARY_MESSAGE = 'Personal, flirtatious, or non-business call conversations require Shannon approval before sending.';
const SEND_TIME_SAFETY_BLOCK_MESSAGE = 'Send-time safety blocked this IG reply. Edit the reply or redraft before sending.';
const AUTOMATED_PERMANENT_NEEDS_YOU_SEND_SOURCES = new Set([
    'auto_send',
    'balance_lead_client_manager_cron',
    'balance_app_repair_worker',
]);
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasClientFacingAiSelfReference(text = '') {
    const normalized = normalizeGeneratedCoachDraftText(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalized) return false;
    return /\bshanbot\b/i.test(normalized)
        || /\bchat\s*gpt\b|\bchatgpt\b/i.test(normalized)
        || /\b(?:as an?|i'?m|i am|this is|that was|sounds like|written by|from|using|use|used)\s+(?:an?\s+)?(?:ai|a\.i\.|bot|robot|automation|automated reply|model|generated reply)\b/i.test(normalized)
        || /\b(?:ai|a\.i\.|bot|robot|automation|automated|generated|model|trained voice)\s+(?:reply|message|draft|text|response|sent|wrote|writing|system)\b/i.test(normalized)
        || /\b(?:not|isn'?t|wasn'?t)\s+(?:ai|a\.i\.|a bot|bot|automated|automation)\b/i.test(normalized)
        || /\b(?:real person|actual person|human here|glad (?:you'?re|im|i'?m) human|yes i'?m human)\b/i.test(normalized);
}

function isGratitudeCloserText(text = '') {
    const raw = normalizeGeneratedCoachDraftText(text || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > 90 || /[?]/.test(raw)) return false;
    const normalized = raw
        .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    if (!normalized) return false;
    // A warm opener is not a closer when the rest of the message contains a
    // live need, offer question, or next-step signal. For example, "Awesome I
    // think I just need help with my diet and some accountability" must stay
    // in the coaching conversation rather than being reduced to "Awesome".
    if (/\b(?:i\s+(?:think|need|want)|need|help|diet|food|accountability|coach(?:ing)?|plan|program|details?|link|price|cost|start|join|sign\s*up|send)\b/.test(normalized)) {
        return false;
    }
    const closerOpening = /^(?:thanks|thank you|thankyou|ta|cheers|appreciate it|legend|perfect|sounds good|all good|no worries|awesome|amazing|nice|sweet|okay|ok|cool|got it|love it|haha thanks|lol thanks)(?:\s+|$)/.exec(normalized);
    if (!closerOpening) return false;

    // Only classify a *pure* closer. Previously the opening-word check made
    // messages such as "Awesome how many clients you got working with ya"
    // look like gratitude because Instagram users often omit punctuation.
    // Any meaningful word after the warm opener keeps the turn live.
    const closerOnlyWords = new Set([
        'a', 'absolutely', 'again', 'all', 'always', 'amazing', 'and',
        'appreciate', 'awesome', 'cheers', 'cool', 'course', 'good', 'got',
        'haha', 'heaps', 'it', 'legend', 'lol', 'lot', 'love', 'mate', 'much',
        'nice', 'no', 'okay', 'ok', 'perfect', 'really', 'shannon', 'so',
        'sound', 'sounds', 'sweet', 'ta', 'thank', 'thanks', 'thankyou', 'too',
        'very', 'worries', 'yeah', 'yep', 'yes', 'you',
    ]);
    return normalized.split(/\s+/).every(word => closerOnlyWords.has(word));
}

function resolveApprovedVoiceCompanionText(alertData = {}, voiceEnabled = false) {
    const text = String(alertData.voice_companion_text || '').trim();
    const previewUrl = String(alertData.paid_meta_app_preview_url || '').trim();
    if (!voiceEnabled
        || alertData.paid_meta_app_preview_handoff !== true
        || !isMetaAppPreviewUrl(previewUrl)
        || !text
        || text.length > 500
        || !text.includes(previewUrl)
        || /https?:\/\/(?!plantbased-balance\.org\/meta-app-preview\.html)/i.test(text)) {
        return '';
    }
    return text;
}

function resolveLatestInboundTextForSend({ alertData = {}, alert = {} } = {}) {
    const data = safeObject(alertData);
    const evidence = safeObject(data.draft_evidence);
    return firstString([
        data.latest_inbound_text,
        data.latest_inbound_message,
        data.current_message,
        data.client_message,
        data.message_preview,
        data.inbound_text,
        data.last_inbound_message,
        evidence.current_message,
        evidence.latest_message,
        evidence.message_preview,
        alert.description,
    ]);
}

function isSafeGratitudeAcknowledgement(value) {
    const words = String(value || '')
        .toLowerCase()
        .replace(/[\u2018\u2019']/g, '')
        .match(/[a-z]+/g) || [];
    if (!words.length) return true;
    const allowed = new Set([
        'all', 'always', 'anytime', 'course', 'glad', 'good', 'haha', 'happy',
        'helped', 'it', 'legend', 'love', 'mate', 'my', 'no', 'not', 'of',
        'pleasure', 'problem', 'that', 'thanks', 'thank', 'very', 'welcome',
        'worries', 'you', 'youre',
    ]);
    return words.every(word => allowed.has(word));
}

function validateSendTimeOutboundSafety({ messagesToSend = [], latestInboundText = '', automated = false, allowQuestionAfterCloser = false } = {}) {
    const combined = (Array.isArray(messagesToSend) ? messagesToSend : [messagesToSend])
        .map(value => normalizeGeneratedCoachDraftText(value || '').trim())
        .filter(Boolean)
        .join('\n\n');
    if (!combined) return { ok: false, code: 'empty_reply', reason: 'Reply text is empty.' };
    if (hasClientFacingAiSelfReference(combined)) {
        return {
            ok: false,
            code: 'client_facing_ai_self_reference',
            reason: 'Reply mentions shanbot, AI, bots, automation, or human-authenticity repair language.',
        };
    }
    if (!allowQuestionAfterCloser && isGratitudeCloserText(latestInboundText) && /[?]/.test(combined)) {
        return {
            ok: false,
            code: 'gratitude_closer_fresh_question',
            reason: 'Latest inbound is a gratitude or clean closer, but the reply adds a fresh question.',
        };
    }
    if (automated && isGratitudeCloserText(latestInboundText) && !isSafeGratitudeAcknowledgement(combined)) {
        return {
            ok: false,
            code: 'gratitude_closer_unsupported_detail',
            reason: 'Latest inbound is a gratitude or clean closer, but the automated reply introduces unsupported detail.',
        };
    }
    return { ok: true };
}

function joinSentChunkTexts(sentChunks = [], fallbackText = '') {
    const joined = (Array.isArray(sentChunks) ? sentChunks : [])
        .map(result => normalizeGeneratedCoachDraftText(result?.text || '').trim())
        .filter(Boolean)
        .join('\n\n')
        .trim();
    return joined || normalizeGeneratedCoachDraftText(fallbackText || '').trim();
}

async function stampSendTimeSafetyBlock({ alertId, alertData = {}, guard = {}, chunksTotal = 1 } = {}) {
    if (!alertId) return;
    const blockedAt = new Date().toISOString();
    const nextData = {
        ...safeObject(alertData),
        last_send_error: `${SEND_TIME_SAFETY_BLOCK_MESSAGE} ${guard.reason || ''}`.trim(),
        last_send_error_code: guard.code || 'send_time_safety_blocked',
        last_send_error_at: blockedAt,
        send_time_safety_blocked_at: blockedAt,
        send_time_safety_block: {
            code: guard.code || 'send_time_safety_blocked',
            reason: guard.reason || null,
            blocked_at: blockedAt,
        },
        chunks_sent: 0,
        chunks_total: chunksTotal,
    };
    try {
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: { data: nextData },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[send-ig-reply] send-time safety block stamp failed:', err.message);
    }
}

function normalizeAccountKey(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
}

function firstString(candidates = []) {
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function cleanGraphData(value) {
    const data = { ...safeObject(value) };
    delete data.manual_ig_required;
    return data;
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

function resolveGraphRecipientId(alertData = {}) {
    const graph = safeObject(alertData.instagram_graph);
    const nested = safeObject(safeObject(alertData.custom_data).instagram_graph);
    const candidates = [
        alertData.ig_graph_recipient_id,
        alertData.ig_graph_user_id,
        graph.ig_graph_user_id,
        graph.recipient_id,
        nested.ig_graph_user_id,
        nested.recipient_id,
    ];
    const subscriberId = String(alertData.subscriber_id || '');
    if (subscriberId.startsWith(GRAPH_SUBSCRIBER_PREFIX)) {
        candidates.push(graphSubscriberParts(subscriberId).recipientId);
    }
    return firstString(candidates);
}

function resolveGraphAccountId(alertData = {}) {
    const graph = safeObject(alertData.instagram_graph);
    const nested = safeObject(safeObject(alertData.custom_data).instagram_graph);
    return String(
        alertData.ig_graph_account_id
        || alertData.ig_account_id
        || graph.ig_account_id
        || graph.account_id
        || graph.owner_id
        || nested.ig_account_id
        || nested.account_id
        || nested.owner_id
        || graphSubscriberParts(alertData.subscriber_id).accountId
        || INSTAGRAM_GRAPH_ACCOUNT_ID
        || ''
    ).trim();
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
    return firstString(candidates);
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

function enrichAlertDataWithThreadGraph(alertData = {}, thread = null) {
    const current = safeObject(alertData);
    if (!thread?.id) return current;

    const threadGraph = cleanGraphData(safeObject(thread.custom_data).instagram_graph);
    const alertGraph = cleanGraphData(current.instagram_graph);
    const graphRecipientId = resolveGraphRecipientId(current) || resolveThreadGraphRecipientId(thread);
    const graphAccountId = resolveGraphAccountId(current) || resolveThreadGraphAccountId(thread);
    const threadChannel = thread.channel || '';
    const channel = current.channel === 'instagram' || current.channel === 'messenger'
        ? current.channel
        : (threadChannel || current.channel);
    const enriched = {
        ...current,
        channel,
        ig_thread_id: current.ig_thread_id || thread.id,
        subscriber_id: current.subscriber_id || thread.subscriber_id,
        ig_username: current.ig_username || thread.ig_username || threadGraph.ig_username || threadGraph.username || null,
        bot_account: current.bot_account || safeObject(thread.custom_data).bot_account || threadGraph.bot_account || null,
        ig_profile_name: current.ig_profile_name || current.profile_name || thread.profile_name || null,
        ig_last_inbound_at: current.ig_last_inbound_at || current.last_inbound_at || thread.last_inbound_at || threadGraph.last_inbound_at || null,
        ig_last_outbound_at: current.ig_last_outbound_at || current.last_outbound_at || thread.last_outbound_at || threadGraph.last_outbound_at || null,
    };

    if (channel === 'instagram' && graphRecipientId) {
        enriched.delivery_channel = 'instagram_graph';
        enriched.manual_ig_required = false;
        enriched.manual_reason = undefined;
        enriched.ig_graph_recipient_id = graphRecipientId;
        enriched.ig_graph_account_id = graphAccountId || current.ig_graph_account_id || undefined;
        enriched.instagram_graph = {
            ...threadGraph,
            ...alertGraph,
            ig_graph_user_id: graphRecipientId,
            ig_account_id: graphAccountId || alertGraph.ig_account_id || threadGraph.ig_account_id || null,
            account_id: graphAccountId || alertGraph.account_id || threadGraph.account_id || null,
            bot_account: current.bot_account || alertGraph.bot_account || threadGraph.bot_account || safeObject(thread.custom_data).bot_account || null,
            send_ready: true,
            last_inbound_at: enriched.ig_last_inbound_at || alertGraph.last_inbound_at || threadGraph.last_inbound_at || null,
        };
    }

    return enriched;
}

function isCocosAlertData(alertData = {}) {
    const graph = safeObject(alertData.instagram_graph);
    const customData = safeObject(alertData.custom_data);
    const customGraph = safeObject(customData.instagram_graph);
    const ownerIds = [
        alertData.owner_ig_user_id,
        alertData.ig_graph_account_id,
        alertData.ig_account_id,
        graph.owner_id,
        graph.account_id,
        graph.ig_account_id,
        customData.owner_ig_user_id,
        customData.ig_graph_account_id,
        customData.ig_account_id,
        customGraph.owner_id,
        customGraph.account_id,
        customGraph.ig_account_id,
    ].map(value => String(value || '').trim()).filter(Boolean);
    if (ownerIds.some(value => COCOS_OWNER_IDS.has(value))) return true;

    const candidates = [
        alertData.bot_account,
        alertData.algorithm_fork,
        alertData.ig_account_username,
        graph.bot_account,
        graph.account_username,
        customData.bot_account,
        customData.algorithm_fork,
        customGraph.bot_account,
        customGraph.account_username,
    ].map(normalizeAccountKey);

    return candidates.includes(COCOS_BOT_ACCOUNT)
        || candidates.includes(COCOS_ALGORITHM_FORK);
}

function isChallengeOfferSend({ alertData = {}, replyText = '' } = {}) {
    const warning = safeObject(alertData.challenge_offer_warning);
    return warning.required === true
        || warning.code === 'challenge_offer'
        || alertData.challenge_offer_warning === true
        || isChallengeOfferWarningText(replyText);
}

function displayLeadName(alertData = {}) {
    const username = String(alertData.ig_username || '').trim().replace(/^@+/, '');
    if (username) return `@${username}`;
    return String(alertData.client_name || alertData.ig_profile_name || alertData.profile_name || 'IG lead').trim();
}

function truncateText(value, max = 160) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
}

async function notifyChallengeOfferSent({ alert, alertData, alertId, replyText, channel }) {
    if (!alert?.coach_id) return;
    if (!isCocosAlertData(alertData)) return;
    if (!isChallengeOfferSend({ alertData, replyText })) return;

    const leadName = displayLeadName(alertData);
    try {
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: alert.coach_id,
                senderId: alert.client_id || alertData.linked_user_id || alertData.subscriber_id || '',
                senderName: `Plant-Based Fitness Founders Pass offer sent: ${leadName}`,
                messageText: truncateText(replyText, 180),
                type: 'dm_message',
                alertId,
                clientId: alert.client_id || alertData.linked_user_id || alertData.subscriber_id || '',
                clientName: leadName,
                sourceChannel: channel,
                channelLabel: channel === 'messenger' ? 'Balance FB' : 'Balance IG',
                url: './admin-dashboard.html?tab=cocos',
                challengeOfferWarning: '1',
                    challengeOfferLabel: 'Plant-Based Fitness Founders Pass offer sent',
            }),
        }).catch(e => console.warn('[send-ig-reply] challenge-offer sent push failed:', e.message));
    } catch (err) {
        console.warn('[send-ig-reply] challenge-offer sent push errored:', err.message);
    }
}

function hoursSinceIso(value, nowMs = Date.now()) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

function isHumanAgentWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours > 24 && hours <= 24 * 7;
}

function isOutsideStandardMessagingWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours > 24;
}

function hasUnansweredLatestInbound(thread = {}, lastInboundAt = '') {
    const inboundMs = Date.parse(lastInboundAt || thread.last_inbound_at || '');
    if (!Number.isFinite(inboundMs)) return false;
    const outboundMs = Date.parse(thread.last_outbound_at || '');
    return !Number.isFinite(outboundMs) || inboundMs > outboundMs;
}

function isHumanApprovedSource(source, alertData = {}) {
    const rawSource = String(source || '').trim().toLowerCase();
    const scheduledVia = String(alertData.scheduled_via || '').trim().toLowerCase();
    const automatedSources = new Set(['auto_send', 'scheduled_worker', 'send_later']);
    return !automatedSources.has(rawSource) && scheduledVia !== 'auto_send';
}

function isHumanApprovedPermanentNeedsYouSendSource(source) {
    const normalized = String(source || '').trim().toLowerCase();
    return normalized.startsWith('admin_dashboard')
        || normalized === 'android_inline_reply_worker'
        || normalized === 'manual_instagram';
}

function isAutomatedPermanentNeedsYouSendSource(source, data = {}) {
    const normalized = String(source || '').trim().toLowerCase();
    const scheduledVia = String(data.scheduled_via || '').trim().toLowerCase();
    const timingChoiceSource = String(data.reply_timing_choice?.source || '').trim().toLowerCase();
    const timingSuggestionSource = String(data.reply_timing_suggestion?.source || '').trim().toLowerCase();
    const hasAutoSendMetadata = scheduledVia === 'auto_send'
        || timingChoiceSource === 'auto_send'
        || timingSuggestionSource === 'auto_send';
    if (isHumanApprovedPermanentNeedsYouSendSource(normalized) && !hasAutoSendMetadata) {
        return false;
    }
    if (normalized === 'scheduled_worker') {
        return hasAutoSendMetadata;
    }
    return AUTOMATED_PERMANENT_NEEDS_YOU_SEND_SOURCES.has(normalized)
        || hasAutoSendMetadata;
}

function getActiveAutomatedReviewHold({ source = '', alertData = {} } = {}) {
    if (!isAutomatedPermanentNeedsYouSendSource(source, alertData)) return null;
    const hold = safeObject(alertData.auto_send_review_hold);
    const code = String(hold.code || '').trim();
    if (!code) return null;
    return {
        code,
        label: String(hold.label || hold.reason || '').trim(),
    };
}

function isAppSupportFastFixException(data = {}) {
    const supportException = data.support_exception === true || data.support_exception === 'true';
    const reason = String(data.support_exception_reason || '').trim();
    return supportException && reason === 'app_support_fast_fix';
}

function isVerifiedAppSupportAutomatedReply(data = {}, source = '') {
    if (!isAppSupportFastFixException(data)) return false;
    const normalizedSource = String(source || '').trim().toLowerCase();
    const replyKind = String(data.support_reply_kind || '').trim();
    const issueKey = String(data.support_issue_key || '').trim();
    const state = String(data.support_state || '').trim();
    if (!issueKey || data.support_automation_authorized !== true || data.outbound_attempted === true) return false;

    if (replyKind === 'verified_fix_complete') {
        return normalizedSource === 'balance_app_repair_worker'
            && state === 'verified_fix_reply_ready'
            && !!String(data.repair_verified_at || '').trim()
            && !!String(data.repair_verification_summary || '').trim()
            && data.completion_reply_used !== true
            && data.support_loop_guard !== true;
    }

    if (replyKind === 'failed_fix_ack') {
        return normalizedSource === 'balance_lead_client_manager_cron'
            && state === 'failed_fix_ack_ready'
            && !!String(data.completion_reply_sent_at || '').trim()
            && !!String(data.client_reported_still_broken_at || '').trim()
            && data.failed_fix_ack_used !== true
            && data.support_loop_guard !== true;
    }

    return false;
}

function isPermanentNeedsYouIgAlert({ alert = {}, alertData = {}, thread = null } = {}) {
    const data = alertData || alert.data || {};
    const graph = safeObject(data.instagram_graph);
    const customData = safeObject(data.custom_data);
    const threadCustom = safeObject(thread?.custom_data);
    const needsYouReasons = Array.isArray(data.needs_you_reasons) ? data.needs_you_reasons : [];
    if (data.permanent_needs_you_draft_only === true) return true;
    if (data.needs_you_reason === 'always_needs_you_person') return true;
    if (needsYouReasons.includes('always_needs_you_person')) return true;
    return isAlwaysNeedsYouPerson({
        name: alert.client_name || data.client_name || data.profile_name || thread?.profile_name,
        client_name: alert.client_name || data.client_name,
        profile_name: data.profile_name || data.ig_profile_name || graph.profile_name || thread?.profile_name,
        ig_username: data.ig_username || graph.ig_username || graph.username || thread?.ig_username,
        username: data.username || graph.username || thread?.ig_username,
        handle: data.handle || thread?.ig_username,
        custom_data: {
            ...customData,
            ...threadCustom,
            instagram_graph: {
                ...safeObject(threadCustom.instagram_graph),
                ...graph,
            },
        },
    });
}

function shouldBlockPermanentNeedsYouAutomatedIgSend({ alert = {}, alertData = {}, thread = null, source = '' } = {}) {
    const data = alertData || alert.data || {};
    return isAutomatedPermanentNeedsYouSendSource(source, data)
        && !isVerifiedAppSupportAutomatedReply(data, source)
        && !shouldBypassKayNeedsYouForAlert({ alert, alertData, thread })
        && isPermanentNeedsYouIgAlert({ alert, alertData, thread });
}

async function stampPermanentNeedsYouAutomatedIgSendBlock({ alertId, alertData = {} } = {}) {
    if (!alertId) return;
    const blockedAt = new Date().toISOString();
    const data = {
        ...(alertData || {}),
        client_manager_review_required: true,
        needs_you_required: true,
        operator_queue: 'needs_you',
        needs_you_reason: 'always_needs_you_person',
        needs_you_reasons: [
            ...new Set([
                ...(Array.isArray(alertData?.needs_you_reasons) ? alertData.needs_you_reasons : []),
                'always_needs_you_person',
            ]),
        ],
        permanent_needs_you_draft_only: true,
        last_send_error: PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE,
        last_send_error_code: 'permanent_needs_you_automated_send_blocked',
        last_send_error_at: blockedAt,
    };
    try {
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: { data },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[send-ig-reply] permanent Needs You block stamp failed:', err.message);
    }
}

async function stampPersonalDmBoundaryBlock({ alertId, alertData = {}, classification = {} } = {}) {
    if (!alertId) return;
    const blockedAt = new Date().toISOString();
    const reason = classification.reason || 'personal_social_or_flirtation_manual_only';
    const data = {
        ...(alertData || {}),
        client_manager_review_required: true,
        needs_you_required: true,
        needs_shannon_approval: true,
        operator_queue: 'needs_you',
        needs_you_reason: reason,
        needs_you_reasons: [
            ...new Set([
                ...(Array.isArray(alertData?.needs_you_reasons) ? alertData.needs_you_reasons : []),
                reason,
            ]),
        ],
        last_send_error: PERSONAL_DM_BOUNDARY_MESSAGE,
        last_send_error_code: 'personal_dm_boundary_automated_send_blocked',
        last_send_error_at: blockedAt,
        outbound_attempted: false,
    };
    await supabase(`coach_alerts?id=eq.${alertId}`, {
        method: 'PATCH',
        body: { data },
        prefer: 'return=minimal',
    });
}

function resolveGraphMessageTag({ shouldUseGraph, lastInboundAt, source, alertData }) {
    if (!shouldUseGraph || !isHumanApprovedSource(source, alertData)) return '';
    if (!isHumanAgentWindow(lastInboundAt)) return '';
    if (!INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED) return '';
    return 'HUMAN_AGENT';
}

function isHumanAgentApprovalError(message = '') {
    const text = String(message || '').toLowerCase();
    return text.includes('human agent') && (
        text.includes('reviewed and approved')
        || text.includes('feature for review')
        || text.includes('must be reviewed')
    );
}

function markHumanAgentManualFallback(data = {}, { lastInboundAt = '', graphRecipientId = '', graphAccountId = '', reason = HUMAN_AGENT_NOT_APPROVED_MESSAGE } = {}) {
    const graph = safeObject(data.instagram_graph);
    return {
        ...data,
        delivery_channel: 'manual_ig',
        manual_ig_required: true,
        manual_reason: reason,
        human_agent_required: true,
        human_agent_approved: false,
        ig_last_inbound_at: data.ig_last_inbound_at || data.last_inbound_at || lastInboundAt || null,
        instagram_graph: {
            ...graph,
            ig_graph_user_id: graphRecipientId || graph.ig_graph_user_id || null,
            ig_account_id: graphAccountId || graph.ig_account_id || null,
            last_inbound_at: lastInboundAt || graph.last_inbound_at || null,
            human_agent_required: true,
            human_agent_approved: false,
            send_ready: false,
        },
    };
}

function isManualGraphOnly(alertData = {}) {
    const hasGraphRecipient = !!resolveGraphRecipientId(alertData);
    return !hasGraphRecipient && (
        alertData.manual_ig_required === true
        || alertData.delivery_channel === 'manual_ig'
    );
}

function resolveChunkPacing(totalChunks = 1, deliveryPacing = 'default') {
    if (deliveryPacing === 'human_long_reply_v1' && totalChunks > 1) {
        return {
            strategy: 'human_long_reply_v1',
            minMs: HUMAN_REPLY_CHUNK_GAP_MIN_MS,
            maxMs: HUMAN_REPLY_CHUNK_GAP_MAX_MS,
            perCharMs: HUMAN_REPLY_CHUNK_GAP_PER_CHAR_MS,
            jitterMs: HUMAN_REPLY_CHUNK_GAP_JITTER_MS,
        };
    }
    const longReply = totalChunks > 4;
    return {
        strategy: longReply ? 'timeout_safe_human_sync_v2' : 'human_sync_v2',
        minMs: longReply ? LONG_REPLY_CHUNK_GAP_MIN_MS : CHUNK_GAP_MIN_MS,
        maxMs: longReply ? LONG_REPLY_CHUNK_GAP_MAX_MS : CHUNK_GAP_MAX_MS,
        perCharMs: longReply ? LONG_REPLY_CHUNK_GAP_PER_CHAR_MS : CHUNK_GAP_PER_CHAR_MS,
        jitterMs: longReply ? LONG_REPLY_CHUNK_GAP_JITTER_MS : CHUNK_GAP_JITTER_MS,
        totalBudgetMs: SYNC_SEND_GAP_BUDGET_MS,
    };
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function estimateChunkGapMs({ pacing, previousText, nextText, index }) {
    const previousLength = String(previousText || '').trim().length;
    const nextLength = String(nextText || '').trim().length;
    const base = Number(pacing.minMs) || CHUNK_GAP_MIN_MS;
    const max = Number(pacing.maxMs) || Math.max(base, CHUNK_GAP_MAX_MS);
    const perCharMs = Number(pacing.perCharMs) || CHUNK_GAP_PER_CHAR_MS;
    const jitter = Math.floor(Math.random() * (Number(pacing.jitterMs) || 0));
    const readingTime = (previousLength * perCharMs) + (nextLength * 4) + (index * 350);
    return clampNumber(Math.round(base + readingTime + jitter), base, max);
}

function resolveChunkGaps(messages, pacing) {
    const chunks = Array.isArray(messages) ? messages : [];
    if (chunks.length <= 1) return [];

    let gaps = [];
    for (let i = 1; i < chunks.length; i++) {
        gaps.push(estimateChunkGapMs({
            pacing,
            previousText: chunks[i - 1],
            nextText: chunks[i],
            index: i,
        }));
    }

    const budget = Number(pacing.totalBudgetMs);
    const total = gaps.reduce((sum, gap) => sum + gap, 0);
    if (!Number.isFinite(budget) || budget <= 0 || total <= budget) return gaps;

    const floor = Number(pacing.minMs) || CHUNK_GAP_MIN_MS;
    const floorTotal = floor * gaps.length;
    if (floorTotal >= budget) {
        return gaps.map(() => Math.max(1000, Math.floor(budget / gaps.length)));
    }

    const scale = (budget - floorTotal) / Math.max(1, total - floorTotal);
    return gaps.map(gap => Math.round(floor + ((gap - floor) * scale)));
}

function isLinkedClientIgAlert({ alert = {}, alertData = {}, thread = null } = {}) {
    const data = alertData || alert.data || {};
    return !!(thread?.linked_user_id || alert.client_id || data.linked_user_id || data.client_id);
}

function isManagerOwnedLinkedClientIgSend({ alertData = {}, thread = null, source = '' } = {}) {
    return String(source || '').trim().toLowerCase() === 'balance_lead_client_manager_cron'
        && !!thread?.linked_user_id
        && isClientManagerAutoReplyEnabled(thread)
        && isClientManagerAutoReplyEnabled(alertData);
}

function isManagerOwnedLinkedClientBrowserDispatch({
    alertData = {},
    thread = null,
    source = '',
    lastInboundAt = '',
} = {}) {
    return isManagerOwnedLinkedClientIgSend({ alertData, thread, source })
        && isClientManagerBrowserDispatchEnabled(thread)
        && hasUnansweredLatestInbound(thread, lastInboundAt)
        && isOutsideStandardMessagingWindow(lastInboundAt);
}

function markManagerBrowserDispatchFallback(data = {}, {
    alertId = '',
    actionId = '',
    lastInboundAt = '',
    requestedAt = new Date().toISOString(),
} = {}) {
    const graph = safeObject(data.instagram_graph);
    return {
        ...data,
        delivery_channel: 'instagram_browser_dispatcher',
        manual_ig_required: false,
        manual_reason: null,
        browser_dispatch_required: true,
        browser_dispatch_owner: 'browser_dispatcher',
        browser_dispatch_reason: 'instagram_api_window_closed',
        browser_dispatch_requested_at: requestedAt,
        browser_dispatch_action_id: actionId || null,
        browser_dispatch_alert_id: alertId || null,
        human_agent_required: true,
        human_agent_approved: false,
        last_send_error: 'Instagram API window closed. Handed to the native browser dispatcher.',
        last_send_error_code: 'browser_dispatch_required',
        last_send_error_at: requestedAt,
        instagram_graph: {
            ...graph,
            last_inbound_at: lastInboundAt || graph.last_inbound_at || null,
            human_agent_required: true,
            human_agent_approved: false,
            send_ready: false,
        },
    };
}

async function handoffManagerOwnedLinkedClientToBrowser({
    alertId = '',
    alertData = {},
    thread = null,
    source = '',
    lastInboundAt = '',
} = {}) {
    if (!isManagerOwnedLinkedClientBrowserDispatch({ alertData, thread, source, lastInboundAt })) {
        return { used: false, data: null, action: null };
    }

    const requestedAt = new Date().toISOString();
    const threadId = thread?.id || alertData.ig_thread_id || '';
    const actions = threadId ? await supabase(
        `ig_next_actions?select=id,thread_id,ig_username,owner,status,action_type,priority,reason,action_version&thread_id=eq.${encodeURIComponent(threadId)}&limit=1`
    ) : [];
    const action = actions?.[0] || null;
    if (!action || action.owner !== 'dm_manager' || action.action_type !== 'reply_inbound') {
        return {
            used: false,
            data: {
                ...markHumanAgentManualFallback(alertData, { lastInboundAt }),
                last_send_error: 'Instagram API window closed, but the DM action could not be safely handed to the browser dispatcher.',
                last_send_error_code: 'browser_dispatch_handoff_unavailable',
                last_send_error_at: requestedAt,
            },
            action,
        };
    }

    const reason = {
        ...safeObject(action.reason),
        browser_dispatch_required: true,
        transport_owner: 'browser_dispatcher',
        browser_dispatch_reason: 'instagram_api_window_closed',
        source_alert_id: alertId || null,
        requested_at: requestedAt,
    };
    const updated = await supabase(
        `ig_next_actions?id=eq.${encodeURIComponent(action.id)}&owner=eq.dm_manager&action_type=eq.reply_inbound&status=in.(ready,waiting,claimed)`,
        {
            method: 'PATCH',
            body: {
                owner: 'browser_dispatcher',
                status: 'ready',
                due_at: requestedAt,
                safe_after: null,
                reason,
                claim_owner: null,
                claim_token: null,
                claim_run_id: null,
                claim_expires_at: null,
                completed_at: null,
                receipt: {},
                action_version: Number(action.action_version || 0) + 1,
            },
            prefer: 'return=representation',
        }
    );
    const handedOffAction = updated?.[0] || null;
    if (!handedOffAction) {
        return {
            used: false,
            data: {
                ...markHumanAgentManualFallback(alertData, { lastInboundAt }),
                last_send_error: 'Instagram API window closed, but the browser-dispatch lease transfer lost its ownership check.',
                last_send_error_code: 'browser_dispatch_handoff_conflict',
                last_send_error_at: requestedAt,
            },
            action,
        };
    }

    return {
        used: true,
        action: handedOffAction,
        data: markManagerBrowserDispatchFallback(alertData, {
            alertId,
            actionId: handedOffAction.id,
            lastInboundAt,
            requestedAt,
        }),
    };
}

function shouldBlockLinkedClientAutomatedIgSend({ alert = {}, alertData = {}, thread = null, source = '' } = {}) {
    const data = alertData || alert.data || {};
    return isLinkedClientIgAlert({ alert, alertData: data, thread })
        && isAutomatedPermanentNeedsYouSendSource(source, data)
        && !isVerifiedAppSupportAutomatedReply(data, source)
        && !isManagerOwnedLinkedClientIgSend({ alertData: data, thread, source });
}

async function stampLinkedClientAutomatedIgSendBlock({ alertId, alertData = {} } = {}) {
    if (!alertId) return;
    const blockedAt = new Date().toISOString();
    const reason = 'linked_client_requires_shannon_approval';
    const data = {
        ...(alertData || {}),
        client_manager_review_required: true,
        needs_you_required: true,
        needs_shannon_approval: true,
        linked_client_manual_review: true,
        permanent_needs_you_draft_only: true,
        operator_queue: 'needs_you',
        needs_you_reason: reason,
        needs_you_reasons: [
            ...new Set([
                ...(Array.isArray(alertData?.needs_you_reasons) ? alertData.needs_you_reasons : []),
                reason,
            ]),
        ],
        last_send_error: LINKED_CLIENT_AUTOMATED_SEND_MESSAGE,
        last_send_error_code: 'linked_client_automated_send_blocked',
        last_send_error_at: blockedAt,
        outbound_attempted: false,
    };
    await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        body: { data },
        prefer: 'return=minimal',
    });
}

function resolveFirstItemTypingDelayMs({ kind = 'text', text = '', random = Math.random } = {}) {
    const length = String(text || '').trim().length;
    const base = kind === 'audio' ? 2600 : 1800;
    const perCharMs = kind === 'audio' ? 6 : 9;
    const jitter = Math.floor(Math.max(0, Math.min(1, Number(random()) || 0)) * 700);
    return clampNumber(base + (length * perCharMs) + jitter, FIRST_ITEM_TYPING_MIN_MS, FIRST_ITEM_TYPING_MAX_MS);
}

function resolveOutboundItemGapMs({ index, outboundItems = [], plannedChunkGapsMs = [], chunkPacing = {} } = {}) {
    if (index === 1 && outboundItems[0]?.kind === 'audio' && outboundItems[1]?.kind === 'text') {
        return VOICE_COMPANION_GAP_MS;
    }
    return plannedChunkGapsMs[index - 1] || chunkPacing.minMs || CHUNK_GAP_MIN_MS;
}

function resolveVoiceSourceMessages(alertData = {}, messagesToSend = []) {
    const preservedSource = String(alertData.outbound_voice_source_text || '').trim();
    if (alertData.scheduled_was_edited !== true
        && preservedSource) {
        return [preservedSource];
    }
    return messagesToSend;
}

function editAnalysisBudgetForSend({ source, deliveryPacing } = {}) {
    if (source === 'scheduled_worker' || deliveryPacing === 'human_long_reply_v1') {
        return EDIT_ANALYSIS_BACKGROUND_BUDGET_MS;
    }
    if (source === 'admin_dashboard') {
        return EDIT_ANALYSIS_ADMIN_BUDGET_MS;
    }
    return EDIT_ANALYSIS_RESPONSE_BUDGET_MS;
}

async function runEditAnalysisWithSendBudget(args, { budgetMs = EDIT_ANALYSIS_RESPONSE_BUDGET_MS } = {}) {
    const analysisPromise = fireCoachEditAnalysis(args);
    const timeoutMs = Math.max(500, Number(budgetMs) || EDIT_ANALYSIS_RESPONSE_BUDGET_MS);
    const result = await Promise.race([
        analysisPromise,
        sleep(timeoutMs).then(() => ({ ok: false, timed_out: true })),
    ]);
    if (result?.timed_out) {
        console.warn(`[send-ig-reply] edit analysis exceeded ${timeoutMs}ms send budget`);
        analysisPromise.catch(e => console.warn('[send-ig-reply] deferred edit analysis failed:', e.message));
    }
    return result;
}

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function sentTextContainsLearningReel(item = {}, sentText = '') {
    const text = String(sentText || '');
    const url = String(item.url || item.youtube_url || '').trim();
    const videoId = String(item.video_id || item.videoId || '').trim();
    return (!!url && text.includes(url)) || (!!videoId && text.includes(videoId));
}

async function mergeSentLearningReelContext({ alertData = {}, messagesToSend = [], sentAtIso }) {
    const igThreadId = String(alertData.ig_thread_id || '').trim();
    if (!igThreadId) return null;
    const sentText = (Array.isArray(messagesToSend) ? messagesToSend : [messagesToSend]).join('\n\n');
    const incoming = normalizeLearningReelItems(alertData.learning_reels || alertData.learningReels || [], {
        source: alertData.daily_reel_opportunity_source || 'approved_learning_reel',
        platform: 'youtube',
    })
        .filter(item => sentTextContainsLearningReel(item, sentText))
        .map(item => ({
            ...item,
            sent_at: sentAtIso || item.sent_at || new Date().toISOString(),
            approved_send: true,
        }));
    if (!incoming.length) return null;

    const rows = await supabase(`ig_threads?select=id,custom_data&id=eq.${encodeURIComponent(igThreadId)}&limit=1`);
    const thread = rows[0] || null;
    if (!thread) return null;
    const nextCustomData = mergeLearningReelContext(thread.custom_data || {}, incoming, {
        source: alertData.daily_reel_opportunity_source || 'approved_learning_reel',
        platform: 'youtube',
    });
    await supabase(`ig_threads?id=eq.${encodeURIComponent(igThreadId)}`, {
        method: 'PATCH',
        body: { custom_data: nextCustomData },
        prefer: 'return=minimal',
    });
    return incoming;
}

function createSendClaim(source) {
    const suffix = Math.random().toString(36).slice(2, 10);
    return {
        id: `${Date.now()}-${suffix}`,
        at: new Date().toISOString(),
        source: source || 'unknown',
    };
}

function withSendClaim(data = {}, claim) {
    return {
        ...(data || {}),
        send_claim_id: claim.id,
        send_claimed_at: claim.at,
        send_claimed_via: claim.source,
    };
}

function withoutSendClaim(data = {}) {
    const clean = { ...(data || {}) };
    delete clean.send_claim_id;
    delete clean.send_claimed_at;
    delete clean.send_claimed_via;
    return clean;
}

function getSendClaimId(data = {}) {
    return String(data?.send_claim_id || '').trim();
}

function isSendClaimStale(data = {}, nowMs = Date.now()) {
    const claimId = getSendClaimId(data);
    if (!claimId) return false;
    const claimedAtMs = Date.parse(data?.send_claimed_at || '');
    return !Number.isFinite(claimedAtMs) || (nowMs - claimedAtMs) > SEND_CLAIM_STALE_MS;
}

async function claimPendingAlertForSend(alert, source) {
    const claim = createSendClaim(source);
    let claimedRows = await supabase(
        `coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending&data->>send_claim_id=is.null`,
        {
            method: 'PATCH',
            body: { data: withSendClaim(alert.data || {}, claim) },
            prefer: 'return=representation',
        }
    );
    const claimed = claimedRows[0] || null;
    if (claimed) return { ...claimed, sendClaim: claim };

    const current = await loadAlertSendState(alert.id);
    const staleClaimId = current?.status === 'pending' && isSendClaimStale(current?.data)
        ? getSendClaimId(current.data)
        : '';
    if (!staleClaimId) return null;

    claimedRows = await supabase(
        `coach_alerts?id=eq.${encodeURIComponent(alert.id)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(staleClaimId)}`,
        {
            method: 'PATCH',
            body: { data: withSendClaim(current.data || alert.data || {}, claim) },
            prefer: 'return=representation',
        }
    );
    const reclaimed = claimedRows[0] || null;
    return reclaimed ? { ...reclaimed, sendClaim: claim } : null;
}

async function loadAlertSendState(alertId) {
    try {
        const rows = await supabase(
            `coach_alerts?select=id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        console.warn('[send-ig-reply] send-state lookup failed:', err.message);
        return null;
    }
}

async function duplicateSendResponse(alertId) {
    const current = await loadAlertSendState(alertId);
    const status = current?.status || null;
    const inProgress = status === 'pending' && current?.data?.send_claim_id;
    return {
        statusCode: 409,
        body: JSON.stringify({
            error: inProgress ? 'Alert is already sending' : 'Alert already actioned',
            status,
            code: inProgress ? 'alert_send_in_progress' : 'alert_send_already_actioned',
        }),
    };
}

async function getInstagramGraphAccessToken(accountId = '') {
    const resolved = await resolveMetaIgAccessToken(accountId, supabase);
    if (resolved.token) return resolved.token;
    if (cachedInstagramGraphAccessToken) return cachedInstagramGraphAccessToken;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';

    try {
        const rows = await supabase(
            'app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'
        );
        const token = String(rows?.[0]?.value || '').trim();
        if (token) cachedInstagramGraphAccessToken = token;
    } catch (err) {
        console.warn('[send-ig-reply] Supabase IG Graph token lookup failed:', err.message);
    }
    return cachedInstagramGraphAccessToken;
}

async function loadIgThreadForSend(threadId) {
    if (!threadId) return null;
    try {
        const rows = await supabase(
            `ig_threads?select=${IG_THREAD_SEND_SELECT}&id=eq.${encodeURIComponent(threadId)}&limit=1`
        );
        return rows?.[0] || null;
    } catch (err) {
        console.warn('[send-ig-reply] ig_thread send-context lookup failed:', err.message);
        return null;
    }
}

function normalizeTimingSuggestion(value) {
    if (!value || typeof value !== 'object') return null;
    const delay = Number(value.delay_ms);
    return {
        action: value.action === 'send_now' ? 'send_now' : 'schedule',
        delay_ms: Number.isFinite(delay) && delay >= 0 ? delay : null,
        label: String(value.label || '').slice(0, 40),
        reason: String(value.reason || '').slice(0, 240),
        confidence: Number.isFinite(Number(value.confidence)) ? Number(value.confidence) : null,
        signals: value.signals && typeof value.signals === 'object' ? value.signals : {},
    };
}

const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm', 'follow_up_review'];

async function clearManyChatHomeNotifications({ alertId, igThreadId, sentAt, source }) {
    if (!igThreadId) return { siblingAlertsCleared: 0 };
    let siblingAlertsCleared = 0;
    try {
        const siblingRows = await supabase(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${encodeURIComponent(igThreadId)}&status=eq.pending&id=neq.${encodeURIComponent(alertId)}&alert_type=in.(${MANYCHAT_DM_ALERT_TYPES.join(',')})&created_at=lte.${encodeURIComponent(sentAt)}&limit=25`
        );
        for (const sibling of siblingRows) {
            const mergedData = {
                ...(sibling.data || {}),
                cancel_reason: 'cleared_by_outbound_reply',
                cleared_by_outbound_reply_at: sentAt,
                cleared_by_outbound_reply_source: source,
                cleared_by_primary_alert_id: alertId,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    actioned_at: sentAt,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        }
    } catch (e) {
        console.warn('[send-ig-reply] sibling alert cleanup failed:', e.message);
    }
    return { siblingAlertsCleared };
}

async function postToManyChat({ subscriberId, text, channel }) {
    if (!MANYCHAT_API_TOKEN) {
        throw new Error('MANYCHAT_API_TOKEN not configured');
    }
    // ManyChat's sendContent routing depends on `content.type`:
    //   - 'instagram'  -> Meta Instagram Messaging API
    //   - omitted      -> Meta Messenger Send API (the default)
    // For IG subscribers the type MUST be 'instagram', otherwise ManyChat
    // calls the Messenger API which has zero interaction history and
    // returns code 3011 "subscriber's last interaction was Xh ago". For
    // FB Messenger subscribers we omit the type so Messenger's default
    // routing is used. Schema:
    //   https://manychat.github.io/dynamic_block_docs/channels/
    const content = {
        messages: [{ type: 'text', text }],
    };
    if (channel === 'instagram') {
        content.type = 'instagram';
    }
    const body = {
        subscriber_id: subscriberId,
        data: {
            version: 'v2',
            content,
        },
    };
    if (MANYCHAT_MESSAGE_TAG) body.message_tag = MANYCHAT_MESSAGE_TAG;
    const res = await fetch(MANYCHAT_SEND_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
        throw new Error(`ManyChat ${res.status}: ${responseText.slice(0, 400)}`);
    }
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }
    return parsed;
}

async function postToInstagramGraph({ recipientId, accountId, text, tag }) {
    const accessToken = await getInstagramGraphAccessToken(accountId);
    if (!accessToken) {
        throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    }
    if (!recipientId) {
        throw new Error('Instagram Graph recipient id missing');
    }
    const targetAccount = accountId || 'me';
    const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
            ...(tag ? { tag } : {}),
        }),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

async function postInstagramGraphAudio({ recipientId, accountId, audioUrl, tag }) {
    const accessToken = await getInstagramGraphAccessToken(accountId);
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');
    if (!audioUrl) throw new Error('Instagram Graph audio URL missing');

    const targetAccount = accountId || 'me';
    const res = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: 'audio',
                    payload: { url: audioUrl },
                },
            },
            ...(tag ? { tag } : {}),
        }),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = responseText ? JSON.parse(responseText) : {}; } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph audio ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

function buildInstagramGraphVideoMessagePayload({ recipientId, videoUrl, tag }) {
    return {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'video',
                payload: { url: videoUrl },
            },
        },
        ...(tag ? { tag } : {}),
    };
}

async function postInstagramGraphVideo({ recipientId, accountId, videoUrl, tag }) {
    const accessToken = await getInstagramGraphAccessToken(accountId);
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');
    if (!videoUrl) throw new Error('Instagram Graph video URL missing');

    const targetAccount = accountId || 'me';
    const res = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildInstagramGraphVideoMessagePayload({ recipientId, videoUrl, tag })),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = responseText ? JSON.parse(responseText) : {}; } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph video ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

function buildInstagramGraphImageMessagePayload({ recipientId, imageUrl, tag }) {
    return {
        recipient: { id: recipientId },
        message: {
            attachment: {
                type: 'image',
                payload: { url: imageUrl },
            },
        },
        ...(tag ? { tag } : {}),
    };
}

async function postInstagramGraphImage({ recipientId, accountId, imageUrl, tag }) {
    const accessToken = await getInstagramGraphAccessToken(accountId);
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');
    if (!imageUrl) throw new Error('Instagram Graph image URL missing');

    const targetAccount = accountId || 'me';
    const res = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildInstagramGraphImageMessagePayload({ recipientId, imageUrl, tag })),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = responseText ? JSON.parse(responseText) : {}; } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph image ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

function isInstagramAudioUnsupportedError(errorMessage = '') {
    const text = String(errorMessage || '').toLowerCase();
    return text.includes('attachment format is not supported')
        || (text.includes('audio') && text.includes('not supported'));
}

async function postInstagramGraphSenderAction({ recipientId, accountId, senderAction, timeoutMs = 0 }) {
    const allowedActions = new Set(['mark_seen', 'typing_on', 'typing_off']);
    if (!allowedActions.has(senderAction)) {
        throw new Error(`Unsupported Instagram Graph sender action: ${senderAction}`);
    }
    const accessToken = await getInstagramGraphAccessToken(accountId);
    if (!accessToken) {
        throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    }
    if (!recipientId) {
        throw new Error('Instagram Graph recipient id missing');
    }
    const targetAccount = accountId || 'me';
    const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`;
    const controller = timeoutMs > 0 && typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    const timeout = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            signal: controller?.signal,
            body: JSON.stringify({
                recipient: { id: recipientId },
                sender_action: senderAction,
            }),
        });
    } catch (err) {
        if (err?.name === 'AbortError') {
            throw new Error(`Instagram Graph ${senderAction} timed out`);
        }
        throw err;
    } finally {
        if (timeout) clearTimeout(timeout);
    }
    const responseText = await res.text();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph ${senderAction} ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

async function postInstagramGraphSeenReceipt({ recipientId, accountId }) {
    return postInstagramGraphSenderAction({
        recipientId,
        accountId,
        senderAction: 'mark_seen',
    });
}

async function patchInstagramSeenReceiptState({ thread, actorId, source, seenAtIso }) {
    if (!thread?.id) return { state_persisted: false, state_reason: 'thread_missing' };
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const actionData = safeObject(customData.instagram_graph_actions);
    const nextCustomData = {
        ...customData,
        instagram_graph: {
            ...graph,
            last_action_at: seenAtIso,
            last_mark_seen_at: seenAtIso,
        },
        instagram_graph_actions: {
            ...actionData,
            last_mark_seen_at: seenAtIso,
            last_mark_seen_by: actorId || actionData.last_mark_seen_by || 'system',
            last_mark_seen_source: source || actionData.last_mark_seen_source || 'outbound_reply_before_send',
        },
    };

    try {
        await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
            method: 'PATCH',
            body: { custom_data: nextCustomData },
            prefer: 'return=minimal',
        });
        return { state_persisted: true };
    } catch (err) {
        console.warn('[send-ig-reply] Instagram seen receipt state patch failed:', err.message);
        return { state_persisted: false, state_error: err.message || String(err) };
    }
}

async function sendInstagramSeenReceiptBeforeReply({ channel, recipientId, accountId, thread, actorId, source, seenAtIso }) {
    if (channel !== 'instagram') {
        return { attempted: false, ok: false, reason: 'not_instagram' };
    }
    if (!recipientId) {
        return { attempted: false, ok: false, reason: 'graph_recipient_missing' };
    }
    try {
        await postInstagramGraphSeenReceipt({ recipientId, accountId });
        return {
            attempted: true,
            ok: true,
            sent_at: seenAtIso,
            timing: 'before_reply',
            ...(await patchInstagramSeenReceiptState({ thread, actorId, source, seenAtIso })),
        };
    } catch (err) {
        console.warn('[send-ig-reply] Instagram seen receipt failed:', err.message);
        return { attempted: true, ok: false, error: err.message, timing: 'before_reply' };
    }
}

async function sendInstagramGraphTypingAction({ channel, recipientId, accountId, action, beforeChunkIndex, gapMs = null }) {
    if (channel !== 'instagram') {
        return { attempted: false, ok: false, reason: 'not_instagram' };
    }
    if (!recipientId) {
        return { attempted: false, ok: false, reason: 'graph_recipient_missing' };
    }
    try {
        await postInstagramGraphSenderAction({
            recipientId,
            accountId,
            senderAction: action,
            timeoutMs: INSTAGRAM_GRAPH_TYPING_ACTION_TIMEOUT_MS,
        });
        return {
            attempted: true,
            ok: true,
            action,
            before_chunk: beforeChunkIndex,
            gap_ms: gapMs,
        };
    } catch (err) {
        console.warn(`[send-ig-reply] Instagram ${action} failed:`, err.message);
        return {
            attempted: true,
            ok: false,
            action,
            before_chunk: beforeChunkIndex,
            gap_ms: gapMs,
            error: err.message,
        };
    }
}

async function loadThreadLastInboundAt(threadId) {
    if (!threadId) return '';
    try {
        const rows = await supabase(
            `ig_threads?select=last_inbound_at&id=eq.${encodeURIComponent(threadId)}&limit=1`
        );
        return rows?.[0]?.last_inbound_at || '';
    } catch (err) {
        console.warn('[send-ig-reply] thread last_inbound_at lookup failed:', err.message);
        return '';
    }
}

function resolveAutomatedConversationAnchorAt(alert = {}) {
    const data = alert.data || {};
    const inboundCandidates = [
        data.source_inbound_created_at,
        data.last_inbound_at,
        data.ig_last_inbound_at,
        ...(Array.isArray(data.inbound_message_batch)
            ? data.inbound_message_batch.map(item => item?.created_at)
            : []),
    ];
    const inboundTimestamps = inboundCandidates
        .map(value => Date.parse(String(value || '')))
        .filter(Number.isFinite);
    if (inboundTimestamps.length) return new Date(Math.max(...inboundTimestamps)).toISOString();
    const fallbackAt = Date.parse(String(alert.created_at || data.drafted_at || ''));
    return Number.isFinite(fallbackAt) ? new Date(fallbackAt).toISOString() : '';
}

async function getAutomatedInstagramConversationDelta({ alert = {}, alertData = {}, source = '' } = {}) {
    if (!isAutomatedPermanentNeedsYouSendSource(source, alertData)) return null;
    const threadId = String(alertData.ig_thread_id || '').trim();
    const anchorAt = resolveAutomatedConversationAnchorAt({ ...alert, data: alertData });
    if (!threadId || !anchorAt) return null;
    const rows = await supabase(
        `ig_messages?select=id,direction,text,created_at,alert_id&thread_id=eq.${encodeURIComponent(threadId)}&created_at=gt.${encodeURIComponent(anchorAt)}&order=created_at.desc&limit=1`
    );
    return rows?.[0] || null;
}

async function cancelAutomatedConversationDeltaSend({ alertId, alertData = {}, delta = {} } = {}) {
    const canceledAt = new Date().toISOString();
    const data = {
        ...alertData,
        cancel_reason: 'automated_send_conversation_changed',
        automated_send_conversation_changed_at: canceledAt,
        automated_send_newer_message_id: delta.id || null,
        automated_send_newer_message_direction: delta.direction || null,
        automated_send_newer_message_at: delta.created_at || null,
        automated_send_newer_message_alert_id: delta.alert_id || null,
        last_send_error: 'Conversation changed after this draft was created, so the automated send was canceled.',
        last_send_error_code: 'automated_send_conversation_changed',
        last_send_error_at: canceledAt,
    };
    await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`, {
        method: 'PATCH',
        body: { status: 'canceled', actioned_at: canceledAt, data },
        prefer: 'return=minimal',
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured (Supabase)' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = body.alertId;
    let replyTextInput;
    let draftTextInput;
    try {
        replyTextInput = normalizeGeneratedCoachDraftText(resolveUtf8TransportText({
            text: body.replyText,
            textUtf8Base64: body.replyTextUtf8Base64 || body.reply_text_utf8_base64,
            fieldName: 'replyText',
        })).trim();
        draftTextInput = normalizeGeneratedCoachDraftText(resolveUtf8TransportText({
            text: body.draftText,
            textUtf8Base64: body.draftTextUtf8Base64 || body.draft_text_utf8_base64,
            fieldName: 'draftText',
        })).trim();
    } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: err.message, code: err.code || 'invalid_utf8_base64' }) };
    }
    const source = body.source || 'inline_reply';
    const editReason = (body.editReason || body.edit_reason || '').trim().slice(0, 240);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);
    const deliveryPacing = body.deliveryPacing === 'human_long_reply_v1' ? 'human_long_reply_v1' : 'default';
    const forceText = shouldForceTextDelivery(body);
    const draftReviewOverride = [body.draftReviewOverride, body.draft_review_override, body.sendAnyway, body.send_anyway]
        .some(value => envFlagEnabled(value));

    if (!alertId || !replyTextInput) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or replyText' }) };
    }

    // 1. Load alert and validate channel + status
    let rows;
    try {
        rows = await supabase(
            `coach_alerts?select=id,status,created_at,data,client_id,client_name,coach_id,alert_type&id=eq.${alertId}&limit=1`
        );
    } catch (e) {
        console.error('[send-ig-reply] alert lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }
    const alert = rows[0];
    if (!alert) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    }
    if (alert.status && alert.status !== 'pending') {
        return { statusCode: 409, body: JSON.stringify({ error: 'Alert already actioned', status: alert.status }) };
    }
    const rawAlertData = alert.data || {};
    let threadForSend = rawAlertData.ig_thread_id
        ? await loadIgThreadForSend(rawAlertData.ig_thread_id)
        : null;
    if (rawAlertData.ig_thread_id
        && isAutomatedPermanentNeedsYouSendSource(source, rawAlertData)
        && !threadForSend) {
        if (isLinkedClientIgAlert({ alert, alertData: rawAlertData })) {
            try {
                await stampLinkedClientAutomatedIgSendBlock({ alertId, alertData: rawAlertData });
            } catch (err) {
                console.warn('[send-ig-reply] known-client Needs You block stamp failed:', err.message);
            }
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: LINKED_CLIENT_AUTOMATED_SEND_MESSAGE,
                    code: 'linked_client_automated_send_blocked',
                    source,
                }),
            };
        }
        return {
            statusCode: 503,
            body: JSON.stringify({
                error: 'Client status could not be verified, so the automated Instagram send was stopped.',
                code: 'current_client_status_unverified',
                source,
            }),
        };
    }
    const requestedThreadForSend = threadForSend;
    const requestedIgThreadId = rawAlertData.ig_thread_id || requestedThreadForSend?.id || '';
    let alternateDelivery = null;
    let alertData = enrichAlertDataWithThreadGraph(rawAlertData, threadForSend);
    const activeAutomatedReviewHold = getActiveAutomatedReviewHold({ source, alertData });
    if (activeAutomatedReviewHold) {
        const blockedAt = new Date().toISOString();
        const holdLabel = activeAutomatedReviewHold.label || activeAutomatedReviewHold.code;
        const blockedData = {
            ...alertData,
            last_send_error: `Automated send stopped by active review hold: ${holdLabel}`,
            last_send_error_code: 'auto_send_review_hold_active',
            last_send_error_at: blockedAt,
        };
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: blockedData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] review-hold block patch failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: 'Automated send stopped because this reply still requires review.',
                code: 'auto_send_review_hold_active',
                review_hold_code: activeAutomatedReviewHold.code,
                source,
            }),
        };
    }
    if (alertData.last_send_error || alertData.last_send_error_code || alertData.last_send_error_at) {
        try {
            const clearedData = {
                ...alertData,
                last_send_error: null,
                last_send_error_code: null,
                last_send_error_at: null,
            };
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: clearedData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] stale send error cleanup failed:', err.message);
        }
    }
    if (shouldBlockLinkedClientAutomatedIgSend({ alert, alertData, thread: threadForSend, source })) {
        try {
            await stampLinkedClientAutomatedIgSendBlock({ alertId, alertData });
        } catch (err) {
            console.warn('[send-ig-reply] linked-client Needs You block stamp failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: LINKED_CLIENT_AUTOMATED_SEND_MESSAGE,
                code: 'linked_client_automated_send_blocked',
                source,
            }),
        };
    }
    if (
        !isManagerOwnedLinkedClientIgSend({ alertData, thread: threadForSend, source })
        && shouldBlockPermanentNeedsYouAutomatedIgSend({ alert, alertData, thread: threadForSend, source })
    ) {
        await stampPermanentNeedsYouAutomatedIgSendBlock({ alertId, alertData });
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: PERMANENT_NEEDS_YOU_AUTOMATED_SEND_MESSAGE,
                code: 'permanent_needs_you_automated_send_blocked',
                source,
            }),
        };
    }
    const channel = alertData.channel;
    const shouldSanitizeVisibleLeadCopy = !alertData.client_id;
    let replyText = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(replyTextInput)
        : replyTextInput;
    let draftText = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(draftTextInput)
        : draftTextInput;
    if (!replyText) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Reply text became empty after visible-copy cleanup' }),
        };
    }
    const personalBoundary = classifyPersonalDmBoundary({
        inboundText: collectAlertInboundText(alertData),
        outboundText: replyText,
        linkedUserId: threadForSend?.linked_user_id || alert.client_id || alertData.linked_user_id || null,
    });
    if (personalBoundary.requires_manual && isAutomatedPermanentNeedsYouSendSource(source, alertData)) {
        try {
            await stampPersonalDmBoundaryBlock({ alertId, alertData, classification: personalBoundary });
        } catch (err) {
            console.warn('[send-ig-reply] personal DM boundary stamp failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: PERSONAL_DM_BOUNDARY_MESSAGE,
                code: 'personal_dm_boundary_automated_send_blocked',
                reason: personalBoundary.reason,
                source,
            }),
        };
    }
    const textIntegrity = validateOutboundTextIntegrity(replyText);
    if (!textIntegrity.ok) {
        const blockedAt = new Date().toISOString();
        const blockedData = {
            ...alertData,
            last_send_error: textIntegrity.message,
            last_send_error_code: OUTBOUND_TEXT_ENCODING_CORRUPTION_CODE,
            last_send_error_at: blockedAt,
            outbound_text_integrity: {
                blocked_at: blockedAt,
                code: textIntegrity.code,
                token: textIntegrity.token,
            },
            chunks_sent: 0,
            chunks_total: 1,
        };
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: blockedData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] outbound text-integrity block patch failed:', err.message);
        }
        return { statusCode: 422, body: JSON.stringify({ error: textIntegrity.message, code: textIntegrity.code }) };
    }
    let graphRecipientId = '';
    let graphAccountId = '';
    let graphSendAvailable = false;
    let shouldUseGraph = false;
    let graphLastInboundAt = '';
    let graphNeedsHumanAgent = false;
    const recomputeGraphRouting = async () => {
        graphRecipientId = resolveGraphRecipientId(alertData);
        graphAccountId = resolveGraphAccountId(alertData);
        graphSendAvailable = channel === 'instagram' && !!graphRecipientId;
        shouldUseGraph = graphSendAvailable && (
            alertData.delivery_channel === 'instagram_graph'
            || graphSendAvailable
            || String(alertData.subscriber_id || '').startsWith(GRAPH_SUBSCRIBER_PREFIX)
        );
        const currentThreadId = alertData.ig_thread_id || threadForSend?.id || '';
        graphLastInboundAt = channel === 'instagram'
            ? (threadForSend?.last_inbound_at || alertData.ig_last_inbound_at || alertData.last_inbound_at || await loadThreadLastInboundAt(currentThreadId))
            : '';
        graphNeedsHumanAgent = shouldUseGraph && isHumanAgentWindow(graphLastInboundAt);
    };
    await recomputeGraphRouting();
    if (channel === 'instagram' && threadForSend?.id && (!shouldUseGraph || graphNeedsHumanAgent)) {
        const resolution = await resolveAlternateIgDeliveryThread({
            thread: threadForSend,
            supabaseQuery: supabase,
            selectColumns: IG_THREAD_SEND_SELECT,
            humanAgentEnabled: INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED,
            loggerPrefix: 'send-ig-reply',
        });
        if (resolution?.used && resolution.thread?.id) {
            threadForSend = resolution.thread;
            alternateDelivery = resolution;
            alertData = enrichAlertDataWithThreadGraph({
                ...rawAlertData,
                ig_thread_id: threadForSend.id,
                thread_id: threadForSend.id,
                subscriber_id: threadForSend.subscriber_id,
                channel: threadForSend.channel || rawAlertData.channel,
                ig_username: threadForSend.ig_username || rawAlertData.ig_username,
                profile_name: threadForSend.profile_name || rawAlertData.profile_name,
                ig_profile_name: threadForSend.profile_name || rawAlertData.ig_profile_name,
                ig_last_inbound_at: threadForSend.last_inbound_at || null,
                last_inbound_at: threadForSend.last_inbound_at || null,
                ig_last_outbound_at: threadForSend.last_outbound_at || null,
                last_outbound_at: threadForSend.last_outbound_at || null,
                linked_user_id: threadForSend.linked_user_id || rawAlertData.linked_user_id,
                ...buildAlternateIgDeliveryData(resolution),
            }, threadForSend);
            await recomputeGraphRouting();
        } else {
            alternateDelivery = resolution || null;
        }
    }
    if (isManagerOwnedLinkedClientBrowserDispatch({
        alertData,
        thread: threadForSend,
        source,
        lastInboundAt: graphLastInboundAt,
    })) {
        try {
            const browserHandoff = await handoffManagerOwnedLinkedClientToBrowser({
                alertId,
                alertData,
                thread: threadForSend,
                source,
                lastInboundAt: graphLastInboundAt,
            });
            if (browserHandoff.data) {
                await supabase(`coach_alerts?id=eq.${alertId}`, {
                    method: 'PATCH',
                    body: { data: browserHandoff.data },
                    prefer: 'return=minimal',
                });
            }
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: browserHandoff.data?.last_send_error || HUMAN_AGENT_NOT_APPROVED_MESSAGE,
                    code: browserHandoff.used
                        ? 'browser_dispatch_queued'
                        : (browserHandoff.data?.last_send_error_code || 'browser_dispatch_handoff_unavailable'),
                    browser_dispatch_required: browserHandoff.used,
                    browser_dispatch_action_id: browserHandoff.action?.id || null,
                    manual_ig_required: !browserHandoff.used,
                }),
            };
        } catch (error) {
            console.warn('[send-ig-reply] browser-dispatch handoff failed:', error.message);
            const failedAt = new Date().toISOString();
            const failedData = {
                ...markHumanAgentManualFallback(alertData, { lastInboundAt: graphLastInboundAt }),
                last_send_error: 'Instagram API window closed, but the browser-dispatch handoff failed before ownership transferred.',
                last_send_error_code: 'browser_dispatch_handoff_failed',
                last_send_error_at: failedAt,
            };
            try {
                await supabase(`coach_alerts?id=eq.${alertId}`, {
                    method: 'PATCH',
                    body: { data: failedData },
                    prefer: 'return=minimal',
                });
            } catch (stampError) {
                console.warn('[send-ig-reply] browser-dispatch failure stamp failed:', stampError.message);
            }
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: failedData.last_send_error,
                    code: 'browser_dispatch_handoff_failed',
                    browser_dispatch_required: false,
                    manual_ig_required: true,
                }),
            };
        }
    }
    if (isManualGraphOnly(alertData)) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'This IG draft was captured directly by Instagram Graph and must be sent manually for now.',
                code: 'manual_ig_required',
            }),
        };
    }
    if (channel === 'instagram' && !shouldUseGraph) {
        const manualData = {
            ...alertData,
            delivery_channel: 'manual_ig',
            manual_ig_required: true,
            manual_ig_reason: 'graph_recipient_missing',
            last_send_error: 'This IG thread is not linked to an Instagram Graph recipient ID yet. Wait for their next Graph DM, run the Graph inbox reconciler, or send it manually in Instagram.',
            last_send_error_code: 'graph_recipient_missing',
            last_send_error_at: new Date().toISOString(),
        };
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: manualData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] graph-recipient manual fallback patch failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: manualData.last_send_error,
                code: 'graph_recipient_missing',
                manual_ig_required: true,
            }),
        };
    }
    if (channel !== 'instagram' && channel !== 'messenger') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Alert channel is not a ManyChat channel', got: channel || null }) };
    }
    const graphTokenAvailable = shouldUseGraph ? !!(await getInstagramGraphAccessToken(graphAccountId)) : false;
    if (shouldUseGraph && !graphTokenAvailable) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Server misconfigured: INSTAGRAM_GRAPH_ACCESS_TOKEN unset',
                code: 'instagram_graph_token_missing',
            }),
        };
    }
    if (!shouldUseGraph && !MANYCHAT_API_TOKEN) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: MANYCHAT_API_TOKEN unset' }) };
    }
    const subscriberId = alertData.subscriber_id;
    const igThreadId = alertData.ig_thread_id;
    if (!subscriberId || !igThreadId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Alert missing subscriber_id or ig_thread_id in data' }) };
    }
    if (graphNeedsHumanAgent && !isHumanApprovedSource(source, alertData)) {
        const manualData = markHumanAgentManualFallback(alertData, {
            lastInboundAt: graphLastInboundAt,
            graphRecipientId,
            graphAccountId,
            reason: HUMAN_AGENT_MANUAL_ONLY_MESSAGE,
        });
        manualData.last_send_error = HUMAN_AGENT_MANUAL_ONLY_MESSAGE;
        manualData.last_send_error_code = 'human_agent_manual_only';
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: manualData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] human-agent manual-only patch failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: HUMAN_AGENT_MANUAL_ONLY_MESSAGE,
                code: 'human_agent_manual_send_required',
                manual_ig_required: true,
            }),
        };
    }
    if (graphNeedsHumanAgent && !INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED) {
        const manualData = markHumanAgentManualFallback(alertData, {
            lastInboundAt: graphLastInboundAt,
            graphRecipientId,
            graphAccountId,
        });
        manualData.last_send_error = HUMAN_AGENT_NOT_APPROVED_MESSAGE;
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: manualData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] human-agent fallback patch failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: HUMAN_AGENT_NOT_APPROVED_MESSAGE,
                code: 'human_agent_not_approved',
                manual_ig_required: true,
            }),
        };
    }
    const graphMessageTag = resolveGraphMessageTag({
        shouldUseGraph,
        lastInboundAt: graphLastInboundAt,
        source,
        alertData,
    });

    // 2. Decide what to send.
    //
    // - Shannon DIDN'T edit (replyText matches the joined draft_text exactly):
    //   send each draft chunk as a separate IG message with a short pause
    //   between them. Three bubbles arriving 2-3 seconds apart reads as a
    //   person texting; one wall of text reads as a bot.
    //
    // - Shannon edited the draft: his edit is canonical, so we start from
    //   his full text rather than the old AI chunk boundaries.
    //
    // Either way, run a final paragraph-safe splitter before ManyChat. Meta
    // will hard-cut overlong text wherever it wants, even mid-word. We want
    // separate bubbles that stop at paragraph/sentence boundaries first.
    const rawDraftMessages = Array.isArray(alertData.draft_messages) ? alertData.draft_messages : [];
    let draftMessages = normalizeCoachDraftChunks(rawDraftMessages)
        .map(s => String(s || '').trim())
        .map(normalizeGeneratedCoachDraftText)
        .filter(Boolean);
    if (shouldSanitizeVisibleLeadCopy) {
        draftMessages = draftMessages.map(chunk => sanitizeVisibleOutboundDmText(chunk)).filter(Boolean);
    }
    const draftJoined = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(alertData.draft_text || draftText || draftMessages.join('\n'))
        : normalizeGeneratedCoachDraftText(alertData.draft_text || draftText || draftMessages.join('\n')).trim();
    const draftMessagesJoined = shouldSanitizeVisibleLeadCopy
        ? sanitizeVisibleOutboundDmText(draftMessages.join('\n'))
        : normalizeGeneratedCoachDraftText(draftMessages.join('\n')).trim();
    const draftMessagesMatchDraft = !!draftJoined && draftMessagesJoined === draftJoined;
    const useDraftMessageChunks = draftMessages.length > 0
        && draftJoined
        && replyText.trim() === draftJoined
        && draftMessagesMatchDraft;
    let messagesToSend;
    let wasEdited;
    if (useDraftMessageChunks) {
        messagesToSend = draftMessages;
        wasEdited = false;
    } else {
        messagesToSend = [replyText];
        wasEdited = !!draftText && replyText !== draftText;
    }
    if (!wasEdited && isBlockedDraftReview(alertData.draft_review) && !draftReviewOverride) {
        const errorMessage = blockedDraftReviewMessage(alertData.draft_review);
        const blockedData = {
            ...alertData,
            last_send_error: errorMessage,
            last_send_error_code: 'draft_review_blocked',
            last_send_error_at: new Date().toISOString(),
            chunks_sent: 0,
            chunks_total: useDraftMessageChunks ? draftMessages.length : 1,
        };
        try {
            await supabase(`coach_alerts?id=eq.${alertId}`, {
                method: 'PATCH',
                body: { data: blockedData },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] blocked draft error patch failed:', err.message);
        }
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: errorMessage,
                code: 'draft_review_blocked',
                draft_review: {
                    verdict: alertData.draft_review.verdict,
                    summary: alertData.draft_review.summary || null,
                    notification_reason: alertData.draft_review.notification_reason || null,
                },
            }),
        };
    }
    const dmBubbleOptions = resolveOutboundDmBubbleOptions({ shouldUseGraph, channel });
    messagesToSend = splitCoachDraftIntoDmBubbles(messagesToSend, dmBubbleOptions);
    if (messagesToSend.length === 0) messagesToSend = [replyText];
    const sendTimeSafety = validateSendTimeOutboundSafety({
        messagesToSend,
        latestInboundText: resolveLatestInboundTextForSend({ alertData, alert }),
        automated: isAutomatedPermanentNeedsYouSendSource(source, alertData),
        // Shannon's isolated repeated-ad test must be allowed to progress from
        // a short "Okay" into the approved plant-based qualifier. Keep the
        // ordinary closer guard intact for real leads and existing clients.
        allowQuestionAfterCloser: alertData.meta_ad_internal_test_lane === true,
    });
    if (!sendTimeSafety.ok) {
        await stampSendTimeSafetyBlock({
            alertId,
            alertData,
            guard: sendTimeSafety,
            chunksTotal: messagesToSend.length,
        });
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: SEND_TIME_SAFETY_BLOCK_MESSAGE,
                code: sendTimeSafety.code || 'send_time_safety_blocked',
                reason: sendTimeSafety.reason || null,
            }),
        };
    }
    const chunkPacing = resolveChunkPacing(messagesToSend.length, deliveryPacing);
    const plannedChunkGapsMs = resolveChunkGaps(messagesToSend, chunkPacing);
    const voiceMessageConfig = resolveOutboundVoiceMessageConfig(
        forceText ? { ...alertData, outbound_voice_message: false } : alertData,
        { shouldUseGraph, channel }
    );
    if (voiceMessageConfig.enabled && !voiceMessageConfig.available) {
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: 'Voice message delivery requires Instagram Graph',
                code: voiceMessageConfig.blockedReason || 'voice_message_unavailable',
            }),
        };
    }
    const draftVideoAttachmentUrl = useDraftMessageChunks
        ? String(alertData.draft_video_attachment_url || '').trim()
        : '';
    const hasDraftVideoAttachment = /^https:\/\/[^\s]+\.mp4(?:[?#][^\s]*)?$/i.test(draftVideoAttachmentUrl);
    const draftImageAttachmentUrl = useDraftMessageChunks
        ? String(alertData.draft_image_attachment_url || '').trim()
        : '';
    const hasValidDraftImageAttachment = /^https:\/\/[^\s]+\.(?:png|jpe?g|webp)(?:[?#][^\s]*)?$/i.test(draftImageAttachmentUrl);
    const hasDraftImageAttachment = hasValidDraftImageAttachment && maySendDraftImageAttachment({
        imageUrl: draftImageAttachmentUrl,
        replyText: messagesToSend.join('\n\n'),
    });
    if (hasValidDraftImageAttachment && !hasDraftImageAttachment) {
        console.warn('[send-ig-reply] suppressed unintroduced paid-Meta proof image');
    }
    if ((hasDraftVideoAttachment || hasDraftImageAttachment) && !shouldUseGraph) {
        return {
            statusCode: 409,
            body: JSON.stringify({
                error: 'Native media delivery requires Instagram Graph',
                code: hasDraftImageAttachment ? 'image_attachment_unavailable' : 'video_attachment_unavailable',
            }),
        };
    }
    let outboundItems = voiceMessageConfig.enabled
        ? [{
            kind: 'audio',
            text: messagesToSend.join('\n\n'),
            voiceConfig: voiceMessageConfig,
        }]
        : messagesToSend.map(text => ({ kind: 'text', text }));
    const voiceCompanionText = resolveApprovedVoiceCompanionText(alertData, voiceMessageConfig.enabled);
    const approvedVoiceCompanion = !!voiceCompanionText;
    if (approvedVoiceCompanion) {
        outboundItems.push({ kind: 'text', text: voiceCompanionText });
    }
    if (hasDraftVideoAttachment && !voiceMessageConfig.enabled) {
        outboundItems = [
            outboundItems[0],
            {
                kind: 'video',
                text: `[VIDEO:${draftVideoAttachmentUrl}]`,
                videoUrl: draftVideoAttachmentUrl,
            },
            ...outboundItems.slice(1),
        ].filter(Boolean);
    } else if (hasDraftImageAttachment && !voiceMessageConfig.enabled) {
        outboundItems = [
            outboundItems[0],
            {
                kind: 'image',
                text: `[IMAGE:${draftImageAttachmentUrl}]`,
                imageUrl: draftImageAttachmentUrl,
            },
            ...outboundItems.slice(1),
        ].filter(Boolean);
    }

    let claimedAlert;
    let sendClaimId = '';
    try {
        const conversationDelta = await getAutomatedInstagramConversationDelta({ alert, alertData, source });
        if (conversationDelta) {
            await cancelAutomatedConversationDeltaSend({ alertId, alertData, delta: conversationDelta });
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: 'Conversation changed after this draft was created, so the automated send was canceled.',
                    code: 'automated_send_conversation_changed',
                    newer_message_id: conversationDelta.id || null,
                    newer_message_direction: conversationDelta.direction || null,
                }),
            };
        }
    } catch (err) {
        console.error('[send-ig-reply] final automated conversation-delta check failed:', err.message);
        return {
            statusCode: 503,
            body: JSON.stringify({
                error: 'Could not verify that the conversation is unchanged, so nothing was sent.',
                code: 'automated_conversation_delta_check_failed',
            }),
        };
    }
    try {
        claimedAlert = await claimPendingAlertForSend({ ...alert, data: alertData }, source);
    } catch (err) {
        console.error('[send-ig-reply] alert send claim failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not claim alert for sending' }) };
    }
    if (!claimedAlert) {
        return duplicateSendResponse(alertId);
    }
    sendClaimId = claimedAlert.sendClaim?.id || '';

    const seenReceipt = shouldUseGraph
        ? await sendInstagramSeenReceiptBeforeReply({
            channel,
            recipientId: graphRecipientId,
            accountId: graphAccountId,
            thread: threadForSend,
            actorId: alert.coach_id,
            source: `${source}_before_send`,
            seenAtIso: new Date().toISOString(),
        })
        : { attempted: false, ok: false, reason: 'not_instagram_graph' };

    // 3. Send each chunk via the selected transport with delays. Stop on first failure so
    //    we don't keep dispatching after a bad chunk.
    const sendResults = [];
    const sentChunkGapsMs = [];
    const instagramTypingActions = [];
    let firstError = null;
    const deliveryTransport = shouldUseGraph ? 'instagram_graph' : 'manychat';
    for (let i = 0; i < outboundItems.length; i++) {
        let typingStartedForChunk = false;
        if (i === 0 && shouldUseGraph) {
            const firstItem = outboundItems[0];
            const firstTypingDelayMs = resolveFirstItemTypingDelayMs({
                kind: firstItem.kind,
                text: firstItem.text,
            });
            const typingAction = await sendInstagramGraphTypingAction({
                channel,
                recipientId: graphRecipientId,
                accountId: graphAccountId,
                action: 'typing_on',
                beforeChunkIndex: 1,
                gapMs: firstTypingDelayMs,
            });
            if (typingAction.attempted) instagramTypingActions.push(typingAction);
            typingStartedForChunk = !!typingAction.ok;
            // Voice synthesis already creates a natural wait after typing starts.
            // Adding the text-style delay here can push an audio + companion send
            // beyond the serverless response window after both items have delivered.
            if (firstItem.kind !== 'audio') await sleep(firstTypingDelayMs);
        } else if (i > 0) {
            const gapMs = resolveOutboundItemGapMs({
                index: i,
                outboundItems,
                plannedChunkGapsMs,
                chunkPacing,
            });
            sentChunkGapsMs.push(gapMs);
            if (shouldUseGraph) {
                const typingAction = await sendInstagramGraphTypingAction({
                    channel,
                    recipientId: graphRecipientId,
                    accountId: graphAccountId,
                    action: 'typing_on',
                    beforeChunkIndex: i + 1,
                    gapMs,
                });
                if (typingAction.attempted) instagramTypingActions.push(typingAction);
                typingStartedForChunk = !!typingAction.ok;
            }
            await sleep(gapMs);
        }
        const item = outboundItems[i];
        const chunkText = item.text;
        try {
            if (item.kind === 'audio') {
                const audio = await createVoiceMessageAudio({
                    messages: resolveVoiceSourceMessages(alertData, messagesToSend),
                    alertId,
                    alertData,
                    supabaseQuery: supabase,
                });
                const r = await postInstagramGraphAudio({
                    recipientId: graphRecipientId,
                    accountId: graphAccountId,
                    audioUrl: audio.url,
                    tag: graphMessageTag,
                });
                sendResults.push({
                    ok: true,
                    response: r,
                    text: audio.text || chunkText,
                    transport: deliveryTransport,
                    kind: 'audio',
                    audio,
                });
            } else if (item.kind === 'video') {
                const r = await postInstagramGraphVideo({
                    recipientId: graphRecipientId,
                    accountId: graphAccountId,
                    videoUrl: item.videoUrl,
                    tag: graphMessageTag,
                });
                sendResults.push({
                    ok: true,
                    response: r,
                    text: chunkText,
                    transport: deliveryTransport,
                    kind: 'video',
                    videoUrl: item.videoUrl,
                });
            } else if (item.kind === 'image') {
                const r = await postInstagramGraphImage({
                    recipientId: graphRecipientId,
                    accountId: graphAccountId,
                    imageUrl: item.imageUrl,
                    tag: graphMessageTag,
                });
                sendResults.push({
                    ok: true,
                    response: r,
                    text: chunkText,
                    transport: deliveryTransport,
                    kind: 'image',
                    imageUrl: item.imageUrl,
                });
            } else {
                const r = shouldUseGraph
                    ? await postToInstagramGraph({ recipientId: graphRecipientId, accountId: graphAccountId, text: chunkText, tag: graphMessageTag })
                    : await postToManyChat({ subscriberId, text: chunkText, channel });
                sendResults.push({ ok: true, response: r, text: chunkText, transport: deliveryTransport, kind: 'text' });
            }
        } catch (err) {
            console.error(`[send-ig-reply] chunk ${i + 1}/${outboundItems.length} failed:`, err.message);
            if (shouldUseGraph && typingStartedForChunk) {
                const typingOffAction = await sendInstagramGraphTypingAction({
                    channel,
                    recipientId: graphRecipientId,
                    accountId: graphAccountId,
                    action: 'typing_off',
                    beforeChunkIndex: i + 1,
                });
                if (typingOffAction.attempted) instagramTypingActions.push(typingOffAction);
            }
            firstError = err.message;
            sendResults.push({ ok: false, error: err.message, text: chunkText, transport: deliveryTransport, kind: item.kind });
            break;
        }
    }

    const sentChunks = sendResults.filter(r => r.ok);
    const allOk = firstError === null && sentChunks.length === outboundItems.length;
    const sentAtIso = new Date().toISOString();
    const sentMessageText = joinSentChunkTexts(sentChunks, replyText);
    const threadBotAccount = String(
        alertData.bot_account
        || threadForSend?.custom_data?.bot_account
        || threadForSend?.custom_data?.instagram_graph?.bot_account
        || ''
    ).trim().toLowerCase();
    const aiAuthored = !wasEdited || isAutomatedManagerDelivery(source, alertData);
    const healthProgressionAttempt = (!threadForSend?.linked_user_id && (!threadBotAccount || threadBotAccount === 'shan_n_sunny'))
        ? classifyHealthProgressionAttempt(replyText, { aiAuthored })
        : { is_attempt: false, ai_authored: aiAuthored, move_type: 'none', topics: [], evidence: '' };
    const sentVoiceMessages = sentChunks
        .filter(r => r.kind === 'audio' && r.audio)
        .map(r => ({
            url: r.audio.url,
            file_name: r.audio.fileName,
            file_id: r.audio.fileId,
            size_bytes: r.audio.sizeBytes,
            content_type: r.audio.contentType,
            voice_id: r.audio.voiceId,
            model_id: r.audio.modelId,
            output_format: r.audio.outputFormat,
            source_encoding: r.audio.sourceEncoding,
            sample_rate: r.audio.sampleRate,
            thought_group_count: r.audio.thoughtGroupCount,
            thought_pause_ms: r.audio.thoughtPauseMs,
            text: r.audio.text,
        }));

    // 4. Log every successfully-delivered chunk to ig_messages (so the next
    //    AI draft has the conversation history including our outbound).
    const loggedOutboundMessageIds = [];
    for (const result of sentChunks) {
        const graphMessageId = shouldUseGraph
            ? (result.response?.message_id || result.response?.id || null)
            : null;
        try {
            const insertedMessages = await supabase('ig_messages', {
                method: 'POST',
                body: [{
                    thread_id: igThreadId,
                    direction: 'out',
                    text: result.text,
                    source: result.kind === 'audio'
                        ? 'instagram_graph_voice_send'
                        : (shouldUseGraph ? 'instagram_graph_send' : source),
                    alert_id: alertId,
                    manychat_message_id: graphMessageId ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}` : null,
                }],
                prefer: 'return=representation',
            });
            if (insertedMessages?.[0]?.id) loggedOutboundMessageIds.push(insertedMessages[0].id);
        } catch (err) {
            console.warn('[send-ig-reply] ig_messages insert failed (non-fatal):', err.message);
        }
    }

    if (sentChunks.length > 0) {
        try {
            await supabase(`ig_threads?id=eq.${igThreadId}`, {
                method: 'PATCH',
                body: { last_outbound_at: sentAtIso },
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-ig-reply] thread last_outbound_at update failed (non-fatal):', err.message);
        }
    }

    // 5. Mark the alert. On full success: status='sent' with edit signal
    //    preserved for the voice-match feedback loop. On any failure: leave
    //    pending so Shannon can retry from the admin dashboard, stamp the
    //    error into data, and fire a notification so he knows.
    const mergedData = {
        ...withoutSendClaim(alertData),
        sent_message: sentMessageText || replyText,
        was_edited: wasEdited,
        sent_at: sentAtIso,
        sent_via: source,
        chunks_sent: sentChunks.length,
        chunks_total: outboundItems.length,
        sent_chunks: sentChunks.map(r => r.text),
        sent_split_strategy: 'paragraph_coalesced_v2',
        sent_delivery_pacing: chunkPacing.strategy,
        delivery_channel: shouldUseGraph ? 'instagram_graph' : (alertData.delivery_channel || channel),
        delivery_transport: deliveryTransport,
        ...buildAlternateIgDeliveryData(alternateDelivery || {}),
        delivery_payload_kind: voiceMessageConfig.enabled
            ? (approvedVoiceCompanion ? 'audio_and_text' : 'audio')
            : 'text',
        outbound_voice_message: voiceMessageConfig.enabled
            ? true
            : (forceText ? false : (alertData.outbound_voice_message || undefined)),
        outbound_voice_message_reason: forceText
            ? 'manager_forced_text_delivery'
            : (voiceMessageConfig.reason || alertData.outbound_voice_message_reason || undefined),
        sent_voice_messages: sentVoiceMessages.length ? sentVoiceMessages : undefined,
        voice_delivery_fallback: null,
        instagram_seen_receipt: seenReceipt,
        sent_graph_message_tag: graphMessageTag || undefined,
        ig_graph_recipient_id: graphRecipientId || alertData.ig_graph_recipient_id || null,
        instagram_graph: graphRecipientId ? {
            ...(safeObject(alertData.instagram_graph)),
            ig_graph_user_id: graphRecipientId,
            ig_account_id: graphAccountId || safeObject(alertData.instagram_graph).ig_account_id || null,
            last_send_at: sentAtIso,
            last_inbound_at: graphLastInboundAt || safeObject(alertData.instagram_graph).last_inbound_at || null,
            last_send_tag: graphMessageTag || undefined,
        } : alertData.instagram_graph,
        sent_chunk_gaps_ms: sentChunkGapsMs,
        sent_graph_message_ids: shouldUseGraph
            ? sentChunks.map(r => r.response?.message_id || r.response?.id || null).filter(Boolean)
            : (alertData.sent_graph_message_ids || undefined),
        draft_messages: useDraftMessageChunks
            ? draftMessages
            : [replyText],
        draft_messages_stale_ignored: draftMessages.length > 0 && !draftMessagesMatchDraft
            ? {
                ignored_at: sentAtIso,
                draft_messages_joined: draftMessagesJoined.slice(0, 1000),
                draft_text: draftJoined.slice(0, 1000),
            }
            : alertData.draft_messages_stale_ignored,
        draft_text: draftJoined || alertData.draft_text,
        health_progression_attempt: healthProgressionAttempt.is_attempt ? {
            attempted_at: sentAtIso,
            ai_authored: healthProgressionAttempt.ai_authored,
            move_type: healthProgressionAttempt.move_type,
            topics: healthProgressionAttempt.topics,
            source,
        } : undefined,
    };
    if (instagramTypingActions.length > 0) {
        mergedData.instagram_typing_strategy = 'typing_on_before_each_item_v2';
        mergedData.instagram_typing_actions = instagramTypingActions;
    }
    if (wasEdited && editReason) mergedData.edit_reason = editReason;
    if (!wasEdited && draftReviewOverride && isBlockedDraftReview(alertData.draft_review)) {
        mergedData.draft_review_override = {
            approved_at: sentAtIso,
            source,
            verdict: alertData.draft_review.verdict || null,
            summary: alertData.draft_review.summary || null,
            notification_reason: alertData.draft_review.notification_reason || null,
        };
    }
    if (timingSuggestion) {
        mergedData.reply_timing_suggestion = timingSuggestion;
        mergedData.reply_timing_choice = {
            action: 'send_now',
            chosen_delay_ms: 0,
            chosen_at: sentAtIso,
            source,
        };
    }
    if (firstError) {
        mergedData.last_send_error = firstError;
        mergedData.last_send_error_code = shouldUseGraph ? 'instagram_graph_send_failed' : 'manychat_send_failed';
        mergedData.last_send_error_at = sentAtIso;
    } else {
        mergedData.last_send_error = null;
        mergedData.last_send_error_code = null;
        mergedData.last_send_error_at = null;
    }
    if (firstError && isHumanAgentApprovalError(firstError)) {
        Object.assign(mergedData, markHumanAgentManualFallback(mergedData, {
            lastInboundAt: graphLastInboundAt,
            graphRecipientId,
            graphAccountId,
        }));
        mergedData.last_send_error = firstError;
        mergedData.last_send_error_code = 'human_agent_not_approved';
        mergedData.last_send_error_at = sentAtIso;
    }

    let alertMarkedSent = false;
    try {
        const markedRows = await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(sendClaimId)}`, {
            method: 'PATCH',
            body: allOk
                ? { status: 'sent', actioned_at: sentAtIso, data: mergedData }
                : { data: mergedData },
            prefer: 'return=representation',
        });
        alertMarkedSent = allOk && markedRows.length > 0;
        if (allOk && !alertMarkedSent) {
            // A native Graph echo can mark this same alert sent while the
            // multi-item sender is still finishing. Recover the full receipt
            // only when the exact send claim is still present and the echo is
            // the actor that won the race.
            const echoRows = await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.sent&data->>send_claim_id=eq.${encodeURIComponent(sendClaimId)}&data->>sent_via=eq.instagram_graph_echo`, {
                method: 'PATCH',
                body: { actioned_at: sentAtIso, data: mergedData },
                prefer: 'return=representation',
            });
            alertMarkedSent = echoRows.length > 0;
            if (!alertMarkedSent) {
                console.warn(`[send-ig-reply] alert ${alertId} was delivered but its send claim was lost before mark-sent`);
            }
        }
    } catch (err) {
        console.warn('[send-ig-reply] alert status update failed (non-fatal):', err.message);
    }

    if (allOk && alertMarkedSent) {
        try {
            await mergeSentLearningReelContext({ alertData, messagesToSend, sentAtIso });
        } catch (err) {
            console.warn('[send-ig-reply] learning reel context merge failed (non-fatal):', err.message);
        }
        if (healthProgressionAttempt.is_attempt) {
            try {
                await recordGrowthOutcome({
                    eventType: 'lead_health_progression_attempted',
                    eventKey: `balance_dm_manager:lead_health_progression_attempted:${alertId}`,
                    eventFamily: 'sales',
                    sourceSystem: 'balance_dm_manager',
                    botAccount: threadBotAccount || 'shan_n_sunny',
                    fromUsername: threadForSend?.ig_username || alertData.ig_username,
                    igThreadId,
                    igMessageId: loggedOutboundMessageIds[0] || null,
                    coachAlertId: alertId,
                    eventStatus: 'delivered',
                    occurredAt: sentAtIso,
                    score: 0,
                    attribution: {
                        move_type: healthProgressionAttempt.move_type,
                        topics: healthProgressionAttempt.topics,
                        ai_authored: healthProgressionAttempt.ai_authored,
                        source,
                    },
                    rawPayload: {
                        final_outbound_text: healthProgressionAttempt.evidence,
                        was_edited: wasEdited,
                        qualifier_stage: alertData.qualifier?.stage || null,
                        commercial_stage: alertData.qualifier?.commercial_stage || null,
                    },
                }, supabase);
            } catch (err) {
                console.warn('[send-ig-reply] health progression attempt log failed (non-fatal):', err.message);
            }
        }
    }

    if (!allOk) {
        const clientName = alertData.ig_username || alertData.client_name || 'IG lead';
        const sentSummary = sentChunks.length > 0
            ? `Sent ${sentChunks.length}/${outboundItems.length} before error.`
            : 'Send failed before any chunks delivered.';
        try {
            await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: alert.coach_id,
                    senderId: '',
                    senderName: `IG send failed: ${clientName}`,
                    messageText: `${sentSummary} ${firstError ? firstError.slice(0, 120) : ''}`.trim(),
                    type: 'dm_message',
                    alertId,
                    sourceChannel: channel,
                }),
            }).catch(e => console.warn('[send-ig-reply] failure-push dispatch failed:', e.message));
        } catch (e) { /* non-fatal */ }
        return {
            statusCode: 502,
            body: JSON.stringify({
                error: shouldUseGraph ? 'Instagram Graph send failed' : 'ManyChat send failed',
                details: firstError,
                chunks_sent: sentChunks.length,
                chunks_total: outboundItems.length,
            }),
        };
    }

    const cleanup = await clearManyChatHomeNotifications({
        alertId,
        igThreadId,
        sentAt: sentAtIso,
        source,
    });
    if (requestedIgThreadId && requestedIgThreadId !== igThreadId) {
        const requestedCleanup = await clearManyChatHomeNotifications({
            alertId,
            igThreadId: requestedIgThreadId,
            sentAt: sentAtIso,
            source,
        });
        cleanup.requestedThreadSiblingAlertsCleared = requestedCleanup.siblingAlertsCleared || 0;
        cleanup.siblingAlertsCleared = (cleanup.siblingAlertsCleared || 0) + (requestedCleanup.siblingAlertsCleared || 0);
    }

    if (alertMarkedSent) {
        await notifyChallengeOfferSent({
            alert,
            alertData: mergedData,
            alertId,
            replyText: sentMessageText || replyText,
            channel,
        });
        await runEditAnalysisWithSendBudget({
            alertId,
            draftText: draftJoined || draftText,
            sentMessage: sentMessageText || replyText,
            source,
        }, {
            budgetMs: editAnalysisBudgetForSend({ source, deliveryPacing }),
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            wasEdited,
            delivery_transport: deliveryTransport,
            alternate_ig_delivery: alternateDelivery?.used ? buildAlternateIgDeliveryData(alternateDelivery).alternate_ig_delivery : null,
            chunks_sent: sentChunks.length,
            chunks_total: outboundItems.length,
            delivery_payload_kind: voiceMessageConfig.enabled
                ? (approvedVoiceCompanion ? 'audio_and_text' : 'audio')
                : (hasDraftImageAttachment ? 'image' : (hasDraftVideoAttachment ? 'video' : 'text')),
            ...cleanup,
        }),
    };
};

exports._test = {
    shouldForceTextDelivery,
    enrichAlertDataWithThreadGraph,
    isHumanAgentApprovalError,
    isHumanAgentWindow,
    markHumanAgentManualFallback,
    resolveGraphMessageTag,
    resolveGraphRecipientId,
    resolveThreadGraphRecipientId,
    resolveChunkPacing,
    resolveChunkGaps,
    resolveFirstItemTypingDelayMs,
    resolveOutboundItemGapMs,
    resolveVoiceSourceMessages,
    resolveOutboundDmBubbleOptions,
    resolveOutboundVoiceMessageConfig,
    resolveApprovedVoiceCompanionText,
    buildInstagramGraphVideoMessagePayload,
    buildInstagramGraphImageMessagePayload,
    isInstagramAudioUnsupportedError,
    isCocosAlertData,
    isChallengeOfferSend,
    isSendClaimStale,
    isHumanApprovedPermanentNeedsYouSendSource,
    isAutomatedPermanentNeedsYouSendSource,
    getActiveAutomatedReviewHold,
    isAppSupportFastFixException,
    isVerifiedAppSupportAutomatedReply,
    isPermanentNeedsYouIgAlert,
    shouldBlockPermanentNeedsYouAutomatedIgSend,
    isLinkedClientIgAlert,
    isManagerOwnedLinkedClientIgSend,
    isManagerOwnedLinkedClientBrowserDispatch,
    markManagerBrowserDispatchFallback,
    shouldBlockLinkedClientAutomatedIgSend,
    stampPersonalDmBoundaryBlock,
    hasClientFacingAiSelfReference,
    isGratitudeCloserText,
    resolveLatestInboundTextForSend,
    isSafeGratitudeAcknowledgement,
    validateSendTimeOutboundSafety,
    resolveAutomatedConversationAnchorAt,
    getAutomatedInstagramConversationDelta,
    joinSentChunkTexts,
    validateOutboundTextIntegrity,
    maySendDraftImageAttachment,
};

exports.sendInstagramGraphTypingAction = sendInstagramGraphTypingAction;
