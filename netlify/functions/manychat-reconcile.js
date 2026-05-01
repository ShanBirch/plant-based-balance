/**
 * manychat-reconcile - reliability backstop for IG/FB inbox ingestion.
 *
 * ManyChat's Default Reply + External Request is the real-time path, but it
 * can be skipped by live-chat pause states, trigger priority, or transient
 * ManyChat flow weirdness. This scheduled worker polls ManyChat's subscriber
 * API for recent known IG/FB threads and replays the latest user input through
 * manychat-inbound when Balance has not seen it yet.
 *
 * It is intentionally conservative:
 *   - only recent known ig_threads are polled
 *   - only the latest ManyChat last_input_text can be backfilled
 *   - synthetic message_id values make retries idempotent
 *   - manychat-inbound still owns storage, draft creation, coalescing, and push
 */

const crypto = require('crypto');

const {
    supabaseQuery,
    truncate,
} = require('./_lib/client-context');

const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN;
const MANYCHAT_API_BASE = process.env.MANYCHAT_API_BASE || 'https://api.manychat.com';
const MANYCHAT_WEBHOOK_SECRET = process.env.MANYCHAT_WEBHOOK_SECRET;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const LOOKBACK_DAYS = Number(process.env.MANYCHAT_RECONCILE_LOOKBACK_DAYS || 14);
const MAX_MESSAGE_AGE_HOURS = Number(process.env.MANYCHAT_RECONCILE_MAX_MESSAGE_AGE_HOURS || 48);
const CANDIDATE_LIMIT = Number(process.env.MANYCHAT_RECONCILE_LIMIT || 60);
const MAX_BACKFILLS_PER_RUN = Number(process.env.MANYCHAT_RECONCILE_MAX_BACKFILLS || 6);
const MANYCHAT_GETINFO_GAP_MS = Number(process.env.MANYCHAT_RECONCILE_GAP_MS || 140);
const CLOCK_SKEW_MS = 90 * 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseDate(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return null;
    return new Date(time);
}

function fingerprint(value) {
    return crypto
        .createHash('sha1')
        .update(String(value || ''), 'utf8')
        .digest('hex')
        .slice(0, 16);
}

function syntheticMessageId({ channel, subscriberId, lastInteraction, text }) {
    const ts = lastInteraction.toISOString();
    return `manychat_reconcile:${channel}:${subscriberId}:${ts}:${fingerprint(text)}`;
}

async function manychatGetInfo(subscriberId) {
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
    if (!response.ok || parsed?.status === 'error') {
        const message = parsed?.message || text || `HTTP ${response.status}`;
        throw new Error(`ManyChat getInfo ${subscriberId} failed: ${message.slice(0, 240)}`);
    }
    return parsed?.data || null;
}

