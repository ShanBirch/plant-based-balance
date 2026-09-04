#!/usr/bin/env node
process.env.AI_USAGE_LOG_DISABLED = 'true';

const {
    buildMetaAdFoundersPassFirstReply,
    buildDeterministicPaidMetaConversationReply,
} = require('../netlify/functions/ig-instant-draft')._test;
const { buildMetaAppPreviewUrl, isMetaAppPreviewUrl } = require('../netlify/functions/_lib/meta-app-preview-ref');
const { resolveBalanceFoundationsAppProofVideoUrl } = require('../netlify/functions/_lib/paid-meta-proof-media');

const TEST_THREAD_ID = '11111111-2222-4333-8444-555555555555';
const CHECKOUT_URL = 'https://future-balance.netlify.app/fitness';
const APP_PREVIEW_URL = buildMetaAppPreviewUrl(TEST_THREAD_ID, {
    flowVariant: 'broad_pain',
    env: { META_APP_PREVIEW_REF_SECRET: 'paid-meta-full-flow-smoke-secret' },
});

const scenarios = [
    {
        name: 'restart loop to weight-loss proof',
        quickReply: 'I keep starting over',
        goal: 'I want to lose 8kg and feel fitter.',
        blocker: 'My shifts change every week so I can never keep a routine.',
        expectedProof: /ally-cocos\.png$/,
    },
    {
        name: 'consistency to strength proof',
        quickReply: 'I struggle to stay consistent',
        goal: 'I want to build muscle and feel stronger.',
        blocker: 'I train randomly because I never know which workout comes next.',
        expectedProof: /gen-cocos\.jpg$/,
    },
    {
        name: 'course explainer to shared-accountability proof',
        quickReply: 'How does Balance work?',
        goal: 'My partner and I want to get fitter together.',
        blocker: 'We start well but struggle to keep each other accountable.',
        expectedProof: /bec-kirsty-cocos\.png$/,
    },
];

function has(pattern, value) {
    return pattern.test(String(value || ''));
}

function addFailure(failures, condition, label) {
    if (!condition) failures.push(label);
}

