const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    ACQUISITION_MODES,
    resolveIgAcquisitionMode,
    buildAcquisitionModePromptBlock,
} = require('../netlify/functions/_lib/ig-acquisition-mode');
const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
const instagramWebhook = require('../netlify/functions/instagram-webhook')._test;

assert.equal(resolveIgAcquisitionMode({
    customData: { acquisition_source: 'welcome_follower' },
}), ACQUISITION_MODES.ORGANIC_FOLLOWER);

assert.equal(resolveIgAcquisitionMode({
    customData: { lead_acquisition: { source: 'native_story_outreach' } },
}), ACQUISITION_MODES.ORGANIC_OUTREACH);

assert.equal(resolveIgAcquisitionMode({
    customData: { acquisition_mode: 'organic_outreach', latest_paid_acquisition: 'meta_ads' },
}), ACQUISITION_MODES.PAID_META, 'verified paid attribution must override an older organic mode');

assert.equal(resolveIgAcquisitionMode({
    customData: { acquisition_source: 'native_story_outreach' },
    linkedUserId: 'client-1',
}), ACQUISITION_MODES.EXISTING_CLIENT);

const organicPolicy = buildAcquisitionModePromptBlock(ACQUISITION_MODES.ORGANIC_FOLLOWER);
assert.match(organicPolicy, /may not expect a sales conversation yet/);
assert.match(organicPolicy, /statement they can confirm, correct or expand/);
assert.match(organicPolicy, /Never place an organic lead into the paid-Meta route/);

const paidPolicy = buildAcquisitionModePromptBlock(ACQUISITION_MODES.PAID_META);
assert.match(paidPolicy, /knowingly entered from a verified Meta ad/);
assert.match(paidPolicy, /answer offer, price, inclusions, fit and starting questions plainly and early/);
assert.match(paidPolicy, /preserve this paid context for the full thread/);

const broadMessage = 'Work and the kids have made it hard to get consistent. I need to start again.';
assert.equal(instantDraft.resolveMetaAdFlowVariant({
    customData: { acquisition_source: 'native_story_outreach' },
    currentMessage: broadMessage,
}), 'plant_based_control', 'organic pain language must not select the paid-Meta route');

const paidBroadData = {
    acquisition_mode: 'paid_meta',
    meta_ad_attribution: {
        source: 'meta_ads',
        ref: 'broad_pain',
        ad_id: 'broad-ad-1',
    },
};
assert.equal(instantDraft.resolveMetaAdFlowVariant({
    customData: paidBroadData,
    currentMessage: broadMessage,
}), 'broad_pain');
assert.equal(instantDraft.resolveMetaAdFlowVariant({
    customData: {
        acquisition_mode: 'paid_meta',
        offer_flow_variant: 'plant_based_control',
        meta_ad_attribution: { source: 'meta_ads', ref: 'plant_based_control' },
    },
    currentMessage: 'I am vegan and ready',
}), 'broad_pain', 'legacy plant flags must normalise to the single paid route');

const organicCheckout = instantDraft.buildMetaAdCheckoutUrl({
    customData: { acquisition_source: 'native_story_outreach' },
    currentMessage: broadMessage,
    flowVariant: 'broad_pain',
});
assert.match(organicCheckout, /^https:\/\/plantbased-balance\.org\/founders/);
assert.doesNotMatch(organicCheckout, /future-balance/);

const paidCheckout = instantDraft.buildMetaAdCheckoutUrl({
    customData: paidBroadData,
    currentMessage: broadMessage,
    flowVariant: 'plant_based_control',
});
assert.equal(paidCheckout, 'https://future-balance.netlify.app/fitness');
assert.equal(new URL(paidCheckout).search, '');

const webhookPaid = instagramWebhook.mergeGraphCustomData({}, {
    participantId: 'lead-1',
    igAccountId: 'account-1',
    nowIso: '2026-07-28T00:00:00.000Z',
    messageId: 'message-1',
    participantUsername: 'paid_lead',
    direction: 'in',
    metaAdReferral: { source: 'meta_ads', ad_id: 'broad-ad-1' },
});
assert.equal(webhookPaid.acquisition_mode, ACQUISITION_MODES.PAID_META);

const webhookOrganic = instagramWebhook.mergeGraphCustomData({
    acquisition_source: 'native_story_outreach',
}, {
    participantId: 'lead-2',
    igAccountId: 'account-1',
    nowIso: '2026-07-28T00:00:00.000Z',
    messageId: 'message-2',
    participantUsername: 'organic_lead',
    direction: 'in',
});
assert.equal(webhookOrganic.acquisition_mode, ACQUISITION_MODES.ORGANIC_OUTREACH);

const qualifierSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/_lib/qualifier-engine.js'),
    'utf8'
);
assert.match(qualifierSource, /ACQUISITION MODE: \$\{acquisitionMode\}/);
assert.doesNotMatch(qualifierSource, /The leads are NOT coming to him/);

const draftSource = fs.readFileSync(
    path.join(__dirname, '../netlify/functions/ig-instant-draft.js'),
    'utf8'
);
assert.match(draftSource, /acquisition_mode: acquisitionMode/);
assert.match(draftSource, /offer_flow_variant: metaAdFlowVariant/);
assert.match(draftSource, /acquisition_mode: acquisitionMode \|\| resolveIgAcquisitionMode/);

console.log('ig acquisition mode tests passed');
