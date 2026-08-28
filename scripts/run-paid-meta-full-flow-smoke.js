#!/usr/bin/env node
process.env.AI_USAGE_LOG_DISABLED = 'true';

const {
    generateDraft,
    collectPaidMetaWriterContractIssues,
    isBlockingPaidMetaWriterContractIssue,
    buildPaidMetaGuaranteedContractFallback,
    repairCocosDraftFromReview,
    buildDeterministicPaidMetaConversationReply,
    shouldApplyDeterministicPaidMetaReplyOverride,
} = require('../netlify/functions/ig-instant-draft')._test;
const { evaluateQualifier } = require('../netlify/functions/_lib/qualifier-engine');
const { buildMetaAppPreviewUrl, isMetaAppPreviewUrl } = require('../netlify/functions/_lib/meta-app-preview-ref');

const OPENER = 'Hey, yeah of course. The Founders Pass is for our six-week plant-based fitness program inside Balance. Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?';
const TEST_THREAD_ID = '11111111-2222-4333-8444-555555555555';
const APP_PREVIEW_URL = buildMetaAppPreviewUrl(TEST_THREAD_ID, {
    env: { META_APP_PREVIEW_REF_SECRET: 'paid-meta-full-flow-smoke-secret' },
});

const scenarios = [
    { name: 'transition three nights, weight loss, shifts', identity: 'I am looking to adopt. I eat plant based 3 nights a week now.', goal: 'I want to lose about 8kg and feel fitter.', blocker: 'My shifts change every week so I can never keep a routine.', accept: 'Yep, give me a look.' },
    { name: 'vegan five years, fitness, consistency', identity: 'I have been vegan for 5 years.', goal: 'I mainly want to get fitter and feel better in my clothes.', blocker: 'I start well but always fall off after a couple of weeks.', accept: 'Yeah, I would like to have a look.' },
    { name: 'new transition, fat loss, food prep', identity: 'Not fully yet, I am trying to go more plant based.', goal: 'My goal is to lose body fat and have more energy.', blocker: 'Food is the hard part. I run out of time and never prep anything.', accept: 'Yes, that sounds really good.' },
    { name: 'plant based two years, muscle, no program', identity: 'I have been plant based for 2 years.', goal: 'I want to build muscle and get stronger.', blocker: 'I train randomly because I do not have a proper workout plan.', accept: 'Definitely, I would like to check it out.' },
    { name: 'mostly plant based, energy, busy work', identity: 'Mostly plant based, probably 5 nights a week.', goal: 'I want more energy and to improve my fitness.', blocker: 'Work gets busy and then training and meals are the first things I drop.', accept: 'Yep, that would really help.' },
    { name: 'vegan nine years, lose weight, cravings', identity: 'I am vegan and have been for 9 years. How about you?', goal: 'I would like to lose weight without feeling restricted.', blocker: 'Cravings and weekends are where I lose track.', accept: 'Absolutely, I would like a look.' },
    { name: 'vegetarian transition, fitter, accountability', identity: 'I am vegetarian but looking to become fully plant based.', goal: 'I want to feel fitter and be more consistent.', blocker: 'Accountability is the main thing. I stop following through on my own.', accept: 'Yeah, I think so.' },
    { name: 'four plant nights, strength, overwhelmed', identity: 'I am up to plant based meals about 4 nights a week.', goal: 'I want to improve my health and strength.', blocker: 'There is so much information that I get overwhelmed and do nothing.', accept: 'That sounds really good.' },
    { name: 'plant based, post pregnancy goal, no time', identity: 'I am currently plant based.', goal: 'I want to get fitter and lose the weight I gained during pregnancy.', blocker: 'I do not have much time, so I miss a session and struggle to restart.', accept: 'Yes, I would like to have a look.' },
    { name: 'vegan one year, running goal, inconsistent training', identity: 'Vegan for just over a year now.', goal: 'I want to get fit enough to run 5km comfortably.', blocker: 'My training is inconsistent and I never know what workout to do next.', accept: 'Yep, send me access.' },
];

function normalizeQuestion(value = '') {
    return String(value).toLowerCase().replace(/[^a-z0-9?\s]/g, '').replace(/\s+/g, ' ').trim();
}

function questions(value = '') {
    return (String(value).match(/[^.!?]*\?/g) || []).map(normalizeQuestion);
}

async function evaluateTurnQualifier({ qualifier, history, inbound }) {
    const result = await evaluateQualifier({
        thread: {
            qualifier: qualifier || null,
            custom_data: {
                acquisition_mode: 'paid_meta',
                offer_flow_variant: 'plant_based_control',
                meta_ad_attribution: { source: 'meta_ads', platform_source: 'ADS' },
            },
        },
        history,
        currentMessage: inbound,
        draftText: '',
        leadName: 'Test Lead',
        channel: 'instagram',
    });
    return {
        qualifier: result.evaluated ? result.qualifier : (qualifier || { commercial_stage: 'engaged', facts: {} }),
        model: result.model || null,
        error: result.error || null,
    };
}

