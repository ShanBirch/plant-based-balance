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
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    fireCoachEditAnalysis,
} = require('./_lib/client-context');
const {
    resolveMetaIgAccessToken,
} = require('./_lib/meta-ig-accounts');
const {
    isChallengeOfferWarningText,
} = require('./_lib/qualifier-engine');

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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
                senderName: `30-day challenge sent: ${leadName}`,
                messageText: truncateText(replyText, 180),
                type: 'dm_message',
                alertId,
                clientId: alert.client_id || alertData.linked_user_id || alertData.subscriber_id || '',
                clientName: leadName,
                sourceChannel: channel,
                channelLabel: channel === 'messenger' ? 'Balance FB' : 'Balance IG',
                url: './admin-dashboard.html?tab=cocos',
                challengeOfferWarning: '1',
                challengeOfferLabel: '30-day challenge sent',
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

function isHumanApprovedSource(source, alertData = {}) {
    const rawSource = String(source || '').trim().toLowerCase();
    const scheduledVia = String(alertData.scheduled_via || '').trim().toLowerCase();
    const automatedSources = new Set(['auto_send', 'scheduled_worker', 'send_later']);
    return !automatedSources.has(rawSource) && scheduledVia !== 'auto_send';
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
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,last_inbound_at,last_outbound_at,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
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

const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];

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

async function postInstagramGraphSeenReceipt({ recipientId, accountId }) {
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
            sender_action: 'mark_seen',
        }),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph seen receipt ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

