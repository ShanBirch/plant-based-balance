const { supabaseQuery } = require('./_lib/client-context');
const {
    SHANNON_USER_ID,
    buildReceipt,
    buildReminderMessage,
    hasReceipt,
    isInsideStandardMessagingWindow,
    loadAllowedThreads,
    loadJourney,
    patchJourney,
    safeObject,
    withReceipt,
} = require('./_lib/social-journey');
const directMessage = require('./send-direct-ig-message')._test;

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function brisbaneDateKey(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).reduce((out, item) => {
        if (item.type !== 'literal') out[item.type] = item.value;
        return out;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysBetweenDateKeys(start, end) {
    const a = Date.parse(`${start}T00:00:00Z`);
    const b = Date.parse(`${end}T00:00:00Z`);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86400000) : 0;
}

function scheduledReceiptId(journey) {
    return `scheduled:social_identity_v1:w${journey.current_week}:${journey.week_started_at}`;
}

async function runReminderScan(now = new Date()) {
    const journey = await loadJourney();
    if (!journey || journey.user_id !== SHANNON_USER_ID || !journey.onboarding_complete) return { ok: true, skipped: 'pilot_not_active' };
    const settings = safeObject(journey.settings);
    if (!settings.instagram_reminders_enabled || !settings.instagram_thread_id || !settings.instagram_username) {
        return { ok: true, skipped: 'instagram_reminders_off' };
    }
    if (daysBetweenDateKeys(journey.week_started_at, brisbaneDateKey(now)) < 4) return { ok: true, skipped: 'too_early_in_week' };
    if (!Array.isArray(journey.progress_snapshot?.tasks) || journey.progress_snapshot.tasks.every(task => task?.complete)) {
        return { ok: true, skipped: 'no_open_goal' };
    }
    const receiptId = scheduledReceiptId(journey);
    if (hasReceipt(journey, receiptId, 'sent')) return { ok: true, skipped: 'already_sent' };

    const rows = await loadAllowedThreads(settings.instagram_username);
    const thread = rows.find(row => row.id === settings.instagram_thread_id) || null;
    if (!thread) return { ok: true, skipped: 'thread_not_found' };
    if (!isInsideStandardMessagingWindow(thread.last_inbound_at, now.getTime())) {
        return { ok: true, skipped: 'outside_24_hour_window' };
    }
    const delivery = directMessage.resolveDirectTransport(thread);
    if (!delivery.ok || delivery.transport !== 'instagram_graph') return { ok: true, skipped: 'graph_transport_unavailable' };

    const message = buildReminderMessage(journey);
    const response = await directMessage.postToInstagramGraph({
        recipientId: delivery.recipientId,
        accountId: delivery.accountId,
        text: message,
        tag: '',
    });
    const sentAt = now.toISOString();
    const graphMessageId = directMessage.graphMessageIdFromResponse(response);
    await supabaseQuery('ig_messages', {
        method: 'POST',
        body: [{
            thread_id: thread.id,
            direction: 'out',
            text: message,
            source: 'social_journey_reminder',
            manychat_message_id: graphMessageId ? `ig_graph:${graphMessageId}` : null,
        }],
        prefer: 'return=minimal',
    });
    const customData = safeObject(thread.custom_data);
    const graphData = safeObject(customData.instagram_graph);
    await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: {
            last_outbound_at: sentAt,
            custom_data: {
                ...customData,
                instagram_graph: {
                    ...graphData,
                    last_send_at: sentAt,
                    last_send_source: 'social_journey_reminder',
                    last_sent_graph_message_ids: graphMessageId ? [graphMessageId] : [],
                },
            },
        },
        prefer: 'return=minimal',
    });
    const receipt = buildReceipt({ journey, kind: 'scheduled', status: 'sent', threadId: thread.id, message });
    await patchJourney({ reminder_receipts: withReceipt(journey, receipt) });
    return { ok: true, sent: true, week: journey.current_week, username: settings.instagram_username };
}

exports.handler = async (event = {}) => {
    const scheduleHeader = String(event?.headers?.['x-nf-event'] || event?.headers?.['X-Nf-Event'] || '').toLowerCase();
    if (scheduleHeader !== 'schedule') return json(403, { ok: false, error: 'Scheduled invocation required.' });
    try { return json(200, await runReminderScan()); }
    catch (error) {
        console.error('[social-journey-reminder-scan]', error);
        return json(500, { ok: false, error: 'Social journey reminder scan failed.' });
    }
};

exports._test = { brisbaneDateKey, daysBetweenDateKeys, runReminderScan, scheduledReceiptId };
