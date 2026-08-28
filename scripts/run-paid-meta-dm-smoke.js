#!/usr/bin/env node
process.env.AI_USAGE_LOG_DISABLED = 'true';

const {
    generateDraft,
    collectPaidMetaWriterContractIssues,
    repairCocosDraftFromReview,
} = require('../netlify/functions/ig-instant-draft')._test;
const { evaluateQualifier } = require('../netlify/functions/_lib/qualifier-engine');

const opener = 'Hey, yeah of course. The Founders Pass is for our six-week plant-based fitness program inside Balance. Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?';

const scenarios = [
    {
        name: 'identity plus reciprocal question',
        history: [{ direction: 'out', text: opener }],
        inbound: "I'm vegan and have been for 9 years. How about you?",
        next: 'Acknowledge nine years, answer Shannon has been vegan five years, then ask one fitness-goal question.',
        required: [/nine|9/i, /five|5/i, /fitness|health|goal|training|workout|change/i, /\?/],
        forbidden: [/\bkids?\b/i],
    },
    {
        name: 'two-bubble transition answer',
        history: [{ direction: 'out', text: opener }],
        priorInbound: [{ text: 'I still eat meat twice a week' }],
        inbound: 'But I want to go more plant based',
        next: 'Recognise the transition without treating them as fully plant-based, then ask one relevant goal question.',
        required: [/plant|shift|transition|part way|partway/i, /fitness|health|goal|training|workout|change/i, /\?/],
    },
    {
        name: 'adopt wording plus mistyped plant-based frequency',
        history: [{ direction: 'out', text: opener }],
        priorInbound: [{ text: "I'm looking to adopt" }],
        inbound: 'Right now I eat any based 3 nights a week',
        next: 'Recognise three nights a week as an adoption starting point, ask what they want help with fitness-wise, and do not pitch yet.',
        required: [/3|three|part[ -]?way|solid start|good start/i, /fitness|health|goal|training|workout|change|help with/i, /\?/],
        forbidden: [/\$|founders pass|six[- ]week|send (?:the )?(?:link|details)/i],
    },
    {
        name: 'five years and accountability',
        history: [
            { direction: 'out', text: opener },
            { direction: 'in', text: 'I am currently plant based' },
            { direction: 'out', text: "That's great. How long have you been plant-based, and what would you like help with fitness-wise?" },
        ],
        inbound: "I've been plant based for 5 years! I think I need accountability",
        next: 'Use only five years and accountability. Do not invent kids, work, food or prep.',
        required: [/five|5/i, /accountab|keep\w* (?:you )?on track|keeping (?:you )?on track/i, /\?/],
        forbidden: [/\bkids?\b/i, /\bwork\b/i, /\bfood\b/i, /\bprep\b/i],
    },
    {
        name: 'curveball about proof client plus blocker',
        history: [{ direction: 'out', text: 'This is Ally. She lost 12kg in 16 weeks.' }],
        priorInbound: [
            { text: "She's done really well! Was this your client?" },
            { text: "I just can't stick to it" },
        ],
        inbound: 'I always fall off after a couple of weeks',
        next: 'Answer that Ally is a client and address the stop-start blocker without asking who the client was.',
        required: [/ally|she/i, /client/i, /fall|stick|couple of weeks/i],
        forbidden: [/your client or someone/i],
    },
    {
        name: 'rapid food bubbles',
        history: [{ direction: 'out', text: 'What tends to get in the way most?' }],
        priorInbound: [{ text: "I think it's just lack of time no prep" }],
        inbound: 'Bit of everything really, food is the main one',
        next: 'Use both bubbles and respond specifically to time, preparation and food.',
        required: [/time/i, /prep/i, /food|meal/i],
    },
    {
        name: 'post-pregnancy fitness goal',
        history: [{ direction: 'out', text: "What's the main thing you'd like help with fitness-wise?" }],
        inbound: 'I want to be fitter and lose the weight I gained during pregnancy',
        next: 'Respond supportively without diagnosing, inventing children or stopping the conversation medically.',
        required: [/fit|pregnan|weight/i],
        forbidden: [/\bkids?\b/i, /doctor|medical|diagnos/i],
    },
    {
        name: 'direct price question',
        history: [{ direction: 'out', text: opener }],
        inbound: 'How much is it and does it renew?',
        next: 'Answer $149 once for six weeks and no auto-renewal before any question.',
        required: [/\$149/i, /six[- ]weeks?/i, /doesn.t|no.*renew|not.*renew/i],
        forbidden: [/89\.99/i],
    },
    {
        name: 'inclusions and meal plan',
        history: [{ direction: 'out', text: opener }],
        inbound: 'Do I actually get workouts and a plant based meal plan?',
        next: 'Directly answer workouts, meal planning and weekly review without a brochure dump.',
        required: [/workout/i, /plant-based meal|meal plan/i, /weekly|check-in|review/i],
    },
    {
        name: 'sales suspicion',
        history: [
            { direction: 'out', text: opener },
            { direction: 'in', text: 'I want to lose weight' },
            { direction: 'out', text: 'What normally gets in the way?' },
        ],
        inbound: 'Are you just trying to sell me something?',
        next: 'Answer honestly, back off, and ask no fitness or sales question.',
        required: [/paid|sell|sale|program/i],
        maxQuestions: 0,
    },
    {
        name: 'tailored offer after known goal and blocker',
        history: [
            { direction: 'out', text: "What's your main goal?" },
            { direction: 'in', text: 'Lose 8kg and feel fitter' },
            { direction: 'out', text: 'What has made that hard before?' },
        ],
        inbound: 'Shift work changes every week so I can never keep a routine',
        next: 'Recognise changing shifts, explain a flexible setup, name the $149 six-week offer and ask whether they want to look inside.',
        required: [/shift/i, /(?:six|6)[- ]week/i, /\$149/i, /workout/i, /meal plan/i, /check-in|review/i, /look|access|inside/i, /\?/],
        forbidden: [/89\.99/i],
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { current_state: 'Wants to lose 8kg and feel fitter.', history_blockers: 'Changing shift work disrupts routine.' },
        },
    },
];

