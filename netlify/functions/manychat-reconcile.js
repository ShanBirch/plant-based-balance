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
 *   - scheduled runs page through recent known ig_threads in small batches
 *   - only the latest ManyChat last_input_text can be backfilled
 *   - synthetic message_id values make retries idempotent
 *   - manychat-inbound still owns storage, draft creation, coalescing, and push
 *
 * Manual rescue:
 *   POST { "search_name": "Kayla Ackroyd" } with Shannon admin auth, or the
 *   ManyChat webhook secret header, to find a contact by exact ManyChat name
 *   and replay their latest input even when Balance never created a thread.
 */

const crypto = require('crypto');

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    truncate,
} = require('./_lib/client-context');

const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN;
const MANYCHAT_API_BASE = process.env.MANYCHAT_API_BASE || 'https://api.manychat.com';
const MANYCHAT_WEBHOOK_SECRET = process.env.MANYCHAT_WEBHOOK_SECRET;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const LOOKBACK_DAYS = Number(process.env.MANYCHAT_RECONCILE_LOOKBACK_DAYS || 14);
const MAX_MESSAGE_AGE_HOURS = Number(process.env.MANYCHAT_RECONCILE_MAX_MESSAGE_AGE_HOURS || 48);
const CANDIDATE_LIMIT = readInt(process.env.MANYCHAT_RECONCILE_LIMIT, 18, 1, 60);
const MAX_BACKFILLS_PER_RUN = Number(process.env.MANYCHAT_RECONCILE_MAX_BACKFILLS || 6);
const MANYCHAT_GETINFO_GAP_MS = readInt(process.env.MANYCHAT_RECONCILE_GAP_MS, 80, 0, 2000);
const MAX_RUNTIME_MS = readInt(process.env.MANYCHAT_RECONCILE_MAX_RUNTIME_MS, 18000, 5000, 240000);
const PAGE_COUNT = readInt(process.env.MANYCHAT_RECONCILE_PAGE_COUNT, 3, 1, 12);
const NAME_SEARCH_RESULT_LIMIT = readInt(process.env.MANYCHAT_RECONCILE_NAME_RESULT_LIMIT, 5, 1, 20);
const MANYCHAT_REQUEST_TIMEOUT_MS = readInt(process.env.MANYCHAT_RECONCILE_REQUEST_TIMEOUT_MS, 6000, 1000, 30000);
const INBOUND_REPLAY_TIMEOUT_MS = readInt(process.env.MANYCHAT_RECONCILE_REPLAY_TIMEOUT_MS, 8000, 1000, 30000);
const CLOCK_SKEW_MS = 90 * 1000;
const RUN_INTERVAL_MS = 5 * 60 * 1000;
const SHANNON_ADMIN_EMAILS = new Set([
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
    'shannon@plantbasedbalance.com',
    'shannon.birch@cocospersonaltraining.com',
]);

function readInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = MANYCHAT_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparableText(value) {
    return normalizeText(value)
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\uFFFC/g, '')
        .replace(/\[(?:PHOTO|AUDIO|VIDEO):\s*https?:\/\/[^\]\s]+\]/gi, '[media]')
        .replace(/https?:\/\/(?:lookaside\.fbsbx\.com|scontent[\w.-]*\.fbcdn\.net|cdn\.fbsbx\.com)\/\S+/gi, '[media]')
        .trim();
}

function parseDate(value) {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return null;
    return new Date(time);
}

function response(statusCode, body) {
    return { statusCode, body: JSON.stringify(body) };
}

