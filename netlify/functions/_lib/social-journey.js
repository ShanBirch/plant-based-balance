const { supabaseQuery } = require('./client-context');

const SHANNON_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const JOURNEY_VERSION = 'social_identity_v1';
const ALLOWED_INSTAGRAM_HANDLES = new Set(['cocos_pt_studio', 'goldcoast_ai_solutions']);
const IG_THREAD_SELECT = 'id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,custom_data';

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function isShannonUser(user) {
    return String(user?.id || '') === SHANNON_USER_ID
        && String(user?.email || '').trim().toLowerCase() === SHANNON_EMAIL;
}

function hoursSince(value, nowMs = Date.now()) {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return null;
    return (nowMs - timestamp) / (60 * 60 * 1000);
}

function isInsideStandardMessagingWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSince(lastInboundAt, nowMs);
    return hours !== null && hours >= 0 && hours <= 24;
}

function hasGraphRecipient(thread) {
    const customData = safeObject(thread?.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const subscriberId = String(thread?.subscriber_id || '');
    return !!(
        graph.ig_graph_user_id
        || graph.recipient_id
        || customData.ig_graph_user_id
        || subscriberId.startsWith('ig_graph:')
        || subscriberId.startsWith('meta_ig:')
    );
}

function firstIncompleteTask(progressSnapshot) {
    return safeArray(safeObject(progressSnapshot).tasks).find(task => !task?.complete) || null;
}

function buildReminderMessage(journey) {
    const week = Math.max(1, Math.min(12, Number(journey?.current_week) || 1));
    const task = firstIncompleteTask(journey?.progress_snapshot);
    const taskLabel = String(task?.label || 'one small journey goal').trim().slice(0, 90);
    return `Quick Journey Goals check-in: Week ${week} still has "${taskLabel}" open. One small rep is enough. Open Balance when you're ready.`;
}

function buildReceipt({ journey, kind, status, threadId, message, detail = '' }) {
    const week = Math.max(1, Math.min(12, Number(journey?.current_week) || 1));
    const started = String(journey?.week_started_at || 'unknown');
    return {
        id: `${kind}:${JOURNEY_VERSION}:w${week}:${started}`,
        kind,
        status,
        journey_week: week,
        week_started_at: started,
        thread_id: threadId || null,
        message: String(message || '').slice(0, 300),
        detail: String(detail || '').slice(0, 240),
        created_at: new Date().toISOString(),
    };
}

function withReceipt(journey, receipt) {
    return safeArray(journey?.reminder_receipts)
        .filter(item => item?.id !== receipt.id)
        .concat(receipt)
        .slice(-40);
}

function hasReceipt(journey, receiptId, status = 'sent') {
    return safeArray(journey?.reminder_receipts)
        .some(item => item?.id === receiptId && (!status || item?.status === status));
}

function publicJourneyState(row) {
    if (!row) return null;
    const settings = safeObject(row.settings);
    return {
        user_id: row.user_id,
        journey_version: row.journey_version,
        current_week: row.current_week,
        week_started_at: row.week_started_at,
        onboarding_complete: row.onboarding_complete,
        completed_task_ids: safeArray(row.completed_task_ids),
        progress_snapshot: safeObject(row.progress_snapshot),
        settings: {
            instagram_username: settings.instagram_username || null,
            instagram_thread_id: settings.instagram_thread_id || null,
            instagram_reminders_enabled: !!settings.instagram_reminders_enabled,
            instagram_connected_at: settings.instagram_connected_at || null,
        },
        reminder_receipts: safeArray(row.reminder_receipts),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function loadJourney() {
    const rows = await supabaseQuery(
        `social_journey_progress?select=*&user_id=eq.${encodeURIComponent(SHANNON_USER_ID)}&limit=1`
    );
    return rows[0] || null;
}

async function patchJourney(patch) {
    const rows = await supabaseQuery(
        `social_journey_progress?user_id=eq.${encodeURIComponent(SHANNON_USER_ID)}`,
        { method: 'PATCH', body: patch, prefer: 'return=representation' }
    );
    if (rows[0]) return rows[0];
    const inserted = await supabaseQuery('social_journey_progress?on_conflict=user_id', {
        method: 'POST',
        body: [{ user_id: SHANNON_USER_ID, journey_version: JOURNEY_VERSION, ...patch }],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return inserted[0] || null;
}

async function loadAllowedThreads(username = '') {
    const handle = String(username || '').trim().toLowerCase();
    if (handle && !ALLOWED_INSTAGRAM_HANDLES.has(handle)) return [];
    const filter = handle
        ? `ig_username=eq.${encodeURIComponent(handle)}`
        : 'ig_username=in.(cocos_pt_studio,goldcoast_ai_solutions)';
    return supabaseQuery(
        `ig_threads?select=${IG_THREAD_SELECT}&channel=eq.instagram&${filter}&order=last_inbound_at.desc.nullslast&limit=30`
    );
}

function chooseThread(rows, username) {
    const handle = String(username || '').trim().toLowerCase();
    return safeArray(rows)
        .filter(row => String(row?.ig_username || '').trim().toLowerCase() === handle)
        .sort((a, b) => {
            const aReady = isInsideStandardMessagingWindow(a?.last_inbound_at) && hasGraphRecipient(a) ? 1 : 0;
            const bReady = isInsideStandardMessagingWindow(b?.last_inbound_at) && hasGraphRecipient(b) ? 1 : 0;
            if (aReady !== bReady) return bReady - aReady;
            return Date.parse(b?.last_inbound_at || 0) - Date.parse(a?.last_inbound_at || 0);
        })[0] || null;
}

module.exports = {
    ALLOWED_INSTAGRAM_HANDLES,
    IG_THREAD_SELECT,
    JOURNEY_VERSION,
    SHANNON_EMAIL,
    SHANNON_USER_ID,
    buildReceipt,
    buildReminderMessage,
    chooseThread,
    firstIncompleteTask,
    hasReceipt,
    hasGraphRecipient,
    hoursSince,
    isInsideStandardMessagingWindow,
    isShannonUser,
    loadAllowedThreads,
    loadJourney,
    patchJourney,
    publicJourneyState,
    safeArray,
    safeObject,
    withReceipt,
};