async function composeTurn({ qualifier, history, inbound }) {
    const evaluated = await evaluateTurnQualifier({ qualifier, history, inbound });
    const turnQualifier = evaluated.qualifier;
    const deterministic = buildDeterministicPaidMetaConversationReply({
        currentMessage: inbound,
        qualifier: turnQualifier,
        history,
        flowVariant: 'plant_based_control',
        checkoutUrl: 'https://plantbased-balance.org/founders',
        appPreviewUrl: APP_PREVIEW_URL,
        personalVoiceNoteMode: false,
        allowVideoAttachment: false,
    });
    if (shouldApplyDeterministicPaidMetaReplyOverride(deterministic)) {
        return { draft: deterministic, qualifier: turnQualifier, qualifierModel: evaluated.model, qualifierError: evaluated.error, contractIssues: [] };
    }

    let draft = await generateDraft({
        leadName: 'Test Lead',
        leadBlock: '',
        profileBlock: '',
        memoryBlock: '',
        history,
        currentMessage: inbound,
        recentInboundMessages: [],
        leadStage: 'qualifying',
        channel: 'instagram',
        igThreadId: TEST_THREAD_ID,
        linkedUserId: null,
        priorScheduledDrafts: [],
        linkedNudges: [],
        recentWorkoutEvidence: '',
        weeklyAppContext: '',
        onboardingPhase: null,
        qualifier: turnQualifier,
        qualifierQuestion: turnQualifier?.is_question_moment && turnQualifier?.next_question ? turnQualifier.next_question : null,
        botAccount: 'shan_n_sunny',
        acquisitionMode: 'paid_meta',
        adFlowVariant: 'plant_based_control',
        checkoutUrl: 'https://plantbased-balance.org/founders',
    });
    let issues = collectPaidMetaWriterContractIssues({ draft, currentMessage: inbound, qualifier: turnQualifier, history });
    if (issues.length) {
        const repaired = await repairCocosDraftFromReview({
            draft,
            repairIssues: issues,
            reviewContextBlocks: [
                'Paid Meta Instagram full-flow smoke conversation.',
                `Current inbound: ${inbound}`,
                `Known qualifier: ${JSON.stringify(turnQualifier || {})}`,
                `Timeline:\n${history.map(message => `${message.direction === 'in' ? 'Lead' : 'Shannon'}: ${message.text}`).join('\n')}`,
            ].join('\n\n'),
            leadName: 'Test Lead',
            channelLabel: 'Instagram',
            maxChunks: draft.maxChunks || 3,
            currentMessage: inbound,
            qualifier: turnQualifier,
            businessName: 'Balance',
            paidMetaMode: true,
        });
        if (repaired?.joined) draft = repaired;
        issues = collectPaidMetaWriterContractIssues({ draft, currentMessage: inbound, qualifier: turnQualifier, history });
    }
    const blocking = issues.filter(isBlockingPaidMetaWriterContractIssue);
    if (blocking.length) {
        const fallback = buildPaidMetaGuaranteedContractFallback({
            draft,
            currentMessage: inbound,
            issues: blocking,
            qualifier: turnQualifier,
            history,
        });
        if (fallback?.joined) draft = fallback;
        issues = collectPaidMetaWriterContractIssues({ draft, currentMessage: inbound, qualifier: turnQualifier, history });
    }
    return { draft, qualifier: turnQualifier, qualifierModel: evaluated.model, qualifierError: evaluated.error, contractIssues: issues };
}

