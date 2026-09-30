// Shannon's 30 September 2026 DM ownership change. Inbound capture stays live.
const COACH_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
const CHANNELS = new Set(['instagram', 'messenger', 'facebook', 'whatsapp']);
const HUMAN_SOURCES = new Set(['android_inline_reply_worker', 'manual_instagram']);
function operatorOwnsDm(record = {}) {
    const data = record.custom_data || record.data || {};
    const channel = record.channel || data.channel
        || (data.delivery_channel === 'whatsapp_cloud' ? 'whatsapp'
            : record.alert_type === 'ig_incoming_dm' ? 'instagram'
                : record.alert_type === 'fb_incoming_dm' ? 'messenger' : '');
    const bot = data.bot_account || data.instagram_graph?.bot_account || '';
    const normalizedChannel = ['manual_ig', 'instagram_graph', 'manychat'].includes(channel) ? 'instagram' : channel;
    return record.coach_id === COACH_ID && CHANNELS.has(normalizedChannel)
        && (!bot || bot === 'shan_n_sunny');
}
function humanSource(source = '') {
    return String(source).startsWith('admin_dashboard') || HUMAN_SOURCES.has(source);
}
function legacySendBlocked(alert, source, operatorVerified = false) {
    return operatorOwnsDm(alert) && !humanSource(source) && !operatorVerified;
}
function validateOperatorClaim({ alert, thread, action, latest, proof, replyText, now = Date.now() }) {
    if (!operatorOwnsDm(thread) || !proof || !action || !latest) return 'operator_evidence_missing';
    if (alert.coach_id !== thread.coach_id || alert.data?.ig_thread_id !== thread.id) return 'operator_identity_mismatch';
    if (action.thread_id !== thread.id || action.id !== proof.action_id
        || action.action_version !== proof.action_version || action.claim_token !== proof.claim_token
        || action.claim_run_id !== proof.run_id || action.owner !== 'dm_manager'
        || action.action_type !== 'reply_inbound'
        || action.status !== 'claimed' || !(Date.parse(action.claim_expires_at) > now)) return 'operator_claim_invalid';
    if (latest.direction !== 'in' || latest.id !== proof.source_message_id
        || action.source_message_id !== latest.id) return 'operator_source_changed';
    if (alert.data?.manychat_message_id !== latest.manychat_message_id
        && alert.data?.source_message_id !== latest.id) return 'operator_alert_source_mismatch';
    if (proof.reviewed_text !== replyText || proof.reviewed_at > new Date(now).toISOString()
        || !Number.isFinite(Date.parse(proof.reviewed_at))
        || now - Date.parse(proof.reviewed_at) > 5 * 60000) return 'operator_review_stale';
    const data = thread.custom_data || {};
    if (['manual_review_only', 'no_ai_send', 'no_ai_schedule', 'codex_ai_opt_out',
        'permanent_needs_you_draft_only'].some(key => data[key] === true)
        || data.operator_lock || alert.data?.send_claim_id) return 'operator_independent_hold';
    if (action.receipt?.action_version === action.action_version
        && (action.receipt?.no_repeat || ['sent_verified', 'sent_attribution_pending', 'uncertain'].includes(action.receipt?.delivery_outcome))) return 'operator_no_repeat';
    return null;
}
async function delegateInbound(thread, query) {
    const [latest] = await query('ig_messages?select=id,direction,text,manychat_message_id,created_at&thread_id=eq.'
        + encodeURIComponent(thread.id) + '&order=created_at.desc,id.desc&limit=1');
    if (!latest || latest.direction !== 'in') return { delegated: false, reason: 'no_current_unanswered_inbound' };
    if (!latest.manychat_message_id) throw new Error('Canonical inbound transport source is missing');
    const key = 'ig_incoming_dm:' + latest.manychat_message_id;
    const [existing] = await query('coach_alerts?select=id,status,data&idempotency_key=eq.' + encodeURIComponent(key) + '&limit=1');
    if (existing) {
        // Never rewrite a manual hold, foreign sender or already delivered alert.
        return { delegated: true, alert_id: existing.id, source_message_id: latest.id, existing_status: existing.status };
    }
    const [alert] = await query('coach_alerts', { method: 'POST', body: {
        coach_id: thread.coach_id, client_id: thread.linked_user_id || null,
        client_name: thread.profile_name || thread.ig_username || 'DM contact',
        alert_type: thread.channel === 'instagram' ? 'ig_incoming_dm' : 'fb_incoming_dm',
        priority: 'high', status: 'pending', title: 'Conversation operator reply',
        description: String(latest.text || '').slice(0, 400), suggested_message: null,
        idempotency_key: key,
        data: { channel: thread.channel, ig_thread_id: thread.id, subscriber_id: thread.subscriber_id,
            manychat_message_id: latest.manychat_message_id, source_message_id: latest.id,
            reply_owner: 'codex_conversation_operator', reply_mode: 'live_conversation',
            draft_messages: [], draft_text: '', legacy_auto_reply_disabled: true },
    } });
    if (!alert?.id) throw new Error('Operator source alert was not persisted');
    return { delegated: true, alert_id: alert.id, source_message_id: latest.id };
}
async function verifyOperatorSend(alert, body, query) {
    const proof = body.codexOperator;
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!proof || body.source !== 'balance_lead_client_manager_cron'
        || !uuid.test(proof.action_id || '') || !uuid.test(alert.data?.ig_thread_id || '')) return 'operator_evidence_missing';
    const [thread] = await query('ig_threads?select=*&id=eq.' + alert.data.ig_thread_id + '&limit=1');
    const [action] = await query('ig_next_actions?select=*&id=eq.' + proof.action_id + '&limit=1');
    const [latest] = await query('ig_messages?select=id,direction,manychat_message_id&thread_id=eq.'
        + alert.data.ig_thread_id + '&order=created_at.desc,id.desc&limit=1');
    return validateOperatorClaim({ alert, thread, action, latest, proof, replyText: body.reviewedText });
}
module.exports = { COACH_ID, operatorOwnsDm, humanSource, legacySendBlocked, validateOperatorClaim, delegateInbound, verifyOperatorSend };
