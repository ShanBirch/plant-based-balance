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
 *   MANYCHAT_MESSAGE_TAG — overrides default 'HUMAN_AGENT' (Instagram's
 *                          7-day human-agent tag for replied-to conversations)
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
const INSTAGRAM_GRAPH_ACCESS_TOKEN = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN
    || process.env.IG_GRAPH_ACCESS_TOKEN
    || process.env.META_IG_ACCESS_TOKEN
    || process.env.INSTAGRAM_ACCESS_TOKEN
    || '';
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

// Inter-chunk delay. Keep ordinary IG/Messenger replies separated by a few
// seconds. Dashboard-approved big replies can opt into a slower background
// send so each bubble lands roughly 15 seconds apart without timing out the
// synchronous approve path.
const CHUNK_GAP_MIN_MS = 2600;
const CHUNK_GAP_JITTER_MS = 1400;
const LONG_REPLY_CHUNK_GAP_MIN_MS = 1300;
const LONG_REPLY_CHUNK_GAP_JITTER_MS = 700;
const HUMAN_REPLY_CHUNK_GAP_MIN_MS = 14000;
const HUMAN_REPLY_CHUNK_GAP_JITTER_MS = 2500;
const EDIT_ANALYSIS_RESPONSE_BUDGET_MS = 1600;
const EDIT_ANALYSIS_ADMIN_BUDGET_MS = 4500;
const EDIT_ANALYSIS_BACKGROUND_BUDGET_MS = 7000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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
        candidates.push(subscriberId.slice(GRAPH_SUBSCRIBER_PREFIX.length));
    }
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function resolveGraphAccountId(alertData = {}) {
    const graph = safeObject(alertData.instagram_graph);
    const nested = safeObject(safeObject(alertData.custom_data).instagram_graph);
    return String(
        alertData.ig_graph_account_id
        || alertData.ig_account_id
        || graph.ig_account_id
        || graph.account_id
        || nested.ig_account_id
        || nested.account_id
        || INSTAGRAM_GRAPH_ACCOUNT_ID
        || ''
    ).trim();
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
            jitterMs: HUMAN_REPLY_CHUNK_GAP_JITTER_MS,
        };
    }
    const longReply = totalChunks > 4;
    return {
        strategy: longReply ? 'timeout_safe_long_reply_v1' : 'standard_v1',
        minMs: longReply ? LONG_REPLY_CHUNK_GAP_MIN_MS : CHUNK_GAP_MIN_MS,
        jitterMs: longReply ? LONG_REPLY_CHUNK_GAP_JITTER_MS : CHUNK_GAP_JITTER_MS,
    };
}

function pickGap(pacing) {
    return pacing.minMs + Math.floor(Math.random() * pacing.jitterMs);
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

async function postToInstagramGraph({ recipientId, accountId, text }) {
    if (!INSTAGRAM_GRAPH_ACCESS_TOKEN) {
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
            'Authorization': `Bearer ${INSTAGRAM_GRAPH_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
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
    const alertData = alert.data || {};
    const channel = alertData.channel;
    const graphRecipientId = resolveGraphRecipientId(alertData);
    const graphAccountId = resolveGraphAccountId(alertData);
    const graphSendAvailable = channel === 'instagram' && !!graphRecipientId;
    const shouldUseGraph = graphSendAvailable && (
        alertData.delivery_channel === 'instagram_graph'
        || !!INSTAGRAM_GRAPH_ACCESS_TOKEN
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
    if (shouldUseGraph && !INSTAGRAM_GRAPH_ACCESS_TOKEN) {
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
    messagesToSend = splitCoachDraftIntoDmBubbles(messagesToSend);
    if (messagesToSend.length === 0) messagesToSend = [replyText];
    const chunkPacing = resolveChunkPacing(messagesToSend.length, deliveryPacing);

    // 3. Send each chunk via the selected transport with delays. Stop on first failure so
    //    we don't keep dispatching after a bad chunk.
    const sendResults = [];
    const sentChunkGapsMs = [];
    let firstError = null;
    const deliveryTransport = shouldUseGraph ? 'instagram_graph' : 'manychat';
    for (let i = 0; i < messagesToSend.length; i++) {
        if (i > 0) {
            const gapMs = pickGap(chunkPacing);
            sentChunkGapsMs.push(gapMs);
            await sleep(gapMs);
        }
        const chunkText = messagesToSend[i];
        try {
            const r = shouldUseGraph
                ? await postToInstagramGraph({ recipientId: graphRecipientId, accountId: graphAccountId, text: chunkText })
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
        ig_graph_recipient_id: graphRecipientId || alertData.ig_graph_recipient_id || null,
        instagram_graph: graphRecipientId ? {
            ...(safeObject(alertData.instagram_graph)),
            ig_graph_user_id: graphRecipientId,
            ig_account_id: graphAccountId || safeObject(alertData.instagram_graph).ig_account_id || null,
            last_send_at: sentAtIso,
        } : alertData.instagram_graph,
        sent_chunk_gaps_ms: sentChunkGapsMs,
        sent_graph_message_ids: shouldUseGraph
            ? sentChunks.map(r => r.response?.message_id || r.response?.id || null).filter(Boolean)
            : (alertData.sent_graph_message_ids || undefined),
        draft_messages: draftMessages.length ? draftMessages : alertData.draft_messages,
        draft_text: draftJoined || alertData.draft_text,
    };
    if (wasEdited && editReason) mergedData.edit_reason = editReason;
    if (timingSuggestion) {
        mergedData.reply_timing_suggestion = timingSuggestion;
        mergedData.reply_timing_choice = {
            action: 'send_now',
            chosen_delay_ms: 0,
            chosen_at: sentAtIso,
            source,
        };
    }
    if (firstError) mergedData.last_send_error = firstError;

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
