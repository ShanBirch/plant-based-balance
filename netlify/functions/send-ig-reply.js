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
const MANYCHAT_MESSAGE_TAG = process.env.MANYCHAT_MESSAGE_TAG || 'HUMAN_AGENT';
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

// Inter-chunk delay — keeps the multi-message send within Netlify's 10s
// regular-function budget (3 chunks worst case = ~9s total) while still
// landing as separate IG bubbles. Ample to feel like real typing.
const CHUNK_GAP_MIN_MS = 2500;
const CHUNK_GAP_JITTER_MS = 1000;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pickGap() { return CHUNK_GAP_MIN_MS + Math.floor(Math.random() * CHUNK_GAP_JITTER_MS); }

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

async function postToManyChat({ subscriberId, text }) {
    if (!MANYCHAT_API_TOKEN) {
        throw new Error('MANYCHAT_API_TOKEN not configured');
    }
    const body = {
        subscriber_id: subscriberId,
        data: {
            version: 'v2',
            content: {
                messages: [{ type: 'text', text }],
            },
        },
        message_tag: MANYCHAT_MESSAGE_TAG,
    };
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

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured (Supabase)' }) };
    }
    if (!MANYCHAT_API_TOKEN) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: MANYCHAT_API_TOKEN unset' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = body.alertId;
    const replyText = (body.replyText || '').trim();
    const draftText = (body.draftText || '').trim();
    const source = body.source || 'inline_reply';

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
    if (alertData.channel !== 'instagram') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Alert channel is not instagram', got: alertData.channel || null }) };
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
    // - Shannon edited the draft: we can't know how he intended to split his
    //   edit, so we send it as a single message. His edit is canonical;
    //   our chunk boundaries are gone.
    const draftMessages = Array.isArray(alertData.draft_messages) ? alertData.draft_messages : [];
    const draftJoined = String(alertData.draft_text || draftText || '').trim();
    let messagesToSend;
    let wasEdited;
    if (draftMessages.length > 0 && draftJoined && replyText.trim() === draftJoined) {
        messagesToSend = draftMessages.map(s => String(s).trim()).filter(Boolean);
        wasEdited = false;
    } else {
        messagesToSend = [replyText];
        wasEdited = !!draftText && replyText !== draftText;
    }
    if (messagesToSend.length === 0) messagesToSend = [replyText];

    // 3. Send each chunk via ManyChat with delays. Stop on first failure so
    //    we don't keep dispatching after a bad chunk.
    const sendResults = [];
    let firstError = null;
    for (let i = 0; i < messagesToSend.length; i++) {
        if (i > 0) await sleep(pickGap());
        const chunkText = messagesToSend[i];
        try {
            const r = await postToManyChat({ subscriberId, text: chunkText });
            sendResults.push({ ok: true, response: r, text: chunkText });
        } catch (err) {
            console.error(`[send-ig-reply] chunk ${i + 1}/${messagesToSend.length} failed:`, err.message);
            firstError = err.message;
            sendResults.push({ ok: false, error: err.message, text: chunkText });
            break;
        }
    }

    const sentChunks = sendResults.filter(r => r.ok);
    const allOk = firstError === null && sentChunks.length === messagesToSend.length;
    const sentAtIso = new Date().toISOString();

    // 4. Log every successfully-delivered chunk to ig_messages (so the next
    //    AI draft has the conversation history including our outbound).
    for (const result of sentChunks) {
        try {
            await supabase('ig_messages', {
                method: 'POST',
                body: [{
                    thread_id: igThreadId,
                    direction: 'out',
                    text: result.text,
                    source,
                    alert_id: alertId,
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
    };
    if (firstError) mergedData.last_send_error = firstError;

    try {
        await supabase(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: allOk
                ? { status: 'sent', actioned_at: sentAtIso, data: mergedData }
                : { data: mergedData },
            prefer: 'return=minimal',
        });
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
                }),
            }).catch(e => console.warn('[send-ig-reply] failure-push dispatch failed:', e.message));
        } catch (e) { /* non-fatal */ }
        return {
            statusCode: 502,
            body: JSON.stringify({
                error: 'ManyChat send failed',
                details: firstError,
                chunks_sent: sentChunks.length,
                chunks_total: messagesToSend.length,
            }),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            wasEdited,
            chunks_sent: sentChunks.length,
            chunks_total: messagesToSend.length,
        }),
    };
};