function getHeader(headers, name) {
    const lower = String(name || '').toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function parseJsonBody(event) {
    if (!event?.body) return {};
    try {
        return JSON.parse(event.body);
    } catch {
        return {};
    }
}

function splitNameQueries(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
    const seen = new Set();
    const names = [];
    for (const item of raw) {
        const name = String(item || '').replace(/\s+/g, ' ').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(name);
        if (names.length >= 5) break;
    }
    return names;
}

function getNameQueries(event, body) {
    const query = event?.queryStringParameters || {};
    return [
        ...splitNameQueries(body.search_name || body.searchName || body.name || body.names),
        ...splitNameQueries(query.search_name || query.searchName || query.name),
    ];
}

function getRequestedPage(event, startedAt) {
    const query = event?.queryStringParameters || {};
    const body = parseJsonBody(event);
    const requested = Number(body.page ?? query.page);
    if (Number.isFinite(requested) && requested >= 0) {
        return Math.floor(requested) % PAGE_COUNT;
    }
    return Math.floor(startedAt / RUN_INTERVAL_MS) % PAGE_COUNT;
}

function normalizeChannel(value, subscriber = {}) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'messenger' || raw === 'facebook' || raw === 'fb') return 'messenger';
    if (raw === 'instagram' || raw === 'ig') return 'instagram';
    return subscriber.ig_username ? 'instagram' : 'messenger';
}

function fingerprint(value) {
    return crypto
        .createHash('sha1')
        .update(String(value || ''), 'utf8')
        .digest('hex')
        .slice(0, 16);
}

function syntheticMessageId({ channel, subscriberId, lastInteraction, text }) {
    const ts = lastInteraction ? lastInteraction.toISOString() : 'missing-last-interaction';
    return `manychat_reconcile:${channel}:${subscriberId}:${ts}:${fingerprint(text)}`;
}

async function manychatGetInfo(subscriberId) {
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`;
    const response = await fetchWithTimeout(url, {
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

async function manychatFindByName(name) {
    const url = `${MANYCHAT_API_BASE}/fb/subscriber/findByName?name=${encodeURIComponent(name)}`;
    const response = await fetchWithTimeout(url, {
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
        throw new Error(`ManyChat findByName "${name}" failed: ${message.slice(0, 240)}`);
    }
    return Array.isArray(parsed?.data) ? parsed.data : [];
}

async function loadRecentThreads(pageIndex = 0) {
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const encodedCutoff = encodeURIComponent(cutoff);
    const offset = Math.max(0, pageIndex) * CANDIDATE_LIMIT;
    return supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,last_inbound_at,last_outbound_at,created_at,updated_at` +
        `&subscriber_id=not.is.null` +
        `&lead_stage=neq.churned` +
        `&or=(last_inbound_at.gte.${encodedCutoff},last_outbound_at.gte.${encodedCutoff},created_at.gte.${encodedCutoff},updated_at.gte.${encodedCutoff})` +
        `&order=updated_at.desc.nullslast,last_inbound_at.desc.nullslast` +
        `&limit=${CANDIDATE_LIMIT}&offset=${offset}`
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

async function loadKnownThreadForSubscriber({ subscriberId, channel, igUsername }) {
    let rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,last_inbound_at,last_outbound_at,created_at,updated_at` +
        `&subscriber_id=eq.${encodeURIComponent(subscriberId)}` +
        `&channel=eq.${encodeURIComponent(channel)}` +
        `&limit=1`
    );
    if (rows[0]) return rows[0];

    const handle = String(igUsername || '').replace(/^@+/, '').trim();
    if (!handle) return null;
    rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,last_inbound_at,last_outbound_at,created_at,updated_at` +
        `&ig_username=ilike.${encodeURIComponent(handle)}` +
        `&channel=eq.${encodeURIComponent(channel)}` +
        `&order=last_inbound_at.desc.nullslast,updated_at.desc.nullslast` +
        `&limit=5`
    );
    return rows.find(t => String(t.ig_username || '').toLowerCase() === handle.toLowerCase()) || null;
}

function shouldBackfill({ thread, subscriber, latestInbound, syntheticId }) {
    const text = normalizeText(subscriber?.last_input_text);
    if (!text) return { ok: false, reason: 'empty_last_input_text' };

    const lastInteraction = parseDate(subscriber?.last_interaction);

    const maxAgeMs = MAX_MESSAGE_AGE_HOURS * 60 * 60 * 1000;
    if (lastInteraction && Number.isFinite(maxAgeMs) && maxAgeMs > 0 && Date.now() - lastInteraction.getTime() > maxAgeMs) {
        return { ok: false, reason: 'last_interaction_too_old' };
    }

    const threadLastInbound = parseDate(thread.last_inbound_at);
    if (lastInteraction && threadLastInbound && lastInteraction.getTime() <= threadLastInbound.getTime() + CLOCK_SKEW_MS) {
        return { ok: false, reason: 'already_current' };
    }

    if (latestInbound) {
        const latestCreated = parseDate(latestInbound.created_at);
        const sameText = normalizeComparableText(latestInbound.text) === normalizeComparableText(text);
        if (sameText && (!lastInteraction || (latestCreated && lastInteraction.getTime() <= latestCreated.getTime() + CLOCK_SKEW_MS))) {
            return { ok: false, reason: 'latest_inbound_matches' };
        }
    }

    if (!syntheticId) return { ok: false, reason: 'missing_synthetic_id' };
    return { ok: true, reason: 'missed_latest_input', text, lastInteraction };
}