function runScenario(scenario, index) {
    const failures = [];
    const entry = buildMetaAdFoundersPassFirstReply(scenario.quickReply, { flowVariant: 'broad_pain' });
    addFailure(failures, has(/neuroscience/i, entry.joined), 'entry:missing_neuroscience');
    addFailure(failures, has(/psychology/i, entry.joined), 'entry:missing_psychology');
    addFailure(failures, has(/main change.*(?:in|over) the next six weeks\?/i, entry.joined), 'entry:missing_goal_question');
    addFailure(failures, !has(/https?:\/\/|\$149|plant[ -]?based|vegan/i, entry.joined), 'entry:pitch_or_old_positioning');

    const goal = buildDeterministicPaidMetaConversationReply({
        currentMessage: scenario.goal,
        qualifier: { commercial_stage: 'engaged', facts: { current_state: scenario.goal } },
        history: [
            { direction: 'in', text: scenario.quickReply },
            { direction: 'out', text: entry.joined },
        ],
        flowVariant: 'broad_pain',
        checkoutUrl: CHECKOUT_URL,
        appPreviewUrl: APP_PREVIEW_URL,
    });
    addFailure(failures, scenario.expectedProof.test(String(goal.imageAttachmentUrl || '')), 'goal:wrong_client_photo');
    addFailure(failures, has(/what usually gets in the way/i, goal.joined), 'goal:missing_blocker_question');
    addFailure(failures, !has(/https?:\/\/|\$149/i, goal.joined), 'goal:pitch_before_blocker');

    const historyThroughGoal = [
        { direction: 'in', text: scenario.quickReply },
        { direction: 'out', text: entry.joined },
        { direction: 'in', text: scenario.goal },
        { direction: 'out', text: goal.joined },
    ];
    const offer = buildDeterministicPaidMetaConversationReply({
        currentMessage: scenario.blocker,
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { current_state: scenario.goal, history_blockers: scenario.blocker },
        },
        history: historyThroughGoal,
        flowVariant: 'broad_pain',
        checkoutUrl: CHECKOUT_URL,
        appPreviewUrl: APP_PREVIEW_URL,
    });
    addFailure(failures, has(/six-week course.*neuroscience and psychology/i, offer.joined), 'offer:missing_change_science');
    addFailure(failures, has(/workout program/i, offer.joined), 'offer:missing_workout');
    addFailure(failures, has(/meal plan fitted to your dietary preferences/i, offer.joined), 'offer:missing_food_support');
    addFailure(failures, has(/weekly check-in/i, offer.joined), 'offer:missing_weekly_checkin');
    addFailure(failures, has(/one AUD \$149 payment for the full six weeks/i, offer.joined), 'offer:missing_terms');
    addFailure(failures, has(/no subscription or auto-renewal/i, offer.joined), 'offer:missing_no_renewal');
    addFailure(failures, offer.videoAttachmentUrl === resolveBalanceFoundationsAppProofVideoUrl(), 'offer:missing_app_video');
    addFailure(failures, has(/personalised preview/i, offer.joined), 'offer:missing_preview_question');
    addFailure(failures, !has(/https?:\/\//i, offer.joined), 'offer:link_before_consent');

    const historyThroughOffer = [
        ...historyThroughGoal,
        { direction: 'in', text: scenario.blocker },
        ...offer.chunks.map(text => ({ direction: 'out', text })),
        { direction: 'out', text: `[VIDEO:${offer.videoAttachmentUrl}]` },
    ];
    const preview = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yes please, show me the preview.',
        qualifier: {
            commercial_stage: 'offer_ready',
            facts: { current_state: scenario.goal, history_blockers: scenario.blocker },
        },
        history: historyThroughOffer,
        flowVariant: 'broad_pain',
        checkoutUrl: CHECKOUT_URL,
        appPreviewUrl: APP_PREVIEW_URL,
    });
    addFailure(failures, preview.appPreviewHandoff === true, 'preview:handoff_not_marked');
    addFailure(failures, has(/future-balance\.netlify\.app\/p\//i, preview.joined), 'preview:missing_signed_link');
    addFailure(failures, !has(/\/fitness(?:\b|\?)/i, preview.joined), 'preview:checkout_sent_early');

    const checkout = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I want to join.',
        qualifier: {
            commercial_stage: 'purchase_ready',
            facts: { current_state: scenario.goal, history_blockers: scenario.blocker },
        },
        history: [
            ...historyThroughOffer,
            { direction: 'in', text: 'Yes please, show me the preview.' },
            { direction: 'out', text: preview.joined },
        ],
        flowVariant: 'broad_pain',
        checkoutUrl: CHECKOUT_URL,
        appPreviewUrl: APP_PREVIEW_URL,
    });
    addFailure(failures, has(/future-balance\.netlify\.app\/fitness/i, checkout.joined), 'checkout:missing_after_explicit_request');

    return {
        run: index + 1,
        name: scenario.name,
        quick_reply: scenario.quickReply,
        pass: failures.length === 0,
        failures,
        stages: {
            entry: entry.joined,
            client_photo: goal.imageAttachmentUrl,
            offer_video: offer.videoAttachmentUrl,
            preview: preview.joined,
            checkout: checkout.joined,
        },
    };
}

function main() {
    if (!isMetaAppPreviewUrl(APP_PREVIEW_URL)) throw new Error('Smoke app-preview URL is invalid.');
    process.stderr.write('DETERMINISTIC PAID-META FLOW SMOKE: quick reply, client proof, app video, preview, then explicit checkout.\n');
    const results = scenarios.map((scenario, index) => {
        const result = runScenario(scenario, index);
        process.stderr.write(`flow ${index + 1}/${scenarios.length} ${result.pass ? 'PASS' : 'FAIL'}: ${result.name}\n`);
        return result;
    });
    const summary = {
        scope: 'local_deterministic_paid_meta_flow',
        delivery_verified: false,
        passed: results.filter(result => result.pass).length,
        failed: results.filter(result => !result.pass).length,
        results,
    };
    process.stdout.write(`PAID_META_FLOW_RESULTS=${JSON.stringify(summary)}\n`);
    if (summary.failed) process.exitCode = 1;
}

module.exports = {
    APP_PREVIEW_URL,
    CHECKOUT_URL,
    scenarios,
    runScenario,
    main,
};

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
}
