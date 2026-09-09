// An automated bubble arriving late does not answer a newer inbound.
async function outboundAnswersOlderInbound({query, threadId, outbound, sourceAt}) {
    if (outbound?.direction !== 'out' || !Number.isFinite(Date.parse(sourceAt))) return false;
    let candidates;
    if (outbound.alert_id) {
        candidates = await query('coach_alerts?select=id,data&id=eq.' + encodeURIComponent(outbound.alert_id));
    } else {
        if (outbound.source !== 'instagram_native_inbox') return false;
        // Native echo may precede canonical sender readback. Require an active
        // send claim and exact copy evidence; never infer from time alone.
        candidates = await query('coach_alerts?select=id,data&data->>ig_thread_id=eq.' + encodeURIComponent(threadId)
            + '&status=eq.pending&data->>send_claim_id=not.is.null&order=created_at.desc&limit=4');
        const text = String(outbound.text || '').replace(/\s+/g,' ').trim();
        candidates = candidates.filter(row => text.length > 12
            && String(row.data?.draft_text || '').replace(/\s+/g,' ').includes(text));
        if (candidates.length !== 1) return false;
    }
    const revision = candidates?.[0]?.data?.draft_revision_id;
    if (!revision) return false;
    const sources = await query('ig_messages?select=created_at&thread_id=eq.' + encodeURIComponent(threadId)
        + '&direction=eq.in&manychat_message_id=eq.' + encodeURIComponent(revision) + '&limit=1');
    const answeredAt = Date.parse(sources?.[0]?.created_at || '');
    return Number.isFinite(answeredAt) && answeredAt < Date.parse(sourceAt);
}
module.exports = {outboundAnswersOlderInbound};
