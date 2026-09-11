const { hasVerifiedMetaAttribution } = require('./ig-acquisition-mode');

// Membership only: never claim the conversation, change permissions or send.
function registerPaidLeadDispatch(customData = {}, {
    channel = 'instagram', linkedUserId = null, direction = 'in',
    attributionOnly = false, nowIso,
} = {}) {
    const bot = String(customData.bot_account || customData.instagram_graph?.bot_account || '').toLowerCase();
    if (channel !== 'instagram' || direction !== 'in' || attributionOnly || linkedUserId
        || bot !== 'shan_n_sunny' || !hasVerifiedMetaAttribution(customData)
        || !Number.isFinite(Date.parse(nowIso))) return customData;
    if (['internal_account', 'internal_test_auto_reply_enabled', 'is_test_account']
        .some(key => String(customData[key]).toLowerCase() === 'true')) return customData;
    // Repeated inbound/echo reconciliation must not reset dispatcher progress.
    if (customData.paid_lead_dispatch?.registered_at) return customData;
    return {
        ...customData,
        paid_lead_dispatch: {
            version: 1,
            registered_at: nowIso,
            source: 'verified_meta_ad_inbound',
        },
    };
}

module.exports = { registerPaidLeadDispatch };