function stageFailures(stage, reply, history) {
    const failures = [];
    const lower = String(reply || '').toLowerCase();
    if (!reply) failures.push(`${stage}:empty_reply`);
    const earlierQuestions = history.filter(item => item.direction === 'out').flatMap(item => questions(item.text));
    const repeated = questions(reply).filter(question => earlierQuestions.includes(question));
    if (repeated.length) failures.push(`${stage}:repeated_question:${repeated.join('|')}`);
    if (stage === 'identity') {
        if (!/\b(?:goal|result|achiev|health|fitness|fit|strong|energy|weight|change|working towards)\b/i.test(reply) || !/\?/.test(reply)) failures.push('identity:missing_goal_question');
        if (/\$\s*149|founders pass|send (?:you )?(?:the )?(?:link|access)|https?:\/\//i.test(reply)) failures.push('identity:pitched_too_early');
    }
    if (stage === 'goal') {
        if (!/\?/.test(reply) || !/\b(?:get in the way|gets in the way|getting in the way|hard|stop|stick|consistent|consistently|track|routine|knock|disrupt|prevent)\b/i.test(reply)) failures.push('goal:missing_blocker_question');
        if (/\$\s*149|founders pass|send (?:you )?(?:the )?(?:link|access)|https?:\/\//i.test(reply)) failures.push('goal:pitched_before_blocker');
    }
    if (stage === 'blocker') {
        const required = [
            ['six_weeks', /\b(?:six|6)[- ]week/i],
            ['workout', /\bworkout|training program/i],
            ['meal_plan', /\bmeal plan/i],
            ['weekly_review', /\bweekly\b[\s\S]{0,90}\b(?:check[ -]?in|review|adjust)/i],
            ['price', /\$\s*149\b/i],
            ['no_renewal', /\b(?:no|doesn['’]?t|does not|won['’]?t|will not)\b[\s\S]{0,60}\b(?:subscription|renew|auto-renew)/i],
            ['before_payment', /\b(?:look|inside|access|set yourself up)\b[\s\S]{0,140}\bbefore (?:you )?pay/i],
            ['consent', /\?/],
        ];
        for (const [name, pattern] of required) if (!pattern.test(reply)) failures.push(`blocker:missing_${name}`);
        if (/https?:\/\//i.test(reply)) failures.push('blocker:link_before_acceptance');
    }
    if (stage === 'accept') {
        const url = String(reply).match(/https?:\/\/\S+/)?.[0]?.replace(/[),.!?]+$/, '') || '';
        if (!url || !isMetaAppPreviewUrl(url)) failures.push('accept:missing_valid_app_preview_link');
        if (/\/founders(?:\b|\?)/i.test(url)) failures.push('accept:sent_checkout_instead_of_preview');
    }
    if (/partway there.*what would you mainly like help with fitness-wise/i.test(lower)) failures.push(`${stage}:stale_hardcoded_fallback`);
    return failures;
}

async function runScenario(scenario, index, { compose = composeTurn } = {}) {
    let history = [{ direction: 'out', text: OPENER }];
    let qualifier = null;
    const turns = [];
    const failures = [];
    for (const [stage, inbound] of [['identity', scenario.identity], ['goal', scenario.goal], ['blocker', scenario.blocker], ['accept', scenario.accept]]) {
        history.push({ direction: 'in', text: inbound });
        const result = await compose({ qualifier, history: history.slice(0, -1), inbound });
        const reply = result.draft?.joined || '';
        const turnFailures = [
            ...stageFailures(stage, reply, history.slice(0, -1)),
            ...(result.contractIssues || []).map(issue => `${stage}:contract:${issue}`),
        ];
        turns.push({ stage, inbound, reply, model: result.draft?.model || null, qualifier_model: result.qualifierModel, qualifier: result.qualifier, failures: turnFailures });
        failures.push(...turnFailures);
        qualifier = result.qualifier;
        history.push({ direction: 'out', text: reply });
    }
    return { run: index + 1, name: scenario.name, opener: OPENER, turns, pass: failures.length === 0, failures };
}

async function main() {
    if (!isMetaAppPreviewUrl(APP_PREVIEW_URL)) throw new Error('Smoke app-preview URL is invalid.');
    const remoteUrl = String(process.env.PAID_META_SMOKE_REMOTE_URL || '').replace(/\/$/, '');
    const remoteToken = String(process.env.PAID_META_SMOKE_REMOTE_TOKEN || '');
    const scope = remoteUrl ? 'remote_draft_turn_contract' : 'local_draft_generation_contract';
    process.stderr.write(
        'DRAFT-CONTRACT SMOKE ONLY: this does not verify Meta webhook capture, draft-review approval, Graph dispatch, or canonical outbound readback.\n'
    );
    const compose = remoteUrl
        ? async payload => {
            const response = await fetch(`${remoteUrl}/.netlify/functions/paid-meta-full-flow-smoke-turn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-paid-meta-smoke-token': remoteToken },
                body: JSON.stringify(payload),
            });
            const text = await response.text();
            if (!response.ok) throw new Error(`Remote smoke turn failed ${response.status}: ${text.slice(0, 500)}`);
            return JSON.parse(text);
        }
        : composeTurn;
    const results = await Promise.all(scenarios.map(async (scenario, index) => {
        const result = await runScenario(scenario, index, { compose });
        process.stderr.write(`draft-contract ${index + 1}/10 ${result.pass ? 'PASS' : 'FAIL'}: ${result.name}\n`);
        return result;
    }));
    const summary = {
        scope,
        delivery_verified: false,
        passed: results.filter(result => result.pass).length,
        failed: results.filter(result => !result.pass).length,
        results,
    };
    process.stdout.write(`PAID_META_DRAFT_CONTRACT_RESULTS=${JSON.stringify(summary)}\n`);
    if (summary.failed) process.exitCode = 1;
}

module.exports = {
    OPENER,
    APP_PREVIEW_URL,
    scenarios,
    composeTurn,
    stageFailures,
    runScenario,
    main,
};

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
