/**
 * WhatsApp Cloud API webhook.
 *
 * Incoming WhatsApp messages become approval-only coach_alerts. They never
 * auto-send, and the alert retains Meta's 24-hour customer-service window so
 * an expired message cannot accidentally be sent as free-form text.
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const WINDOW_MS = 24 * 60 * 60 * 1000;

function json(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

function getHeader(headers = {}, name) {
    return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function rawBody(event = {}) {
    const body = event.body || '';
    return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}

function isValidSignature(body, headers = {}) {
    if (!APP_SECRET) return false;
    const received = String(getHeader(headers, 'x-hub-signature-256') || '');
    if (!received.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');
    const actual = received.slice('sha256='.length);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : [];
}

function messageText(message = {}) {
    if (message.type === 'text') return String(message.text?.body || '').trim();
    if (message.type === 'button') return String(message.button?.text || '').trim();
    if (message.type === 'interactive') {
        return String(message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '').trim();
    }
    const caption = String(message[message.type]?.caption || '').trim();
    return caption || `[${String(message.type || 'message').replace(/[^a-z_]/gi, '') || 'message'}]`;
}

function inboundEvents(payload = {}) {
    const events = [];
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value || {};
            if (change.field !== 'messages' || value.messaging_product !== 'whatsapp') continue;
            const contacts = new Map((value.contacts || []).map(contact => [String(contact.wa_id || ''), String(contact.profile?.name || '').trim()]));
            for (const message of value.messages || []) {
                const waId = String(message.from || '').trim();
                const id = String(message.id || '').trim();
                if (!waId || !id) continue;
                events.push({
                    messageId: id,
                    waId,
                    profileName: contacts.get(waId) || waId,
                    text: messageText(message),
                    receivedAt: Number(message.timestamp || 0) > 0 ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
                    phoneNumberId: String(value.metadata?.phone_number_id || '').trim(),
                    displayPhoneNumber: String(value.metadata?.display_phone_number || '').trim(),
                    type: String(message.type || 'unknown'),
                });
            }
        }
    }
    return events;
}

async function primaryCoachId() {
    const rows = await supabase('admin_users?select=user_id&limit=1');
    return rows[0]?.user_id || null;
}

async function alreadyReceived(messageId) {
    const rows = await supabase(`coach_alerts?select=id&data->>whatsapp_message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
    return !!rows[0];
}

async function createAlert(event, coachId) {
    const receivedAt = new Date(event.receivedAt);
    const windowEndsAt = new Date(receivedAt.getTime() + WINDOW_MS).toISOString();
    const defaultReply = `Hey ${event.profileName.split(/\s+/)[0] || 'there'}, got this. I’m just reading through it now and I’ll get back to you properly shortly x`;
    const rows = await supabase('coach_alerts', {
        method: 'POST',
        body: [{
            coach_id: coachId,
            client_name: event.profileName,
            alert_type: 'whatsapp_incoming_message',
            priority: 'high',
            title: `WhatsApp from ${event.profileName}`,
            description: event.text,
            suggested_message: defaultReply,
            data: {
                channel: 'whatsapp',
                delivery_channel: 'whatsapp_cloud',
                whatsapp_message_id: event.messageId,
                whatsapp_contact_wa_id: event.waId,
                whatsapp_phone_number_id: event.phoneNumberId,
                whatsapp_display_phone_number: event.displayPhoneNumber,
                whatsapp_message_type: event.type,
                whatsapp_received_at: receivedAt.toISOString(),
                whatsapp_customer_service_window_ends_at: windowEndsAt,
                incoming_message: event.text,
                auto_send_blocked: true,
            },
        }],
    });
    return { alert: rows[0] || null, defaultReply };
}

async function notifyCoach({ coachId, alert, event, defaultReply }) {
    if (!alert?.id) return;
    try {
        const res = await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachId,
                senderName: event.profileName,
                senderId: `whatsapp:${event.waId}`,
                type: 'coach_draft_ready',
                alertId: alert.id,
                clientId: `whatsapp:${event.waId}`,
                clientName: event.profileName,
                clientMessage: event.text,
                messageText: defaultReply,
                draftText: defaultReply,
                channelLabel: 'WhatsApp',
                sourceChannel: 'whatsapp',
            }),
        });
        if (!res.ok) console.warn(`[whatsapp-webhook] coach push returned ${res.status}`);
    } catch (error) {
        // A delayed phone notification must not make Meta retry and duplicate
        // the already-stored inbound WhatsApp message.
        console.warn('[whatsapp-webhook] coach push failed:', error.message);
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        if (params['hub.mode'] === 'subscribe' && VERIFY_TOKEN && params['hub.verify_token'] === VERIFY_TOKEN) {
            return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: params['hub.challenge'] || '' };
        }
        return { statusCode: 403, body: 'Verification failed' };
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    const body = rawBody(event);
    if (!isValidSignature(body, event.headers)) return json(401, { error: 'Invalid webhook signature' });

    let payload;
    try { payload = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON' }); }
    try {
        const coachId = await primaryCoachId();
        if (!coachId) throw new Error('No admin coach account is configured');
        let created = 0;
        for (const inbound of inboundEvents(payload)) {
            if (await alreadyReceived(inbound.messageId)) continue;
            const createdAlert = await createAlert(inbound, coachId);
            await notifyCoach({ coachId, event: inbound, ...createdAlert });
            created++;
        }
        return json(200, { ok: true, created });
    } catch (error) {
        console.error('[whatsapp-webhook] failed:', error.message);
        return json(500, { error: 'Webhook processing failed' });
    }
};

exports._test = { inboundEvents, messageText, isValidSignature };
