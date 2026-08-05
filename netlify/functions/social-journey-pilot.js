const {
    ALLOWED_INSTAGRAM_HANDLES,
    SHANNON_EMAIL,
    SHANNON_USER_ID,
    buildReceipt,
    buildReminderMessage,
    chooseThread,
    hasGraphRecipient,
    isInsideStandardMessagingWindow,
    isShannonUser,
    loadAllowedThreads,
    loadJourney,
    patchJourney,
    publicJourneyState,
    safeObject,
    withReceipt,
} = require('./_lib/social-journey');
const { SUPABASE_SERVICE_KEY, SUPABASE_URL } = require('./_lib/client-context');
const directMessage = require('./send-direct-ig-message');

function json(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
        body: JSON.stringify(body),
    };
}

async function authenticatedPilotUser(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = String(auth).replace(/^Bearer\s+/i, '').trim();
    if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = await response.json().catch(() => null);
    return isShannonUser(user) ? user : null;
}

async function candidateResponse() {
    const rows = await loadAllowedThreads();
    const candidates = [...ALLOWED_INSTAGRAM_HANDLES].map(username => {
        const thread = chooseThread(rows, username);
        return thread ? {
            username,
            profile_name: thread.profile_name || username,
            send_ready: hasGraphRecipient(thread) && isInsideStandardMessagingWindow(thread.last_inbound_at),
            last_inbound_at: thread.last_inbound_at || null,
        } : null;
    }).filter(Boolean);
    return { ok: true, candidates };
}

async function connectInstagram(username) {
    const handle = String(username || '').trim().toLowerCase();
    if (!ALLOWED_INSTAGRAM_HANDLES.has(handle)) return json(400, { error: 'That Instagram test conversation is not eligible.' });
    const thread = chooseThread(await loadAllowedThreads(handle), handle);
    if (!thread) return json(404, { error: 'That Instagram test conversation could not be found.' });
    const journey = await loadJourney();
    const settings = {
        ...safeObject(journey?.settings),
        instagram_username: handle,
        instagram_thread_id: thread.id,
        instagram_reminders_enabled: true,
        instagram_connected_at: new Date().toISOString(),
    };
    const updated = await patchJourney({ settings });
    return json(200, {
        ok: true,
        send_ready: hasGraphRecipient(thread) && isInsideStandardMessagingWindow(thread.last_inbound_at),
        state: publicJourneyState(updated),
    });
}

async function disconnectInstagram() {
    const journey = await loadJourney();
    const settings = {
        ...safeObject(journey?.settings),
        instagram_username: null,
        instagram_thread_id: null,
        instagram_reminders_enabled: false,
        instagram_disconnected_at: new Date().toISOString(),
    };
    const updated = await patchJourney({ settings });
    return json(200, { ok: true, state: publicJourneyState(updated) });
}

async function sendTestReminder(event) {
    const journey = await loadJourney();
    const settings = safeObject(journey?.settings);
    if (!journey || !settings.instagram_reminders_enabled || !settings.instagram_thread_id) {
        return json(409, { error: 'Connect an eligible Instagram reminder conversation first.' });
    }
    const rows = await loadAllowedThreads(settings.instagram_username);
    const thread = rows.find(row => row.id === settings.instagram_thread_id) || null;
    if (!thread || !isInsideStandardMessagingWindow(thread.last_inbound_at)) {
        return json(409, { error: 'Send Balance a fresh Instagram DM first. Meta only allows this automatic reminder inside the current 24-hour messaging window.' });
    }
    const message = buildReminderMessage(journey);
    const result = await directMessage.handler({
        ...event,
        httpMethod: 'POST',
        body: JSON.stringify({ threadId: thread.id, message }),
    });
    const payload = JSON.parse(result.body || '{}');
    if (result.statusCode < 200 || result.statusCode >= 300) {
        return json(result.statusCode, { error: payload.error || payload.details || 'The Instagram reminder could not be sent.' });
    }
    const receipt = buildReceipt({ journey, kind: `test-${Date.now()}`, status: 'sent', threadId: thread.id, message });
    const updated = await patchJourney({ reminder_receipts: withReceipt(journey, receipt) });
    return json(200, { ok: true, message: 'Test Instagram reminder sent.', state: publicJourneyState(updated) });
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    let user;
    try { user = await authenticatedPilotUser(event); } catch (_) { user = null; }
    if (!user || user.id !== SHANNON_USER_ID || String(user.email || '').toLowerCase() !== SHANNON_EMAIL) {
        return json(403, { error: 'This pilot is private.' });
    }
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch (_) { return json(400, { error: 'Invalid JSON' }); }
    try {
        if (body.action === 'candidates') return json(200, await candidateResponse());
        if (body.action === 'connect_instagram') return connectInstagram(body.username);
        if (body.action === 'disconnect_instagram') return disconnectInstagram();
        if (body.action === 'send_test_reminder') return sendTestReminder(event);
        return json(400, { error: 'Unknown pilot action.' });
    } catch (error) {
        console.error('[social-journey-pilot]', error);
        return json(500, { error: 'The social journey action could not be completed.' });
    }
};

exports._test = { authenticatedPilotUser, candidateResponse, connectInstagram, disconnectInstagram };
