const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildMetaAdCheckoutUrl,
    buildMetaAdFoundersPassFirstReply,
    buildMetaAdFirstReplyApproval,
    buildLeadOnboardingHandoffData,
    resolveMetaAdFirstReplyIntent,
    resolveMetaAdFlowVariant,
} = require('../netlify/functions/ig-instant-draft')._test;

test('inclusions quick reply sends the app preview and attributed checkout handoff', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?");
    assert.equal(reply.model, 'deterministic_meta_ad_founders_pass_v2');
    assert.equal(reply.firstReplyIntent, 'inclusions');
    assert.equal(reply.chunks.length, 2);
    assert.match(reply.chunks[0], /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.chunks[1], /AU\$99 once/);
    assert.match(reply.chunks[1], /six weeks of one-to-one in-app support with me for questions, direction and accountability/i);
    assert.match(reply.chunks[1], /lifetime access to the core app and plant-based community/i);
    assert.match(reply.chunks[1], /weekly plan reviews and adjustments are separate/i);
    assert.match(reply.chunks[1], /plant-based-fitness\.html/);
});

test('generic keyword and fit quick reply answer without a premature checkout link', () => {
    const overview = buildMetaAdFoundersPassFirstReply('BALANCE');
    assert.equal(overview.firstReplyIntent, 'overview');
    assert.equal(overview.checkoutUrl, null);
    assert.doesNotMatch(overview.joined, /plant-based-fitness\.html/);
    assert.equal(buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft: overview,
    }).code, 'approved_meta_ad_first_reply');

    const reply = buildMetaAdFoundersPassFirstReply('Is this right for me?');
    assert.equal(reply.firstReplyIntent, 'fit');
    assert.match(reply.joined, /good fit if you want plant-based training/i);
    assert.doesNotMatch(reply.joined, /plant-based-fitness\.html/);
    assert.doesNotMatch(reply.joined, /vegan fitness community/i);
});

test('plant-based requirement and ready prompts receive different next steps', () => {
    const requirement = buildMetaAdFoundersPassFirstReply('Do I need to already be Plant Based?');
    assert.equal(requirement.firstReplyIntent, 'plant_based_requirement');
    assert.match(requirement.joined, /do not need to already be fully plant-based/i);
    assert.doesNotMatch(requirement.joined, /plant-based-fitness\.html/);

    const ready = buildMetaAdFoundersPassFirstReply("I'm ready to start");
    assert.equal(ready.firstReplyIntent, 'ready');
    assert.match(ready.joined, /quick setup and start here/i);
    assert.match(ready.joined, /plant-based-fitness\.html/);
    assert.equal(buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft: ready,
    }).code, 'approved_meta_ad_buyer_handoff');
});

test('broad ad route stays broad through the first DM and link handoff', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?", { flowVariant: 'broad_pain' });
    assert.equal(reply.flowVariant, 'broad_pain');
    assert.doesNotMatch(reply.joined, /plant[ -]?based|vegan|vegetarian/i);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.joined, /future-balance\.netlify\.app\/fitness-coaching\.html/);
});

test('stored Meta identifiers survive the DM link and approved handoff gate', () => {
    const customData = {
        meta_ad_attribution: {
            source: 'meta_ads',
            campaign_id: '120210001',
            adset_id: '120210002',
            ad_id: '120210003',
            creative_id: '120210004',
            placement: 'instagram_reels',
            ad_name: 'A1 Brain Angle',
            ref: 'balance_plant_based_a1',
        },
        current_inbound_routing: {
            source: 'meta_ads',
            ad_id: '120210003',
        },
    };
    const checkoutUrl = buildMetaAdCheckoutUrl({ customData, flowVariant: 'plant_based_control' });
    const parsed = new URL(checkoutUrl);
    assert.equal(parsed.searchParams.get('campaign_id'), '120210001');
    assert.equal(parsed.searchParams.get('adset_id'), '120210002');
    assert.equal(parsed.searchParams.get('ad_id'), '120210003');
    assert.equal(parsed.searchParams.get('creative_id'), '120210004');
    assert.equal(parsed.searchParams.get('placement'), 'instagram_reels');
    assert.equal(parsed.searchParams.get('meta_ad_name'), 'A1 Brain Angle');
    assert.equal(parsed.searchParams.get('meta_ref'), 'balance_plant_based_a1');

    const ready = buildMetaAdFoundersPassFirstReply("I'm ready to start", { customData });
    const handoff = buildLeadOnboardingHandoffData({
        draftText: ready.joined,
        qualifier: {},
        leadStage: 'new',
        linkedUserId: null,
        threadId: 'thread-1',
        manychatMessageId: 'mid-1',
        currentMessage: "I'm ready to start",
    });
    assert.equal(handoff.approved_link_auto_sendable, true);
    assert.match(handoff.signup_link_handoff_url, /ad_id=120210003/);
});

test('details count as buyer intent for the approved attributed link', () => {
    assert.equal(resolveMetaAdFirstReplyIntent("What's actually included?"), 'inclusions');
    const reply = buildMetaAdFoundersPassFirstReply("What's actually included?");
    const handoff = buildLeadOnboardingHandoffData({
        draftText: reply.joined,
        qualifier: {},
        leadStage: 'new',
        linkedUserId: null,
        currentMessage: "What's actually included?",
    });
    assert.equal(handoff.approved_link_auto_sendable, true);
    assert.equal(handoff.client_manager_review_required, undefined);
});

test('Meta referral hint preserves the broad route independently of message wording', () => {
    const variant = resolveMetaAdFlowVariant({
        customData: {
            meta_ad_attribution: { ref: 'balance_broad_pain_b2' },
            current_inbound_routing: { source: 'meta_ads', ad_id: 'example-ad-id' },
        },
        currentMessage: 'Can I see what is included?',
    });
    assert.equal(variant, 'broad_pain');
});

test('campaign package remains paused and points to the deployed funnel assets', () => {
    const root = path.join(__dirname, '..');
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'output/meta-founders-pass-campaign-2026-07-22/campaign-plan.json'), 'utf8'));
    assert.equal(plan.status, 'PAUSED');
    assert.equal(plan.budget.amountAud, 20);
    assert.equal(plan.budget.estimatedTestSpendAud, 140);
    assert.equal(plan.dmWelcome.appPreview, 'https://plantbased-balance.org/assets/balance-founders-pass-dm-preview.mp4');
    assert.equal(plan.dmWelcome.checkoutUrl, 'https://plantbased-balance.org/plant-based-fitness.html');
    assert.ok(fs.statSync(path.join(root, 'assets', 'balance-founders-pass-dm-preview.mp4')).size > 1_000_000);
});