async function loadRecentThreads() {
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const encodedCutoff = encodeURIComponent(cutoff);
    return supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,last_inbound_at,last_outbound_at,created_at,updated_at` +
        `&subscriber_id=not.is.null` +
        `&lead_stage=neq.churned` +
        `&or=(last_inbound_at.gte.${encodedCutoff},last_outbound_at.gte.${encodedCutoff},created_at.gte.${encodedCutoff},updated_at.gte.${encodedCutoff})` +
        `&order=updated_at.desc.nullslast,last_inbound_at.desc.nullslast` +
        `&limit=${CANDIDATE_LIMIT}`
    );
}

async function hasSyntheticMessage(messageId) {
    const rows = await supabaseQuery(
        `ig_messages?select=id&manychat_message_id=eq.${encodeURIComponent(messageId)}&limit=1`
    );
    return rows.length > 0;
}

async function loadLatestInbound(threadId) {
    const rows = await supabaseQuery(
        `ig_messages?select=id,text,created_at&thread_id=eq.${threadId}&direction=eq.in&order=created_at.desc&limit=1`
    );
    return rows[0] || null;
}

function shouldBackfill({ thread, subscriber, latestInbound, syntheticId }) {
    const text = normalizeText(subscriber?.last_input_text);
    if (!text) return { ok: false, reason: 'empty_last_input_text' };

    const lastInteraction = parseDate(subscriber?.last_interaction);
    if (!lastInteraction) return { ok: false, reason: 'missing_last_interaction' };

    const maxAgeMs = MAX_MESSAGE_AGE_HOURS * 60 * 60 * 1000;
    if (Number.isFinite(maxAgeMs) && maxAgeMs > 0 && Date.now() - lastInteraction.getTime() > maxAgeMs) {
        return { ok: false, reason: 'last_interaction_too_old' };
    }

    const threadLastInbound = parseDate(thread.last_inbound_at);
    if (threadLastInbound && lastInteraction.getTime() <= threadLastInbound.getTime() + CLOCK_SKEW_MS) {
        return { ok: false, reason: 'already_current' };
    }

    if (latestInbound) {
        const latestCreated = parseDate(latestInbound.created_at);
        const sameText = normalizeText(latestInbound.text) === text;
        if (sameText && latestCreated && lastInteraction.getTime() <= latestCreated.getTime() + CLOCK_SKEW_MS) {
            return { ok: false, reason: 'latest_inbound_matches' };
        }
    }

    if (!syntheticId) return { ok: false, reason: 'missing_synthetic_id' };
    return { ok: true, reason: 'missed_latest_input', text, lastInteraction };
}

async function replayThroughInbound({ thread, subscriber, text, messageId }) {
    const body = {
        subscriber_id: String(thread.subscriber_id),
        ig_username: subscriber.ig_username || thread.ig_username || undefined,
        profile_name: subscriber.name || thread.profile_name || subscriber.ig_username || undefined,
        first_name: subscriber.first_name || undefined,
        last_name: subscriber.last_name || undefined,
        profile_pic_url: subscriber.profile_pic || undefined,
        message: text,
        message_id: messageId,
        channel: thread.channel || 'instagram',
    };

    const headers = { 'Content-Type': 'application/json' };
    if (MANYCHAT_WEBHOOK_SECRET) headers['x-manychat-secret'] = MANYCHAT_WEBHOOK_SECRET;

    const response = await fetch(`${SITE_URL}/.netlify/functions/manychat-inbound`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`manychat-inbound replay failed ${response.status}: ${responseText.slice(0, 240)}`);
    }
    return responseText ? JSON.parse(responseText) : {};
}

exports.handler = async () => {
    const startedAt = Date.now();
    if (!MANYCHAT_API_TOKEN) {
        console.warn('[manychat-reconcile] MANYCHAT_API_TOKEN not configured');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'missing_manychat_token' }) };
    }

    let threads = [];
    try {
        threads = await loadRecentThreads();
    } catch (error) {
        console.error('[manychat-reconcile] thread query failed:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'thread_query_failed', details: error.message }) };
    }

    let checked = 0;
    let skipped = 0;
    let backfilled = 0;
    let failed = 0;
    const failures = [];

    for (const thread of threads) {
        if (backfilled >= MAX_BACKFILLS_PER_RUN) break;
        const subscriberId = String(thread.subscriber_id || '').trim();
        if (!subscriberId) {
            skipped++;
            continue;
        }
        if (!/^\d+$/.test(subscriberId)) {
            skipped++;
            continue;
        }
        if (checked > 0 && MANYCHAT_GETINFO_GAP_MS > 0) {
            await sleep(MANYCHAT_GETINFO_GAP_MS);
        }
        checked++;

        try {
            const subscriber = await manychatGetInfo(subscriberId);
            const text = normalizeText(subscriber?.last_input_text);
            const lastInteraction = parseDate(subscriber?.last_interaction);
            const messageId = text && lastInteraction
                ? syntheticMessageId({
                    channel: thread.channel || 'instagram',
                    subscriberId,
                    lastInteraction,
                    text,
                })
                : null;

            if (messageId && await hasSyntheticMessage(messageId)) {
                skipped++;
                continue;
            }

            const latestInbound = await loadLatestInbound(thread.id);
            const decision = shouldBackfill({ thread, subscriber, latestInbound, syntheticId: messageId });
            if (!decision.ok) {
                skipped++;
                continue;
            }

            await replayThroughInbound({
                thread,
                subscriber,
                text: decision.text,
                messageId,
            });
            backfilled++;
            console.log(
                `[manychat-reconcile] backfilled ${thread.channel || 'instagram'} ${subscriberId} ` +
                `(${thread.ig_username || subscriber?.ig_username || 'unknown'}): "${truncate(decision.text, 120)}"`
            );
        } catch (error) {
            failed++;
            failures.push({
                subscriber_id: subscriberId,
                thread_id: thread.id,
                error: truncate(error.message || String(error), 180),
            });
            console.warn('[manychat-reconcile] candidate failed:', subscriberId, error.message);
        }
    }

    const result = {
        checked_at: new Date().toISOString(),
        candidates: threads.length,
        checked,
        skipped,
        backfilled,
        failed,
        failures: failures.slice(0, 5),
        elapsed_ms: Date.now() - startedAt,
    };

    return { statusCode: failed > 0 && backfilled === 0 ? 207 : 200, body: JSON.stringify(result) };
};
