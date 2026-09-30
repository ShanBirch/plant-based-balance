const crypto = require('crypto');
const { generateWhatsAppDraft } = require('./_lib/whatsapp-draft');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

function authorized(headers = {}) {
    const supplied = headers.authorization || headers.Authorization || '';
    const expected = SERVICE_KEY ? `Bearer ${SERVICE_KEY}` : '';
    return !!expected && Buffer.byteLength(supplied) === Buffer.byteLength(expected)
        && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };
    if (!authorized(event.headers)) return { statusCode: 401 };
    let alertId;
    try { alertId = JSON.parse(event.body || '{}').alertId; } catch { return { statusCode: 400 }; }
    if (!alertId || typeof alertId !== 'string') return { statusCode: 400 };
    const pipeline = require('./_lib/client-context');
    const query = pipeline.supabaseQuery;
    const filter = `coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`;
    const [alert] = await query(`${filter}&select=*&limit=1`);
    if (!alert || alert.data?.delivery_channel !== 'whatsapp_cloud') return { statusCode: 200 };
    if (require('./_lib/codex-dm-operator').operatorOwnsDm(alert)) {
        return { statusCode: 200, body: JSON.stringify({ reply_owner: 'codex_conversation_operator' }) };
    }
    const claim = crypto.randomUUID();
    const [claimed] = await query(`${filter}&data->>whatsapp_draft_status=eq.queued&data->>send_claim_id=is.null`, {
        method: 'PATCH', body: { data: { ...alert.data, whatsapp_draft_status: 'generating', whatsapp_draft_claim: claim } },
    });
    if (!claimed) return { statusCode: 200 };
    let draft;
    try {
        const data = alert.data;
        const history = await query(`coach_alerts?select=*&coach_id=eq.${encodeURIComponent(alert.coach_id)}&data->>delivery_channel=eq.whatsapp_cloud&data->>whatsapp_phone_number_id=eq.${encodeURIComponent(data.whatsapp_phone_number_id)}&data->>whatsapp_contact_wa_id=eq.${encodeURIComponent(data.whatsapp_contact_wa_id)}&order=created_at.desc&limit=30`);
        draft = await generateWhatsAppDraft(alert, history, pipeline);
    } catch {
        draft = { text: '', status: 'failed', review: null };
        console.warn('[whatsapp-draft] generation unavailable; inbound remains approval-only');
    }
    // Reload before updating so a concurrent manual action or hold is not overwritten.
    const [live] = await query(`${filter}&select=*&limit=1`);
    if (!live || live.data?.send_claim_id || live.data?.whatsapp_draft_claim !== claim) return { statusCode: 200 };
    const [updated] = await query(`${filter}&data->>send_claim_id=is.null&data->>whatsapp_draft_claim=eq.${claim}`, {
        method: 'PATCH', body: {
            suggested_message: draft.text,
            data: { ...live.data, whatsapp_draft_status: draft.status, whatsapp_draft_generated_at: new Date().toISOString(),
                draft_review: draft.review, context_review: draft.contextReview || null,
                auto_send_blocked: true, needs_you_required: true },
        },
    });
    if (!updated) return { statusCode: 200 };
    await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: alert.coach_id, senderName: alert.client_name,
            senderId: `whatsapp:${alert.data.whatsapp_contact_wa_id}`, type: 'coach_draft_ready', alertId,
            clientName: alert.client_name, clientMessage: alert.data.incoming_message,
            messageText: draft.text, draftText: draft.text, channelLabel: 'WhatsApp', sourceChannel: 'whatsapp' }),
    });
    return { statusCode: 200 };
};

exports._test = { authorized };