async function replayThroughInbound({ thread, subscriber, text, messageId }) {
    const channel = normalizeChannel(thread?.channel, subscriber);
    const body = {
        subscriber_id: String(thread.subscriber_id),
        ig_username: subscriber.ig_username || thread.ig_username || undefined,
        profile_name: subscriber.name || thread.profile_name || subscriber.ig_username || undefined,
        first_name: subscriber.first_name || undefined,
        last_name: subscriber.last_name || undefined,
        profile_pic_url: subscriber.profile_pic || undefined,
        message: text,
        message_id: messageId,
        channel,
    };

    const headers = { 'Content-Type': 'application/json' };
    if (MANYCHAT_WEBHOOK_SECRET) headers['x-manychat-secret'] = MANYCHAT_WEBHOOK_SECRET;

    const response = await fetchWithTimeout(`${SITE_URL}/.netlify/functions/manychat-inbound`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    }, INBOUND_REPLAY_TIMEOUT_MS);
    const responseText = await response.text();
    if (!response.ok) {
        throw new Error(`manychat-inbound replay failed ${response.status}: ${responseText.slice(0, 240)}`);
    }
    return responseText ? JSON.parse(responseText) : {};
}

async function requireShannonAdmin(event) {
    if (MANYCHAT_WEBHOOK_SECRET && getHeader(event?.headers, 'x-manychat-secret') === MANYCHAT_WEBHOOK_SECRET) {
        return { ok: true, mode: 'webhook_secret' };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { response: response(500, { error: 'supabase_not_configured' }) };
    }

    const authHeader = getHeader(event?.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: response(401, { error: 'Unauthorized' }) };

    const res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${token}`,
        },
    }, 6000);
    if (!res.ok) return { response: response(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (!SHANNON_ADMIN_EMAILS.has(email)) return { response: response(403, { error: 'Forbidden' }) };
    return { ok: true, mode: 'admin_user', user };
}

async function reconcileKnownThreads({ startedAt, pageIndex }) {
    let threads = [];
    try {
        threads = await loadRecentThreads(pageIndex);
    } catch (error) {
        console.error('[manychat-reconcile] thread query failed:', error.message);
        return { statusCode: 500, body: { error: 'thread_query_failed', details: error.message } };
    }

    let checked = 0;
    let skipped = 0;
    let backfilled = 0;
    let failed = 0;
    let stoppedEarly = false;
    const failures = [];

    for (const thread of threads) {
        if (backfilled >= MAX_BACKFILLS_PER_RUN) break;
        if (Date.now() - startedAt >= MAX_RUNTIME_MS) {
            stoppedEarly = true;
            break;
        }
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
        if (Date.now() - startedAt >= MAX_RUNTIME_MS) {
            stoppedEarly = true;
            break;
        }
        checked++;

        try {
            const subscriber = await manychatGetInfo(subscriberId);
            const text = normalizeText(subscriber?.last_input_text);
            const lastInteraction = parseDate(subscriber?.last_interaction);
            const channel = normalizeChannel(thread.channel, subscriber);
            const messageId = text
                ? syntheticMessageId({
                    channel,
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

    const body = {
        mode: 'known_thread_page',
        checked_at: new Date().toISOString(),
        page: pageIndex,
        page_count: PAGE_COUNT,
        candidates: threads.length,
        checked,
        skipped,
        backfilled,
        failed,
        stopped_early: stoppedEarly,
        failures: failures.slice(0, 5),
        elapsed_ms: Date.now() - startedAt,
    };

    return { statusCode: failed > 0 && backfilled === 0 ? 207 : 200, body };
}

async function reconcileNameSearch({ startedAt, names }) {
    let searched = 0;
    let checked = 0;
    let skipped = 0;
    let backfilled = 0;
    let failed = 0;
    const failures = [];
    const contacts = [];

    for (const name of names) {
        searched++;
        let matches = [];
        try {
            matches = await manychatFindByName(name);
        } catch (error) {
            failed++;
            failures.push({ name, error: truncate(error.message || String(error), 180) });
            continue;
        }

        for (const subscriber of matches.slice(0, NAME_SEARCH_RESULT_LIMIT)) {
            const subscriberId = String(subscriber.id || subscriber.subscriber_id || '').trim();
            const contactName = subscriber.name || [subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') || '';
            const channel = normalizeChannel(subscriber.channel || subscriber.last_input_channel, subscriber);
            const text = normalizeText(subscriber.last_input_text);
            const result = {
                name,
                subscriber_id: subscriberId || null,
                contact_name: contactName || null,
                ig_username: subscriber.ig_username || null,
                channel,
                has_latest_input: !!text,
                backfilled: false,
                skipped: null,
            };
            contacts.push(result);

            if (!subscriberId) {
                skipped++;
                result.skipped = 'missing_subscriber_id';
                continue;
            }
            if (!text) {
                skipped++;
                result.skipped = 'empty_last_input_text';
                continue;
            }

            checked++;
            try {
                const lastInteraction = parseDate(subscriber.last_interaction);
                const messageId = syntheticMessageId({
                    channel,
                    subscriberId,
                    lastInteraction,
                    text,
                });
                if (await hasSyntheticMessage(messageId)) {
                    skipped++;
                    result.skipped = 'already_backfilled';
                    continue;
                }

                const thread = await loadKnownThreadForSubscriber({
                    subscriberId,
                    channel,
                    igUsername: subscriber.ig_username,
                });
                const latestInbound = thread ? await loadLatestInbound(thread.id) : null;
                const decision = shouldBackfill({
                    thread: thread || {},
                    subscriber,
                    latestInbound,
                    syntheticId: messageId,
                });
                if (!decision.ok) {
                    skipped++;
                    result.skipped = decision.reason;
                    continue;
                }

                const replayThread = thread || {
                    subscriber_id: subscriberId,
                    channel,
                    ig_username: subscriber.ig_username || null,
                    profile_name: contactName || subscriber.ig_username || null,
                };
                const replayResult = await replayThroughInbound({
                    thread: replayThread,
                    subscriber,
                    text: decision.text,
                    messageId,
                });
                backfilled++;
                result.backfilled = true;
                result.thread_id = replayResult.thread_id || thread?.id || null;
                result.lead_stage = replayResult.lead_stage || null;
            } catch (error) {
                failed++;
                result.skipped = 'failed';
                result.error = truncate(error.message || String(error), 180);
                failures.push({
                    name,
                    subscriber_id: subscriberId,
                    error: result.error,
                });
            }
        }
    }

    return {
        statusCode: failed > 0 && backfilled === 0 ? 207 : 200,
        body: {
            mode: 'name_search_rescue',
            checked_at: new Date().toISOString(),
            searched,
            checked,
            skipped,
            backfilled,
            failed,
            contacts,
            failures: failures.slice(0, 5),
            elapsed_ms: Date.now() - startedAt,
        },
    };
}

exports.handler = async (event = {}) => {
    const startedAt = Date.now();
    if (!MANYCHAT_API_TOKEN) {
        console.warn('[manychat-reconcile] MANYCHAT_API_TOKEN not configured');
        return response(200, { skipped: 'missing_manychat_token' });
    }

    const body = parseJsonBody(event);
    const names = getNameQueries(event, body);
    if (names.length > 0) {
        const auth = await requireShannonAdmin(event);
        if (auth.response) return auth.response;
        const result = await reconcileNameSearch({ startedAt, names });
        return response(result.statusCode, result.body);
    }

    const pageIndex = getRequestedPage(event, startedAt);
    const result = await reconcileKnownThreads({ startedAt, pageIndex });
    return response(result.statusCode, result.body);
};
