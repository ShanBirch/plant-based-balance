const ACQUISITION_MODES = Object.freeze({
    EXISTING_CLIENT: 'existing_client',
    PAID_META: 'paid_meta',
    ORGANIC_FOLLOWER: 'organic_follower',
    ORGANIC_OUTREACH: 'organic_outreach',
    ORGANIC_INBOUND: 'organic_inbound',
});

const VALID_ACQUISITION_MODES = new Set(Object.values(ACQUISITION_MODES));

function normalized(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function acquisitionSourceValues(customData = {}) {
    const leadAcquisition = customData?.lead_acquisition && typeof customData.lead_acquisition === 'object'
        ? customData.lead_acquisition
        : {};
    const salesContext = customData?.sales_context && typeof customData.sales_context === 'object'
        ? customData.sales_context
        : {};
    const inboundRouting = customData?.current_inbound_routing && typeof customData.current_inbound_routing === 'object'
        ? customData.current_inbound_routing
        : {};
    const attribution = customData?.meta_ad_attribution && typeof customData.meta_ad_attribution === 'object'
        ? customData.meta_ad_attribution
        : {};
    return [
        customData?.latest_paid_acquisition,
        customData?.acquisition_source,
        customData?.lead_origin,
        leadAcquisition.source,
        salesContext.acquisition_source,
        salesContext.source,
        inboundRouting.source,
        attribution.source,
    ].map(normalized).filter(Boolean);
}

function hasVerifiedMetaAttribution(customData = {}) {
    const sources = acquisitionSourceValues(customData);
    const attribution = customData?.meta_ad_attribution && typeof customData.meta_ad_attribution === 'object'
        ? customData.meta_ad_attribution
        : {};
    return sources.some(source => ['meta_ads', 'meta_ad', 'instagram_ads', 'facebook_ads'].includes(source))
        || normalized(attribution.platform_source) === 'ads';
}

function resolveIgAcquisitionMode({ customData = {}, linkedUserId = null } = {}) {
    if (linkedUserId) return ACQUISITION_MODES.EXISTING_CLIENT;
    if (hasVerifiedMetaAttribution(customData)) return ACQUISITION_MODES.PAID_META;

    const stored = normalized(customData?.acquisition_mode);
    if ([ACQUISITION_MODES.ORGANIC_FOLLOWER, ACQUISITION_MODES.ORGANIC_OUTREACH].includes(stored)) {
        return stored;
    }

    const sources = acquisitionSourceValues(customData);
    if (sources.some(source => /(?:^|_)follower(?:_|$)|welcome_follower|follow_back/.test(source))) {
        return ACQUISITION_MODES.ORGANIC_FOLLOWER;
    }
    if (sources.some(source => /story|feed|discovery|comment|outreach|cold_dm|native_outreach|selenium/.test(source))) {
        return ACQUISITION_MODES.ORGANIC_OUTREACH;
    }
    return VALID_ACQUISITION_MODES.has(stored) && stored !== ACQUISITION_MODES.EXISTING_CLIENT
        ? stored
        : ACQUISITION_MODES.ORGANIC_INBOUND;
}

function isPaidMetaAcquisitionMode(mode) {
    return normalized(mode) === ACQUISITION_MODES.PAID_META;
}

function buildAcquisitionModePromptBlock(mode) {
    const normalizedMode = normalized(mode);
    if (normalizedMode === ACQUISITION_MODES.PAID_META) {
        return `

PAID META CONVERSATION MODE:
- This person knowingly entered from a verified Meta ad. They already expect a commercial conversation, so answer offer, price, inclusions, fit and starting questions plainly and early.
- Do not disguise the sales context or manufacture extra rapport before answering what they asked. Direct clarity lowers uncertainty here.
- Keep the same autonomy, safety and fit standards. Do not pressure, create urgency, oversell, or force the offer when their newest message is ordinary banter or unrelated.
- After the first reply, preserve this paid context for the full thread. A later message does not turn them into an organic outreach lead.
- Preserve the verified paid offer-flow variant and attributed checkout URL. Never infer or switch the paid experiment route from a later generic message.`;
    }
    if (normalizedMode === ACQUISITION_MODES.EXISTING_CLIENT) return '';
    const sourceDescription = normalizedMode === ACQUISITION_MODES.ORGANIC_FOLLOWER
        ? 'an existing follower relationship'
        : (normalizedMode === ACQUISITION_MODES.ORGANIC_OUTREACH
            ? 'Shannon-led organic outreach'
            : 'an organic Instagram conversation without verified ad attribution');
    return `

ORGANIC RELATIONSHIP CONVERSATION MODE:
- This conversation comes from ${sourceDescription}, not a verified paid-ad handoff. The person may not expect a sales conversation yet.
- Lead with the exact human context. Prefer a short observation, reflection or statement they can confirm, correct or expand.
- Move only through evidence they supply: live topic, life rhythm, health or fitness context, their goal and blocker, then an optional Balance bridge when earned.
- Do not hide a pitch inside friendliness. If there is no real problem or help signal, keep it human or leave space. A no-fit answer is valid.
- Use the canonical plant-based Founders Pass route if they later ask for or accept the offer. Never place an organic lead into a paid broad-pain experiment because they mention work, kids, busyness, consistency or starting again.`;
}

module.exports = {
    ACQUISITION_MODES,
    VALID_ACQUISITION_MODES,
    acquisitionSourceValues,
    hasVerifiedMetaAttribution,
    resolveIgAcquisitionMode,
    isPaidMetaAcquisitionMode,
    buildAcquisitionModePromptBlock,
};
