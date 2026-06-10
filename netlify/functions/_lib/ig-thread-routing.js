const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const LEGACY_GRAPH_SUBSCRIBER_PREFIX = 'meta_ig:';

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstString(candidates = []) {
    return candidates.map(value => String(value || '').trim()).find(Boolean) || '';
}

function uniqueStrings(values = []) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function graphSubscriberParts(subscriberId = '') {
    const raw = String(subscriberId || '').trim();
    const prefix = raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)
        ? GRAPH_SUBSCRIBER_PREFIX
        : (raw.startsWith(LEGACY_GRAPH_SUBSCRIBER_PREFIX) ? LEGACY_GRAPH_SUBSCRIBER_PREFIX : '');
    if (!prefix) return { accountId: '', recipientId: '' };
    const suffix = raw.slice(prefix.length);
    const parts = suffix.split(':').filter(Boolean);
    if (parts.length >= 2) {
        return { accountId: parts[0], recipientId: parts[parts.length - 1] };
    }
    return { accountId: '', recipientId: suffix };
}

function graphRecipientFromSubscriberId(value) {
    return graphSubscriberParts(value).recipientId;
}

function graphAccountFromSubscriberId(value) {
    return graphSubscriberParts(value).accountId;
}

function resolveThreadGraphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return firstString([
        graph.ig_graph_user_id,
        graph.recipient_id,
        customData.ig_graph_user_id,
        thread.ig_graph_recipient_id,
        graphRecipientFromSubscriberId(thread.subscriber_id),
    ]);
}

function resolveThreadGraphAccountId(thread = {}, fallback = '') {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return firstString([
        graph.ig_account_id,
        graph.account_id,
        graph.owner_id,
        customData.ig_graph_account_id,
        customData.ig_account_id,
        customData.owner_ig_user_id,
        graphAccountFromSubscriberId(thread.subscriber_id),
        fallback,
    ]);
}

function mergedIntoThreadId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    return firstString([
        customData.merged_into_ig_thread_id,
        customData.merged_into_thread_id,
    ]);
}

function isMergedThread(thread = {}) {
    return !!mergedIntoThreadId(thread);
}

function hoursSinceIso(value, nowMs = Date.now()) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

function isStandardMessagingWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours <= 24;
}

function isHumanAgentWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours > 24 && hours <= 24 * 7;
}

function isGraphDeliveryWindowOpen(thread = {}, { humanAgentEnabled = false, nowMs = Date.now() } = {}) {
    if (isStandardMessagingWindow(thread.last_inbound_at, nowMs)) return true;
    return humanAgentEnabled && isHumanAgentWindow(thread.last_inbound_at, nowMs);
}

function arrayFromValue(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        return value.split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
    }
    return [];
}

function relatedThreadIdsFromCustomData(thread = {}) {
    const customData = safeObject(thread.custom_data);
    return uniqueStrings([
        mergedIntoThreadId(thread),
        ...arrayFromValue(customData.alternate_ig_thread_ids),
        ...arrayFromValue(customData.alternate_thread_ids),
        ...arrayFromValue(customData.related_ig_thread_ids),
        ...arrayFromValue(customData.related_thread_ids),
        ...arrayFromValue(customData.same_person_ig_thread_ids),
        ...arrayFromValue(customData.same_person_thread_ids),
        ...arrayFromValue(customData.linked_ig_thread_ids),
        ...arrayFromValue(customData.linked_thread_ids),
        ...arrayFromValue(customData.sibling_ig_thread_ids),
        ...arrayFromValue(customData.sibling_thread_ids),
    ]).filter(id => id !== String(thread.id || ''));
}

function threadFreshnessMs(thread = {}) {
    const inbound = Date.parse(thread.last_inbound_at || '');
    const outbound = Date.parse(thread.last_outbound_at || '');
    return Math.max(Number.isFinite(inbound) ? inbound : 0, Number.isFinite(outbound) ? outbound : 0);
}

function isUsableInstagramGraphThread(thread = {}, options = {}) {
    return String(thread.channel || '').toLowerCase() === 'instagram'
        && !isMergedThread(thread)
        && !!resolveThreadGraphRecipientId(thread)
        && isGraphDeliveryWindowOpen(thread, options);
}

function describeThread(thread = {}) {
    return {
        id: thread.id || null,
        ig_username: thread.ig_username || null,
        profile_name: thread.profile_name || null,
        linked_user_id: thread.linked_user_id || null,
        last_inbound_at: thread.last_inbound_at || null,
        delivery_channel: resolveThreadGraphRecipientId(thread) ? 'instagram_graph' : null,
    };
}

