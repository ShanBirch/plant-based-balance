const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildMetaAdFoundersPassFirstReply, resolveMetaAdFlowVariant } = require('../netlify/functions/ig-instant-draft')._test;

test('first ad-attributed DM sends the app preview and canonical offer', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?");
    assert.equal(reply.model, 'deterministic_meta_ad_founders_pass_v1');
    assert.equal(reply.chunks.length, 2);
    assert.match(reply.chunks[0], /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.chunks[1], /AU\$99 once/);
    assert.match(reply.chunks[1], /six weeks of one-to-one in-app support with me/i);
    assert.match(reply.chunks[1], /lifetime access to the core app and plant-based community/i);
    assert.match(reply.chunks[1], /plant-based-fitness\.html/);
});

test('fit quick reply receives a concise fit statement', () => {
    const reply = buildMetaAdFoundersPassFirstReply('Is this right for me?');
    assert.match(reply.joined, /built for plant-based people/i);
    assert.doesNotMatch(reply.joined, /vegan fitness community/i);
});

test('broad ad route stays broad through the first DM and link handoff', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?", { flowVariant: 'broad_pain' });
    assert.equal(reply.flowVariant, 'broad_pain');
    assert.doesNotMatch(reply.joined, /plant[ -]?based|vegan|vegetarian/i);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.joined, /future-balance\.netlify\.app\/fitness-coaching\.html/);
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
