/**
 * Background wrapper for IG/FB instant DM drafts.
 *
 * manychat-inbound needs to return quickly so ManyChat does not retry the
 * webhook, but the draft producer can take longer than the webhook function's
 * life. Netlify background functions acknowledge the request immediately and
 * keep running after the caller returns.
 */

const { handler: runIgInstantDraft } = require('./ig-instant-draft');

const PAID_META_INBOUND_SETTLE_MS = 1200;
// Instagram often delivers one human thought as several quick bubbles. Keep a
// short live-chat window aligned with the worker quiet window; newer webhooks
// invalidate older drafts, so a later bubble is handled by the newest turn
// without making every lead wait several seconds before drafting begins.
const PAID_META_LIVE_CHAT_SETTLE_MS = 1200;

function resolvePaidMetaInboundSettleDelayMs(payload = {}) {
    const customData = payload?.customData && typeof payload.customData === 'object'
        ? payload.customData
        : {};
    const attribution = customData.meta_ad_attribution && typeof customData.meta_ad_attribution === 'object'
        ? customData.meta_ad_attribution
        : {};
    const paidMeta = String(attribution.source || '').toLowerCase() === 'meta_ads'
        || String(customData.latest_paid_acquisition || '').toLowerCase() === 'meta_ads'
        || String(customData.acquisition_source || '').toLowerCase() === 'meta_ads'
        || customData.internal_test_auto_reply_enabled === true;
    return paidMeta
        ? (payload.paidMetaLiveChat === true ? PAID_META_LIVE_CHAT_SETTLE_MS : PAID_META_INBOUND_SETTLE_MS)
        : 0;
}

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        let payload = {};
        try { payload = JSON.parse(event.body || '{}'); } catch {}
        const settleDelayMs = resolvePaidMetaInboundSettleDelayMs(payload);
        if (settleDelayMs > 0) {
            // Let rapid-fire Instagram bubbles land before choosing the latest
            // canonical inbound. The older worker will then fail the freshness
            // check and only the final message drafts the complete thought.
            await new Promise(resolve => setTimeout(resolve, settleDelayMs));
        }
        return await runIgInstantDraft(event);
    } catch (error) {
        console.error('[ig-instant-draft-background] dispatch failed:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'draft_dispatch_failed', details: error.message }),
        };
    }
};

exports._test = { resolvePaidMetaInboundSettleDelayMs };
