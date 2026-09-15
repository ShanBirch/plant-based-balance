// Retry only an explicit provider rejection. A timeout/network failure has an
// unknown delivery outcome and must never be blindly replayed.
async function sendRejectedMediaWithRetry(send, wait, maxAttempts = 3) {
    for (let attempt = 1; ; attempt++) {
        try { return await send(); } catch (error) {
            if (attempt >= maxAttempts || error.retryableMediaRejection !== true) throw error;
            await wait(attempt * 2000);
        }
    }
}

async function persistReviewHold({ query, alertId, fallbackData, hold }) {
    // The sender has already updated this row. Never replace its receipts and
    // provider diagnostics with the caller's pre-dispatch snapshot.
    const rows = await query(`coach_alerts?select=status,data&id=eq.${encodeURIComponent(alertId)}`);
    const current = rows?.[0];
    if (!current || current.status !== 'pending') return current?.data || fallbackData;
    if (current.data?.send_claim_id) return current.data;
    const data = { ...current.data, auto_send_enabled_at_draft: true, auto_send_review_hold: hold };
    await query(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending&data->>send_claim_id=is.null`, {
        method: 'PATCH', body: { data }, prefer: 'return=minimal',
    });
    return data;
}

function deliveredPrefix(items, receipts, prefix) {
    if (receipts.length > items.length) throw new Error('Existing delivery does not match this reply; manual review required');
    return receipts.map((receipt, index) => {
        const item = items[index];
        if (item.kind === 'audio' || receipt.text !== item.text || !String(receipt.manychat_message_id || '').startsWith(prefix)) {
            throw new Error('Existing delivery does not match this reply; manual review required');
        }
        return { ...item, ok: true, response: { message_id: receipt.manychat_message_id.slice(prefix.length) },
            linkUrl: item.url, buttonTitle: item.title, canonicalMessages: [receipt], recovered: true };
    });
}

module.exports = { sendRejectedMediaWithRetry, persistReviewHold, deliveredPrefix };
