// Direct Facebook Page messaging intake. No ManyChat account or API is used.
const { supabaseQuery, insertCoachAlert } = require('./_lib/client-context');
const { configuredPageIds, verifyMessengerSignature, normalizeMessengerEvents, mergeMessengerData } = require('./_lib/facebook-messenger');
const { resolveIgAcquisitionMode } = require('./_lib/ig-acquisition-mode');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function persistEvent(event, query) {
    const subscriber = `fb_graph:${event.pageId}:${event.psid}`;
    const path = `ig_threads?subscriber_id=eq.${encodeURIComponent(subscriber)}`;
    let [thread] = await query(`${path}&limit=1`);
    // An unsolicited Page echo does not create a new lead or start automation.
    if (!thread && event.direction === 'out') return null;
    if (!thread) {
        const [coach] = await query('users?select=id&email=eq.shannonbirch%40cocospersonaltraining.com&limit=1');
        if (!coach?.id) throw new Error('Messenger coach is not configured');
        const initial = mergeMessengerData({}, event);
        initial.acquisition_mode = resolveIgAcquisitionMode({ customData: initial });
        await query('ig_threads?on_conflict=subscriber_id', { method: 'POST',
            prefer: 'resolution=ignore-duplicates,return=minimal', body: {
                subscriber_id: subscriber, channel: 'messenger', coach_id: coach.id,
                custom_data: initial, auto_send_enabled: false,
            } });
        [thread] = await query(`${path}&limit=1`);
    }
    if (!thread || thread.channel !== 'messenger') throw new Error('Messenger identity conflict');
    // Compare-and-swap protects manual opt-outs, identity links, and ad metadata
    // when two webhook deliveries for the same person arrive concurrently.
    for (let attempt = 0; attempt < 4; attempt++) {
        const custom = mergeMessengerData(thread.custom_data, event);
        custom.acquisition_mode = resolveIgAcquisitionMode({ customData: custom, linkedUserId: thread.linked_user_id });
        if (!thread.linked_user_id && custom.acquisition_mode === 'paid_meta' && custom.codex_live_chat_enabled === undefined) custom.codex_live_chat_enabled = true;
        const field = event.direction === 'in' ? 'last_inbound_at' : 'last_outbound_at';
        const patch = { custom_data: custom };
        if (!event.attributionOnly && (!thread[field] || Date.parse(event.at) > Date.parse(thread[field]))) patch[field] = event.at;
        const version = thread.updated_at ? `&updated_at=eq.${encodeURIComponent(thread.updated_at)}` : '&updated_at=is.null';
        const updated = await query(`ig_threads?id=eq.${thread.id}${version}`, { method: 'PATCH', body: patch });
        if (updated?.[0]) return updated[0];
        [thread] = await query(`${path}&limit=1`);
    }
    throw new Error('Messenger thread changed during intake; retry required');
}