async function runScenario(scenario, index) {
    const fullInboundTurn = [...(scenario.priorInbound || []).map(item => item.text), scenario.inbound].join('\n');
    const qualifierResult = await evaluateQualifier({
        thread: {
            qualifier: scenario.qualifier || null,
            custom_data: {
                acquisition_mode: 'paid_meta',
                offer_flow_variant: 'broad_pain',
                meta_ad_attribution: { source: 'meta_ads' },
            },
        },
        history: scenario.history || [],
        currentMessage: fullInboundTurn,
        draftText: '',
        leadName: 'Test Lead',
        channel: 'instagram',
    });
    const qualifier = qualifierResult.evaluated
        ? qualifierResult.qualifier
        : (scenario.qualifier || { commercial_stage: 'engaged', facts: {} });
    const qualifierQuestion = qualifier?.is_question_moment && qualifier?.next_question
        ? qualifier.next_question
        : null;
    const initialDraft = await generateDraft({
        leadName: 'Test Lead',
        leadBlock: '',
        profileBlock: '',
        memoryBlock: '',
        history: scenario.history || [],
        currentMessage: scenario.inbound,
        recentInboundMessages: scenario.priorInbound || [],
        leadStage: 'qualifying',
        channel: 'instagram',
        igThreadId: null,
        linkedUserId: null,
        priorScheduledDrafts: [],
        linkedNudges: [],
        recentWorkoutEvidence: '',
        weeklyAppContext: '',
        onboardingPhase: null,
        qualifier,
        qualifierQuestion,
        botAccount: 'shan_n_sunny',
        acquisitionMode: 'paid_meta',
        adFlowVariant: 'broad_pain',
        checkoutUrl: 'https://future-balance.netlify.app/fitness',
    });
    const initialContractIssues = collectPaidMetaWriterContractIssues({
        draft: initialDraft,
        currentMessage: fullInboundTurn,
        qualifier,
        history: scenario.history || [],
    });
    let draft = initialDraft;
    let repairAttempted = false;
    if (initialContractIssues.length > 0) {
        repairAttempted = true;
        const repaired = await repairCocosDraftFromReview({
            draft: initialDraft,
            repairIssues: initialContractIssues,
            reviewContextBlocks: [
                'Paid Meta Instagram test conversation.',
                `Current unanswered inbound turn:\n${fullInboundTurn}`,
                `Known qualifier facts:\n${JSON.stringify(qualifier?.facts || {})}`,
                `Recent timeline:\n${(scenario.history || []).map(message => `${message.direction === 'in' ? 'Lead' : 'Shannon'}: ${message.text}`).join('\n')}`,
            ].join('\n\n'),
            leadName: 'Test Lead',
            channelLabel: 'Instagram',
            maxChunks: initialDraft.maxChunks || 3,
            currentMessage: fullInboundTurn,
            qualifier,
            businessName: 'Balance',
            paidMetaMode: true,
        });
        if (repaired?.joined) draft = repaired;
    }
    const reply = draft.joined || '';
    const finalContractIssues = collectPaidMetaWriterContractIssues({
        draft,
        currentMessage: fullInboundTurn,
        qualifier,
        history: scenario.history || [],
    });
    const missing = (scenario.required || []).filter(pattern => !pattern.test(reply)).map(String);
    const forbidden = (scenario.forbidden || []).filter(pattern => pattern.test(reply)).map(String);
    const questionCount = (reply.match(/\?/g) || []).length;
    const questionFailure = Number.isFinite(scenario.maxQuestions) && questionCount > scenario.maxQuestions
        ? [`questions:${questionCount}>${scenario.maxQuestions}`]
        : [];
    return {
        run: index + 1,
        name: scenario.name,
        inbound: [...(scenario.priorInbound || []).map(item => item.text), scenario.inbound],
        expected: scenario.next,
        reply,
        model: draft.model,
        qualifier_model: qualifierResult.model || null,
        qualifier_question: qualifierQuestion,
        error: draft.error || null,
        repair_attempted: repairAttempted,
        initial_contract_issues: initialContractIssues,
        final_contract_issues: finalContractIssues,
        pass: missing.length === 0 && forbidden.length === 0 && questionFailure.length === 0 && finalContractIssues.length === 0,
        failures: [
            ...missing.map(value => `missing:${value}`),
            ...forbidden.map(value => `forbidden:${value}`),
            ...questionFailure,
            ...finalContractIssues.map(value => `contract:${value}`),
        ],
    };
}

(async () => {
    const results = [];
    const selectedRuns = String(process.env.SMOKE_RUNS || '').split(',')
        .map(value => Number(value.trim()))
        .filter(value => Number.isInteger(value) && value >= 1 && value <= scenarios.length);
    const indexes = selectedRuns.length ? selectedRuns.map(value => value - 1) : scenarios.map((_, index) => index);
    for (const index of indexes) {
        results.push(await runScenario(scenarios[index], index));
    }
    process.stdout.write(`PAID_META_SMOKE_RESULTS=${JSON.stringify({
        passed: results.filter(result => result.pass).length,
        failed: results.filter(result => !result.pass).length,
        results,
    })}\n`);
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