function buildAlternateIgDeliveryData(resolution = {}) {
    if (!resolution.used) return {};
    return {
        requested_ig_thread_id: resolution.requestedThreadId || null,
        sent_ig_thread_id: resolution.thread?.id || null,
        alternate_ig_delivery: {
            used: true,
            reason: resolution.reason || 'same_person_fresh_thread',
            requested_thread: describeThread(resolution.requestedThread || {}),
            delivered_thread: describeThread(resolution.thread || {}),
            considered_threads: (resolution.consideredThreads || []).map(describeThread),
        },
    };
}

async function loadThreadsByIds(ids = [], { supabaseQuery, selectColumns, loggerPrefix = 'ig-thread-routing' } = {}) {
    const cleanIds = uniqueStrings(ids);
    if (!cleanIds.length || typeof supabaseQuery !== 'function') return [];
    try {
        return await supabaseQuery(
            `ig_threads?select=${selectColumns}&id=in.(${cleanIds.map(encodeURIComponent).join(',')})&limit=${Math.min(cleanIds.length, 50)}`
        );
    } catch (err) {
        console.warn(`[${loggerPrefix}] related thread lookup failed:`, err.message || err);
        return [];
    }
}

async function loadThreadsByLinkedUserId(linkedUserId, { supabaseQuery, selectColumns, loggerPrefix = 'ig-thread-routing' } = {}) {
    const id = String(linkedUserId || '').trim();
    if (!id || typeof supabaseQuery !== 'function') return [];
    try {
        return await supabaseQuery(
            `ig_threads?select=${selectColumns}&linked_user_id=eq.${encodeURIComponent(id)}&channel=eq.instagram&order=last_inbound_at.desc.nullslast&limit=25`
        );
    } catch (err) {
        console.warn(`[${loggerPrefix}] linked-user thread lookup failed:`, err.message || err);
        return [];
    }
}

function dedupeThreads(threads = []) {
    const seen = new Set();
    const out = [];
    for (const thread of threads) {
        const id = String(thread?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(thread);
    }
    return out;
}

function sortDeliveryCandidates(threads = [], options = {}) {
    return [...threads].sort((a, b) => {
        const aOpen = isUsableInstagramGraphThread(a, options) ? 1 : 0;
        const bOpen = isUsableInstagramGraphThread(b, options) ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return threadFreshnessMs(b) - threadFreshnessMs(a);
    });
}

async function resolveAlternateIgDeliveryThread({
    thread,
    supabaseQuery,
    selectColumns = 'id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,custom_data',
    humanAgentEnabled = false,
    nowMs = Date.now(),
    loggerPrefix = 'ig-thread-routing',
} = {}) {
    const requestedThread = thread || null;
    if (!requestedThread?.id) {
        return { thread: requestedThread, used: false, reason: 'thread_missing', consideredThreads: [] };
    }

    const options = { humanAgentEnabled, nowMs };
    const relatedIds = relatedThreadIdsFromCustomData(requestedThread);
    const [linkedThreads, relatedThreads] = await Promise.all([
        loadThreadsByLinkedUserId(requestedThread.linked_user_id, { supabaseQuery, selectColumns, loggerPrefix }),
        loadThreadsByIds(relatedIds, { supabaseQuery, selectColumns, loggerPrefix }),
    ]);
    const candidates = sortDeliveryCandidates(dedupeThreads([
        requestedThread,
        ...(linkedThreads || []),
        ...(relatedThreads || []),
    ]), options);

    const selected = candidates.find(candidate => isUsableInstagramGraphThread(candidate, options)) || requestedThread;
    const used = !!selected?.id && selected.id !== requestedThread.id;
    return {
        thread: selected,
        requestedThread,
        requestedThreadId: requestedThread.id,
        used,
        reason: used
            ? (requestedThread.linked_user_id ? 'linked_user_fresh_ig_thread' : 'related_fresh_ig_thread')
            : (isUsableInstagramGraphThread(requestedThread, options) ? 'current_thread_sendable' : 'no_alternate_thread_sendable'),
        consideredThreads: candidates,
    };
}

module.exports = {
    GRAPH_SUBSCRIBER_PREFIX,
    LEGACY_GRAPH_SUBSCRIBER_PREFIX,
    buildAlternateIgDeliveryData,
    graphAccountFromSubscriberId,
    graphRecipientFromSubscriberId,
    graphSubscriberParts,
    hoursSinceIso,
    isGraphDeliveryWindowOpen,
    isHumanAgentWindow,
    isMergedThread,
    isStandardMessagingWindow,
    isUsableInstagramGraphThread,
    mergedIntoThreadId,
    relatedThreadIdsFromCustomData,
    resolveAlternateIgDeliveryThread,
    resolveThreadGraphAccountId,
    resolveThreadGraphRecipientId,
    _test: {
        arrayFromValue,
        dedupeThreads,
        describeThread,
        sortDeliveryCandidates,
        threadFreshnessMs,
    },
};
