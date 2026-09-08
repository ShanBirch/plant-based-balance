// Bound automatic regeneration of one inbound. A crashed background worker
// keeps its claim until after Netlify's 15-minute maximum execution window.
const RETRY_DELAY_MS = 16 * 60 * 1000;
const MAX_ATTEMPTS = 3;

function recoveryAllowed(alert, now = Date.now()) {
    const data = alert?.data || {};
    if (alert?.status !== 'pending') return false;
    if ([alert.suggested_message, alert.scheduled_reply_text, data.draft_text]
        .some(text => String(text || '').trim())) return false;
    const recovery = data.draft_recovery || {};
    return Number(recovery.attempts || 0) < MAX_ATTEMPTS
        && !(Date.parse(recovery.retry_after) > now);
}

async function claimDraftRecovery(alert, query, now = Date.now()) {
    if (!recoveryAllowed(alert, now)) return null;
    // The database checks and merges atomically. Send the snapshot in the
    // POST body because real alert histories are too large for URL filters.
    const rows = await query('rpc/claim_ig_draft_recovery', {
        method: 'POST',
        body: { p_alert_id: alert.id, p_expected_data: alert.data ?? null },
    });
    return rows?.[0] || null;
}

module.exports = { recoveryAllowed, claimDraftRecovery, MAX_ATTEMPTS, RETRY_DELAY_MS };