async function processEvents(events, { query = supabaseQuery, alert = insertCoachAlert, fetchImpl = fetch } = {}) {
    let processed = 0;
    for (const event of events) {
        const thread = await persistEvent(event, query);
        if (!thread || event.attributionOnly) continue;
        try {
            await query('ig_messages', { method: 'POST', body: {
                thread_id: thread.id, direction: event.direction, text: event.text,
                manychat_message_id: event.messageId,
                source: event.direction === 'in' ? 'facebook_messenger' : 'facebook_messenger_echo', created_at: event.at,
            } });
        } catch (error) {
            if (error.sqlstate !== '23505') throw error;
        }
        processed++;
        if (event.direction !== 'in') continue;
        // The existing pipeline owns claims, draft recovery, safety review and
        // sending. Preserve its exact source ID on every retry.
        const [existing] = await query(`coach_alerts?select=id,status,data&idempotency_key=eq.${encodeURIComponent(`ig_incoming_dm:${event.messageId}`)}&limit=1`);
        if (existing && (existing.status !== 'pending' || (existing.data?.draft_text && !existing.data?.draft_error))) continue;
        // The legacy database trigger only routes Instagram. Register this
        // exact Messenger inbound with the same controller; never create a
        // parallel sender or reset an already-registered action on a retry.
        if (!thread.linked_user_id && thread.custom_data?.acquisition_mode === 'paid_meta'
            && Date.parse(event.at) >= Date.parse(thread.last_inbound_at)) {
            const [message] = await query(`ig_messages?select=id&thread_id=eq.${thread.id}&manychat_message_id=eq.${encodeURIComponent(event.messageId)}&limit=1`);
            if (!message?.id) throw new Error('Messenger source message is missing');
            const [action] = await query(`ig_next_actions?select=id&thread_id=eq.${thread.id}&source_message_id=eq.${message.id}&limit=1`);
            if (!action) await query('rpc/upsert_ig_next_action', { method: 'POST', body: {
                p_thread_id: thread.id, p_ig_username: null, p_lead_state: thread.lead_stage || 'new',
                p_owner: 'dm_manager', p_action_type: 'reply_inbound', p_priority: 950,
                p_due_at: new Date().toISOString(), p_safe_after: new Date().toISOString(),
                p_reason: { source: 'facebook_messenger_inbound', why: 'Verified Facebook ad message needs a reply' },
                p_source_message_id: message.id, p_supersede: true,
            } });
        }
        const name = thread.profile_name || 'Facebook lead';
        await alert({ client_id: thread.linked_user_id || null, coach_id: thread.coach_id,
            client_name: name, alert_type: 'fb_incoming_dm', priority: 'high', status: 'pending',
            title: `${name} messaged on Facebook`, description: event.text.slice(0, 200), suggested_message: null,
            data: { channel: 'messenger', delivery_channel: 'facebook_messenger',
                ig_thread_id: thread.id, subscriber_id: thread.subscriber_id,
                manychat_message_id: event.messageId, message_preview: event.text.slice(0, 400),
                facebook_messenger: thread.custom_data.facebook_messenger,
                draft_messages: [], draft_text: '', draft_model: 'pending', draft_error: 'draft_generation_pending',
                alert_shell_source: 'facebook_webhook_before_draft',
            } }, `ig_incoming_dm:${event.messageId}`);
        const response = await fetchImpl(`${process.env.URL || 'https://plantbased-balance.org'}/.netlify/functions/ig-instant-draft-background`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
            body: JSON.stringify({ threadId: thread.id, subscriberId: thread.subscriber_id,
                channel: 'messenger', messageText: event.text, manychatMessageId: event.messageId,
                profileName: thread.profile_name || null, customData: thread.custom_data,
                paidMetaLiveChat: Boolean(thread.last_outbound_at) }),
        });
        if (!response.ok) throw new Error('Messenger draft dispatch failed');
    }
    return processed;
}

exports.handler = async event => {
    const env = process.env;
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        const token = env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
        return params['hub.mode'] === 'subscribe' && token && params['hub.verify_token'] === token
            ? { statusCode: 200, body: String(params['hub.challenge'] || '') }
            : json(403, { error: 'Webhook verification failed' });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const secret = env.FACEBOOK_APP_SECRET;
    const pages = configuredPageIds(env);
    if (!secret || !pages.length) return json(503, { error: 'Messenger setup incomplete' });
    const raw = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    const signature = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'x-hub-signature-256')?.[1];
    if (!verifyMessengerSignature(raw, signature, secret)) return json(403, { error: 'Invalid webhook signature' });
    let payload;
    try { payload = JSON.parse(raw.toString('utf8')); } catch { return json(400, { error: 'Invalid JSON' }); }
    try {
        return json(200, { processed: await processEvents(normalizeMessengerEvents(payload, pages)) });
    } catch (error) {
        // A 5xx makes Meta retry; saved message and alert IDs make retries safe.
        console.error('[facebook-webhook] intake failed:', error.message);
        return json(503, { error: 'Messenger intake retry required' });
    }
};
exports._test = { processEvents, persistEvent };