async function sendInstagramSeenReceiptAfterReply({ channel, recipientId, accountId, sentAtIso }) {
    if (channel !== 'instagram') {
        return { attempted: false, ok: false, reason: 'not_instagram' };
    }
    if (!recipientId) {
        return { attempted: false, ok: false, reason: 'graph_recipient_missing' };
    }
    try {
        await postInstagramGraphSeenReceipt({ recipientId, accountId });
        return { attempted: true, ok: true, sent_at: sentAtIso };
    } catch (err) {
        console.warn('[send-ig-reply] Instagram seen receipt failed:', err.message);
        return { attempted: true, ok: false, error: err.message };
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
    const replyText = normalizeCoachDraftText(body.replyText || '').trim();
    const draftText = normalizeCoachDraftText(body.draftText || '').trim();
    const source = body.source || 'inline_reply';
    const editReason = (body.editReason || body.edit_reason || '').trim().slice(0, 240);
    const timingSuggestion = normalizeTimingSuggestion(body.timingSuggestion || body.reply_timing_suggestion);
    const deliveryPacing = body.deliveryPacing === 'human_long_reply_v1' ? 'human_long_reply_v1' : 'default';
    const draftReviewOverride = [body.draftReviewOverride, body.draft_review_override, body.sendAnyway, body.send_anyway]
        .some(value => envFlagEnabled(value));

    if (!alertId || !replyText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or replyText' }) };
    }

    // 1. Load alert and validate channel + status
    let rows;
    try {
        rows = await supabase(
            `coach_alerts?select=id,status,data,client_id,coach_id,alert_type&id=eq.${alertId}&limit=1`
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
    const threadForSend = rawAlertData.ig_thread_id
        ? await loadIgThreadForSend(rawAlertData.ig_thread_id)
        : null;
    const alertData = enrichAlertDataWithThreadGraph(rawAlertData, threadForSend);
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
    const channel = alertData.channel;
    const graphRecipientId = resolveGraphRecipientId(alertData);
    const graphAccountId = resolveGraphAccountId(alertData);
    const graphSendAvailable = channel === 'instagram' && !!graphRecipientId;
    const shouldUseGraph = graphSendAvailable && (
        alertData.delivery_channel === 'instagram_graph'
        || graphSendAvailable
        || String(alertData.subscriber_id || '').startsWith(GRAPH_SUBSCRIBER_PREFIX)
    );
    if (isManualGraphOnly(alertData)) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'This IG draft was captured directly by Instagram Graph and must be sent manually for now.',
                code: 'manual_ig_required',
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
    const graphLastInboundAt = shouldUseGraph
        ? (alertData.ig_last_inbound_at || alertData.last_inbound_at || threadForSend?.last_inbound_at || await loadThreadLastInboundAt(igThreadId))
        : '';
    const graphNeedsHumanAgent = shouldUseGraph && isHumanAgentWindow(graphLastInboundAt);
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
    const draftMessages = normalizeCoachDraftChunks(rawDraftMessages)
        .map(s => String(s || '').trim())
        .filter(Boolean);
    const draftJoined = normalizeCoachDraftText(alertData.draft_text || draftText || draftMessages.join('\n')).trim();
    let messagesToSend;
    let wasEdited;
    if (draftMessages.length > 0 && draftJoined && replyText.trim() === draftJoined) {
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
            chunks_total: draftMessages.length || 1,
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
    messagesToSend = splitCoachDraftIntoDmBubbles(messagesToSend);
    if (messagesToSend.length === 0) messagesToSend = [replyText];
    const chunkPacing = resolveChunkPacing(messagesToSend.length, deliveryPacing);
    const plannedChunkGapsMs = resolveChunkGaps(messagesToSend, chunkPacing);

    // 3. Send each chunk via the selected transport with delays. Stop on first failure so
    //    we don't keep dispatching after a bad chunk.
    const sendResults = [];
    const sentChunkGapsMs = [];
    let firstError = null;
    const deliveryTransport = shouldUseGraph ? 'instagram_graph' : 'manychat';
    for (let i = 0; i < messagesToSend.length; i++) {
        if (i > 0) {
            const gapMs = plannedChunkGapsMs[i - 1] || chunkPacing.minMs || CHUNK_GAP_MIN_MS;
            sentChunkGapsMs.push(gapMs);
            await sleep(gapMs);
        }
        const chunkText = messagesToSend[i];
        try {
            const r = shouldUseGraph
                ? await postToInstagramGraph({ recipientId: graphRecipientId, accountId: graphAccountId, text: chunkText, tag: graphMessageTag })
                : await postToManyChat({ subscriberId, text: chunkText, channel });
            sendResults.push({ ok: true, response: r, text: chunkText, transport: deliveryTransport });
        } catch (err) {
            console.error(`[send-ig-reply] chunk ${i + 1}/${messagesToSend.length} failed:`, err.message);
            firstError = err.message;
            sendResults.push({ ok: false, error: err.message, text: chunkText, transport: deliveryTransport });
            break;
        }
    }

    const sentChunks = sendResults.filter(r => r.ok);
    const allOk = firstError === null && sentChunks.length === messagesToSend.length;
    const sentAtIso = new Date().toISOString();
    const seenReceipt = allOk
        ? await sendInstagramSeenReceiptAfterReply({
            channel,
            recipientId: graphRecipientId,
            accountId: graphAccountId,
            sentAtIso,
        })
        : { attempted: false, ok: false, reason: 'send_failed' };

    // 4. Log every successfully-delivered chunk to ig_messages (so the next
    //    AI draft has the conversation history including our outbound).
    for (const result of sentChunks) {
        const graphMessageId = shouldUseGraph
            ? (result.response?.message_id || result.response?.id || null)
            : null;
        try {
            await supabase('ig_messages', {
                method: 'POST',
                body: [{
                    thread_id: igThreadId,
                    direction: 'out',
                    text: result.text,
                    source: shouldUseGraph ? 'instagram_graph_send' : source,
                    alert_id: alertId,
                    manychat_message_id: graphMessageId ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}` : null,
                }],
                prefer: 'return=minimal',
            });
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
        ...alertData,
        sent_message: replyText,
        was_edited: wasEdited,
        sent_at: sentAtIso,
        sent_via: source,
        chunks_sent: sentChunks.length,
        chunks_total: messagesToSend.length,
        sent_chunks: sentChunks.map(r => r.text),
        sent_split_strategy: 'paragraph_safe_v1',
        sent_delivery_pacing: chunkPacing.strategy,
        delivery_channel: shouldUseGraph ? 'instagram_graph' : (alertData.delivery_channel || channel),
        delivery_transport: deliveryTransport,
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
        draft_messages: draftMessages.length ? draftMessages : alertData.draft_messages,
        draft_text: draftJoined || alertData.draft_text,
    };
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
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: allOk
                ? { status: 'sent', actioned_at: sentAtIso, data: mergedData }
                : { data: mergedData },
            prefer: 'return=minimal',
        });
        alertMarkedSent = allOk;
    } catch (err) {
        console.warn('[send-ig-reply] alert status update failed (non-fatal):', err.message);
    }

    if (!allOk) {
        const clientName = alertData.ig_username || alertData.client_name || 'IG lead';
        const sentSummary = sentChunks.length > 0
            ? `Sent ${sentChunks.length}/${messagesToSend.length} before error.`
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
                chunks_total: messagesToSend.length,
            }),
        };
    }

    const cleanup = await clearManyChatHomeNotifications({
        alertId,
        igThreadId,
        sentAt: sentAtIso,
        source,
    });

    if (alertMarkedSent) {
        await notifyChallengeOfferSent({
            alert,
            alertData: mergedData,
            alertId,
            replyText,
            channel,
        });
        await runEditAnalysisWithSendBudget({
            alertId,
            draftText: draftJoined || draftText,
            sentMessage: replyText,
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
            chunks_sent: sentChunks.length,
            chunks_total: messagesToSend.length,
            ...cleanup,
        }),
    };
};

exports._test = {
    enrichAlertDataWithThreadGraph,
    isHumanAgentApprovalError,
    isHumanAgentWindow,
    markHumanAgentManualFallback,
    resolveGraphMessageTag,
    resolveGraphRecipientId,
    resolveThreadGraphRecipientId,
    resolveChunkPacing,
    resolveChunkGaps,
    isCocosAlertData,
    isChallengeOfferSend,
};
