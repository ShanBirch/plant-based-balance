/** Send an approved WhatsApp Cloud API text reply for a pending coach alert. */
const crypto = require('crypto');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN;
const GRAPH_VERSION = String(process.env.WHATSAPP_GRAPH_API_VERSION || process.env.META_GRAPH_API_VERSION || 'v25.0').replace(/^v?/, 'v');

function json(statusCode, body) { return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : [];
}

function customerWindowOpen(data = {}, now = Date.now()) {
    const endsAt = Date.parse(data.whatsapp_customer_service_window_ends_at || '');
    return Number.isFinite(endsAt) && endsAt > now;
}

function withoutSendClaim(data = {}) {
    const { send_claim_id, send_claim_at, ...rest } = data;
    return rest;
}

async function sendCloudText(phoneNumberId, to, body) {
    if (!WHATSAPP_TOKEN) throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`WhatsApp Cloud API ${res.status}: ${text.slice(0, 500)}`);
    return text ? JSON.parse(text) : {};
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
    const alertId = String(body.alertId || '').trim();
    const replyText = String(body.replyText || '').trim();
    const draftText = String(body.draftText || '').trim();
    if (!alertId || !replyText) return json(400, { error: 'Missing alertId or replyText' });

    let claimed = null;
    let claimId = '';
    let delivered = false;
    try {
        const alerts = await supabase(`coach_alerts?select=id,status,data,alert_type&id=eq.${encodeURIComponent(alertId)}&limit=1`);
        const alert = alerts[0];
        if (!alert) return json(404, { error: 'Alert not found' });
        if (alert.status !== 'pending') return json(409, { error: 'Alert already actioned', status: alert.status });
        const data = alert.data || {};
        if (data.delivery_channel !== 'whatsapp_cloud') return json(400, { error: 'This alert is not a WhatsApp Cloud message' });
        if (!customerWindowOpen(data)) {
            return json(409, { error: 'The 24-hour WhatsApp reply window has expired. Send an approved template from WhatsApp Manager instead.', code: 'whatsapp_customer_window_expired' });
        }
        if (!data.whatsapp_phone_number_id || !data.whatsapp_contact_wa_id) return json(500, { error: 'WhatsApp destination details are missing' });

        // Claim before calling Meta. A double-click, dashboard tab, or Android
        // inline reply must never create two WhatsApp messages.
        claimId = crypto.randomUUID();
        const claimedRows = await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=is.null`, {
            method: 'PATCH',
            body: { data: { ...data, send_claim_id: claimId, send_claim_at: new Date().toISOString() } },
            prefer: 'return=representation',
        });
        claimed = claimedRows[0] || null;
        if (!claimed) return json(409, { error: 'This WhatsApp reply is already being sent. Check the conversation before retrying.' });

        const result = await sendCloudText(data.whatsapp_phone_number_id, data.whatsapp_contact_wa_id, replyText);
        delivered = true;
        const sentAt = new Date().toISOString();
        const mergedData = {
            ...withoutSendClaim(claimed.data || data),
            sent_message: replyText,
            was_edited: !!draftText && replyText !== draftText,
            sent_at: sentAt,
            sent_via: body.source || 'admin_dashboard',
            whatsapp_outbound_message_id: result.messages?.[0]?.id || null,
        };
        if (mergedData.was_edited && body.editReason) mergedData.edit_reason = String(body.editReason).trim().slice(0, 240);
        const updated = await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(claimId)}`, {
            method: 'PATCH', body: { status: 'sent', actioned_at: sentAt, data: mergedData }, prefer: 'return=representation',
        });
        if (!updated[0]) return json(409, { error: 'Reply sent but the alert was actioned at the same time. Check WhatsApp before retrying.' });
        return json(200, { ok: true, alertId, whatsappMessageId: mergedData.whatsapp_outbound_message_id });
    } catch (error) {
        if (delivered) {
            // Delivery is the important irreversible action. Keep the claim in
            // place so no retry can duplicate the WhatsApp message.
            console.error('[send-whatsapp-reply] reply delivered but bookkeeping failed:', error.message);
            return json(200, { ok: true, alertId, warning: 'reply_sent_alert_update_pending' });
        }
        if (claimed && claimId) {
            try {
                await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=eq.${encodeURIComponent(claimId)}`, {
                    method: 'PATCH',
                    body: { data: withoutSendClaim(claimed.data || {}) },
                    prefer: 'return=minimal',
                });
            } catch (releaseError) {
                console.warn('[send-whatsapp-reply] send claim release failed:', releaseError.message);
            }
        }
        console.error('[send-whatsapp-reply] failed:', error.message);
        return json(502, { error: error.message });
    }
};

exports._test = { customerWindowOpen, withoutSendClaim };
