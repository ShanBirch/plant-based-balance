const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    freshQualifier,
    normalizeQualifier,
    deriveCommercialStage,
    hasDirectBuyerIntent,
    hasCommercialProblemEvidence,
} = require('../netlify/functions/_lib/qualifier-engine');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260716120000_ig_sales_readiness_pipeline.sql'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

function qualifier(overrides = {}) {
    const base = freshQualifier();
    return normalizeQualifier({
        ...base,
        meaningful_lead_reply_count: 6,
        facts: {
            ...base.facts,
            current_state: 'training drops when work gets messy',
            motivation: 'wants to build a consistent training routine',
            history_blockers: 'long shifts disrupt food and training',
        },
        behavior_profile: {
            ...base.behavior_profile,
            primary_need: 'structure',
            sales_readiness: 'problem_named',
        },
        ...overrides,
    });
}

test('buyer intent requires a personal commercial move', () => {
    assert.equal(hasDirectBuyerIntent('Do you incorporate mindfulness into your coaching?'), false);
    assert.equal(hasDirectBuyerIntent('I started a new job today'), false);
    assert.equal(hasDirectBuyerIntent('Can you send me the coaching details?'), true);
    assert.equal(hasDirectBuyerIntent('How much is it?'), true);
    assert.equal(hasDirectBuyerIntent("I'm ready to work with you"), true);
});

test('commercial stages do not use reply warmth as purchase intent', () => {
    const casual = normalizeQualifier({
        ...freshQualifier(),
        warmth_score: 95,
        meaningful_lead_reply_count: 20,
    });
    assert.equal(casual.commercial_stage, 'engaged');

    const problem = qualifier();
    assert.equal(problem.commercial_stage, 'problem_qualified');

    const offer = qualifier({
        behavior_profile: {
            primary_need: 'structure',
            sales_readiness: 'bridge_ready',
        },
    });
    assert.equal(offer.commercial_stage, 'offer_ready');

    assert.equal(deriveCommercialStage({
        qualifier: problem,
        currentMessage: 'Can you send me the link?',
    }), 'buyer_intent');
});

test('personal hardship and peer curiosity are not automatically sales problems', () => {
    assert.equal(hasCommercialProblemEvidence({
        facts: {
            current_state: 'going through a painful breakup and feeling overwhelmed',
            history_blockers: 'my former partner moved away',
        },
        behavior_profile: { primary_need: 'emotional_support' },
    }), false);

    assert.equal(hasCommercialProblemEvidence({
        facts: {
            current_state: 'I am a holistic practitioner and coach',
            history_blockers: 'curious how you use mindfulness in your coaching business',
        },
        behavior_profile: { primary_need: 'professional_networking' },
    }), false);

    assert.equal(hasCommercialProblemEvidence({
        facts: {
            current_state: 'the vets wanted to put my cat down but he keeps flourishing',
            history_blockers: 'his health has been hard and painful',
        },
        behavior_profile: { primary_need: 'structure' },
    }), false);
});

test('motivation without a real unsolved blocker stays engaged', () => {
    const noBlocker = qualifier({
        facts: {
            current_state: 'training is part of my life',
            motivation: 'I want to keep building strength',
            history_blockers: 'nothing really stops me',
        },
    });
    assert.equal(hasCommercialProblemEvidence(noBlocker), false);
    assert.equal(deriveCommercialStage({ qualifier: noBlocker }), 'engaged');

    const existingCoach = qualifier({
        facts: {
            current_state: 'working toward a strength goal',
            motivation: 'want to get stronger',
            history_blockers: 'time makes consistency hard',
        },
        behavior_profile: {
            primary_need: 'structure',
            protection_pattern: 'existing_support_or_trainer',
            sales_readiness: 'problem_named',
        },
    });
    assert.equal(hasCommercialProblemEvidence(existingCoach), false);
    assert.equal(deriveCommercialStage({ qualifier: existingCoach }), 'engaged');

    const declined = qualifier({
        facts: {
            current_state: 'trying to train consistently',
            motivation: 'want more strength',
            history_blockers: 'work gets in the way',
            commitment: 'not right now',
        },
    });
    assert.equal(hasCommercialProblemEvidence(declined), false);
    assert.equal(deriveCommercialStage({ qualifier: declined }), 'engaged');
});

test('database routing uses strict stages and preserves acquisition capacity', () => {
    assert.match(migration, /ig_inbound_has_buyer_intent/);
    assert.match(migration, /ig_inbound_has_call_intent/);
    assert.match(migration, /problem_qualified/);
    assert.match(migration, /offer_ready/);
    assert.match(migration, /buyer_intent/);
    assert.match(migration, /problem_followup_sent/);
    assert.match(migration, /get_ig_acquisition_capacity/);
    assert.doesNotMatch(migration, /warmth_label[^\n]+IN \('warm', 'hot'\)/i);
});

test('admin scorecard reports the commercial funnel rather than warm reply volume', () => {
    assert.match(dashboard, /\['Engaged'/);
    assert.match(dashboard, /\['Problem-qualified'/);
    assert.match(dashboard, /\['Offer-ready'/);
    assert.match(dashboard, /\['Buyer intent'/);
    assert.doesNotMatch(dashboard, /\['Warm now'/);
});
