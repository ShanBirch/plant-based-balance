const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    STAGES,
    freshQualifier,
    normalizeQualifier,
    normalizeBehaviorProfile,
    inferNativeStoryHookContext,
    inferHookContext,
    formatQualifierCustomDataText,
    applyRapportGate,
    summarizeForFcmData,
    buildQualifierRelationshipBlock,
    hasChallengeInviteReadinessSignal,
    hasEarnedChallengeInviteMoment,
    isUnsafeStockDiscoveryQuestion,
    isChallengeOfferWarningText,
    isMeaningfulLeadReply,
    countMeaningfulLeadReplies,
    isPrematureChallengeInvite,
    isUnrequestedOfferInjection,
    isInPersonOrExistingCoachPreference,
    handlesInPersonOrExistingCoachPreference,
    isAppOrWorkoutPlanSupportRequest,
} = require('../netlify/functions/_lib/qualifier-engine');
const {
    isSignupLinkHandoffText,
    buildLeadOnboardingHandoffData,
} = require('../netlify/functions/ig-instant-draft')._test;

const base = freshQualifier();

const vagueWarmth = applyRapportGate({
    qualifier: {
        ...base,
        stage: 'motivation',
        stage_label: 'Motivation',
        stage_index: 2,
        is_question_moment: true,
        next_question: 'want me to send you the coaching link?',
        facts: { ...base.facts },
    },
    currentMessage: 'keen haha yeah that sounds cool',
});

const jennaEthicsDomainSwitch = applyRapportGate({
    qualifier: {
        ...base,
        is_question_moment: true,
        next_question: 'How do you usually go with food and energy day to day?',
        meaningful_lead_reply_count: 7,
        facts: {
            ...base.facts,
            personal_context: 'Animal liberation activism and seeing animals as individuals.',
        },
    },
    currentMessage: 'That animals are individuals',
    leadReplyCount: 7,
});
assert.strictEqual(jennaEthicsDomainSwitch.is_question_moment, false);
assert.strictEqual(jennaEthicsDomainSwitch.next_question, '');
assert.match(jennaEthicsDomainSwitch.why_now, /Vegan identity and animal ethics are rapport/i);

const currentFoodEnergySignal = applyRapportGate({
    qualifier: {
        ...base,
        is_question_moment: true,
        next_question: 'Is it more food structure or the week getting messy?',
        meaningful_lead_reply_count: 3,
        facts: { ...base.facts },
    },
    currentMessage: 'Food is where I keep falling off and my energy is low',
    leadReplyCount: 3,
});
assert.strictEqual(currentFoodEnergySignal.is_question_moment, true);
assert.match(currentFoodEnergySignal.why_now, /Reciprocal rapport is established/i);

assert.strictEqual(vagueWarmth.stage, 'current_state');
assert.strictEqual(hasChallengeInviteReadinessSignal('keen haha yeah that sounds cool'), false);
assert.strictEqual(hasChallengeInviteReadinessSignal('Can I be reconnected with the balance app helper?'), false);
assert.strictEqual(isAppOrWorkoutPlanSupportRequest('Can I be reconnected with the balance app helper?'), true);
assert.ok(!/challenge|link/i.test(vagueWarmth.next_question), vagueWarmth.next_question);
assert.strictEqual(vagueWarmth.is_question_moment, false);
assert.strictEqual(vagueWarmth.next_question, '');

assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('are you much of a cook or more of a takeaway person?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion("what's for lunch today?"),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('what does that look like for you?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('what kind of difference would that make?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('anything in particular making it hectic?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('how are you finding it so far?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('are you into fitness much too?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion("what's the first thing you need to sort before Hawaii feels real?"),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('what would make that feel real for you?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('why by April?'),
    false
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('food or training?'),
    true
);
assert.strictEqual(
    isUnsafeStockDiscoveryQuestion('What usually derails it for you, food, training, or consistency?'),
    true
);

const offerClarification = applyRapportGate({
    qualifier: {
        ...base,
        commercial_stage: 'buyer_intent',
        meaningful_lead_reply_count: 7,
        is_question_moment: true,
        next_question: 'What usually derails it for you, food, training, or consistency?',
        conversation_psychology: {
            ...base.conversation_psychology,
            need_right_now: 'clarity',
            allowed_move: 'clarify',
        },
        facts: {
            ...base.facts,
            current_state: 'Wants to lose weight',
        },
    },
    currentMessage: "What's the app structure?",
    leadReplyCount: 7,
});
assert.strictEqual(offerClarification.is_question_moment, false);
assert.strictEqual(offerClarification.next_question, '');
assert.match(offerClarification.why_now, /offer clarity|leave space/i);

const foodBanter = applyRapportGate({
    qualifier: {
        ...base,
        stage: 'motivation',
        stage_label: 'Motivation',
        stage_index: 2,
        is_question_moment: true,
        next_question: 'what are your goals?',
        facts: { ...base.facts },
    },
    currentMessage: 'made tofu noodles for dinner haha',
});

assert.strictEqual(foodBanter.is_question_moment, false);
assert.strictEqual(foodBanter.next_question, '');

const foodHelp = applyRapportGate({
    qualifier: {
        ...base,
        stage: 'motivation',
        stage_label: 'Motivation',
        stage_index: 2,
        is_question_moment: true,
        next_question: 'what are your goals?',
        facts: { ...base.facts },
    },
    currentMessage: 'food is where i keep falling off, i need help',
});

assert.strictEqual(foodHelp.is_question_moment, true);
assert.ok(/food|help/i.test(foodHelp.next_question), foodHelp.next_question);

const earnedFitnessBridge = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 4,
        is_question_moment: false,
        next_question: 'what kind of stuff keeps you feeling active on the Gold Coast?',
        facts: { ...base.facts },
    },
    currentMessage: 'Honestly pretty cruisy, I love being back on the Gold Coast',
    leadReplyCount: 4,
});
assert.strictEqual(earnedFitnessBridge.is_question_moment, false);
assert.match(earnedFitnessBridge.why_now, /No current lead-authored/i);

const erikaRapportBridge = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 5,
        is_question_moment: true,
        next_question: "What's your favourite Denmark comfort food or ritual?",
        facts: {
            ...base.facts,
            relationship_context: 'Long-term vegan who loves Denmark',
            relationship_checklist: {
                ...base.facts.relationship_checklist,
                location: 'United States',
                loves: 'Denmark',
            },
        },
    },
    currentMessage: '[AUDIO:voice-note]',
    leadReplyCount: 5,
});
assert.strictEqual(erikaRapportBridge.is_question_moment, false);
assert.strictEqual(erikaRapportBridge.next_question, '');
assert.doesNotMatch(erikaRapportBridge.next_question, /Denmark|comfort food|ritual/i);
assert.match(erikaRapportBridge.why_now, /no specific training hook/i);

const questionFatigue = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 6,
        is_question_moment: true,
        next_question: 'what usually gets in the way?',
        facts: {
            ...base.facts,
            relationship_context: 'Has answered several fitness questions',
        },
    },
    currentMessage: 'haha this interview is going well',
    leadReplyCount: 6,
});
assert.strictEqual(questionFatigue.is_question_moment, false);
assert.strictEqual(questionFatigue.next_question, '');
assert.match(questionFatigue.why_now, /question fatigue/i);

const salesSuspicion = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 4,
        is_question_moment: true,
        next_question: 'what is the hardest part of cardio right now?',
        facts: {
            ...base.facts,
            relationship_context: 'Talking about fitness and cardio',
        },
    },
    currentMessage: 'Are you trying to sell me a pt course or something 😅',
    leadReplyCount: 4,
});
assert.strictEqual(salesSuspicion.is_question_moment, false);
assert.strictEqual(salesSuspicion.next_question, '');
assert.match(salesSuspicion.why_now, /sales pitch|preserve autonomy/i);

const salesSensitivityPersistsThroughFitnessAnswer = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 5,
        is_question_moment: true,
        next_question: 'what usually makes it easiest to start building cardio again?',
        behavior_profile: {
            ...base.behavior_profile,
            protection_pattern: 'hates_being_sold_to',
            autonomy_sensitivity: 'high',
            sales_readiness: 'protection_named',
        },
        facts: {
            ...base.facts,
            relationship_context: 'Former long-distance runner rebuilding cardio',
        },
    },
    currentMessage: 'I used to be a long distance runner but now stairs are a fight',
    leadReplyCount: 5,
});
assert.strictEqual(salesSensitivityPersistsThroughFitnessAnswer.is_question_moment, false);
assert.strictEqual(salesSensitivityPersistsThroughFitnessAnswer.next_question, '');
assert.match(salesSensitivityPersistsThroughFitnessAnswer.why_now, /still protecting|rapport/i);

const explicitHelpClearsSalesSensitivityHold = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 6,
        is_question_moment: true,
        next_question: 'what kind of help would make restarting feel manageable?',
        behavior_profile: {
            ...base.behavior_profile,
            protection_pattern: 'hates_being_sold_to',
            autonomy_sensitivity: 'high',
            sales_readiness: 'protection_named',
        },
        facts: {
            ...base.facts,
            relationship_context: 'Former runner rebuilding cardio',
        },
    },
    currentMessage: 'I actually need help figuring out where to start',
    leadReplyCount: 6,
});
assert.strictEqual(explicitHelpClearsSalesSensitivityHold.is_question_moment, true);

const answeredQualification = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 7,
        is_question_moment: true,
        next_question: 'what move are you trying to progress right now?',
        facts: {
            ...base.facts,
            relationship_context: 'Detailed training conversation',
            current_state: 'Protects her back and stops any movement that stresses it',
        },
    },
    currentMessage: 'So far all the exercises I do are good. My back hasn\'t flared. I hope this answers your question',
    leadReplyCount: 7,
});
assert.strictEqual(answeredQualification.is_question_moment, false);
assert.strictEqual(answeredQualification.next_question, '');
assert.match(answeredQualification.why_now, /already answered|no current blocker/i);

const noCurrentBlocker = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 5,
        is_question_moment: true,
        next_question: 'what usually gets in the way?',
        facts: {
            ...base.facts,
            relationship_context: 'Regular gym conversation',
        },
    },
    currentMessage: 'Everything is good right now, no current issues with training',
    leadReplyCount: 5,
});
assert.strictEqual(noCurrentBlocker.is_question_moment, false);
assert.strictEqual(noCurrentBlocker.next_question, '');
assert.match(noCurrentBlocker.why_now, /no current blocker/i);

const newerProblemOverridesOldNoBlocker = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 6,
        is_question_moment: true,
        next_question: 'what part of food keeps falling off?',
        facts: {
            ...base.facts,
            relationship_context: 'Ongoing training conversation',
            history_blockers: 'No current training blocker',
        },
    },
    currentMessage: 'food is where I keep falling off now, I need help with it',
    leadReplyCount: 6,
});
assert.strictEqual(newerProblemOverridesOldNoBlocker.is_question_moment, true);
assert.match(newerProblemOverridesOldNoBlocker.next_question, /food/i);

const petGriefBridge = applyRapportGate({
    qualifier: {
        ...base,
        meaningful_lead_reply_count: 5,
        is_question_moment: false,
        next_question: 'what kind of training keeps you active?',
        facts: { ...base.facts },
    },
    currentMessage: 'The vets wanted to put him down but my cat keeps flourishing',
    leadReplyCount: 5,
});
assert.strictEqual(petGriefBridge.is_question_moment, false);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("i need help, i dunno what i'm doing"),
    true
);

const commitmentStage = STAGES.find(stage => stage.key === 'commitment');
assert.ok(commitmentStage);
assert.match(commitmentStage.strategy, /exact context|stock invite line/i);

const igDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
const qualifierSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/qualifier-engine.js'), 'utf8');
const clientContextSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/client-context.js'), 'utf8');
const adminSource = fs.readFileSync(path.join(__dirname, '../admin-dashboard.html'), 'utf8');
const codexBriefSource = fs.readFileSync(path.join(__dirname, '../CODEX.md'), 'utf8');
assert.match(igDraftSource, /If they only ask "what's Balance\?"/);
assert.match(igDraftSource, /make any coaching mention casual/);
assert.match(qualifierSource, /one casual line discovered from their own words/);
assert.match(clientContextSource, /the app is finished, live, and published/);
assert.match(clientContextSource, /Never imply Balance is unfinished or still being built/);
assert.match(codexBriefSource, /Balance is already built, live, and published/);

const nativeStoryHook = inferNativeStoryHookContext({
    last_story_outreach: {
        sent_comment: 'how was the sesh?',
        story_description: 'A gym story showing a squat rack.',
        story_visible_text: 'leg day',
    },
});
assert.match(nativeStoryHook, /native story opener/);
assert.match(nativeStoryHook, /how was the sesh/);

const inferredHook = inferHookContext({
    history: [],
    customData: {
        ad_name: 'generic lead ad',
        last_story_outreach: {
            sent_comment: 'how was the sesh?',
            story_description: 'A gym story showing a squat rack.',
        },
    },
});
assert.match(inferredHook, /native story opener/);
assert.doesNotMatch(inferredHook, /entered via/);

const compactCustomData = formatQualifierCustomDataText({
    offer_path: 'balance_vegan_founders_pass',
    sales_context: {
        primary_offer: 'balance_vegan_founders_pass',
        dm_rule: 'long sales rule that should not be dumped wholesale into the qualifier prompt',
    },
    story_outreach_history: [
        { sent_comment: 'old one', story_description: 'older bulky story data' },
    ],
    last_story_outreach: {
        sent_comment: 'how was the sesh?',
        story_description: 'A gym story showing a squat rack.',
    },
});
assert.match(compactCustomData, /native_story_hook/);
assert.match(compactCustomData, /offer_path: balance_vegan_founders_pass/);
assert.doesNotMatch(compactCustomData, /story_outreach_history/);
assert.doesNotMatch(compactCustomData, /long sales rule/);
assert.match(igDraftSource, /https:\/\/plantbased-balance\.org\/founders/);
assert.match(igDraftSource, /one hundred and forty-nine dollars once for the full six weeks/);
assert.match(igDraftSource, /fixed six-week course, six weeks of app\/community access/);
assert.match(igDraftSource, /one weekly check-in plus workout\/food review and adjustments/);
assert.match(igDraftSource, /It does not auto-renew/);
assert.match(igDraftSource, /default close happens inside DMs/);
assert.match(igDraftSource, /Balance no longer uses a free challenge/);
assert.match(igDraftSource, /Keep the handoff tight in 2-3 bubbles/);
assert.match(qualifierSource, /not an app explainer/);
assert.match(qualifierSource, /LEAD BEHAVIOR PROFILE/);
assert.match(qualifierSource, /hates_being_sold_to/);
assert.match(qualifierSource, /sales_readiness=identity_confirmed/);
assert.match(adminSource, /Lead behavior read/);
assert.match(adminSource, /MOVE NOW/);
assert.doesNotMatch(adminSource, /ASK NOW/);
assert.match(igDraftSource, /Earn the next response/);
assert.match(igDraftSource, /SHANNON FOLLOW-UP QUESTION FINGERPRINT/);
assert.match(igDraftSource, /Ask one chill follow-up only when the answer would change a real next move/);
assert.match(igDraftSource, /reaction-only\/like/);
assert.match(igDraftSource, /A specific reaction can be the whole reply/);
assert.match(igDraftSource, /specific life hook -> daily rhythm or preference -> health\/fitness\/food\/energy context -> their goal or blocker -> Founders Pass details in DMs/);
assert.match(igDraftSource, /call is an escalation, not the normal late bridge/);
assert.match(igDraftSource, /remain genuinely uncertain after a clear DM explanation/);
assert.match(igDraftSource, /Approved call-booking link/);
assert.doesNotMatch(igDraftSource, /preferred late bridge is often a quick call/i);
assert.match(clientContextSource, /does not automatically require another question/);
assert.match(clientContextSource, /call is only for a lead who explicitly wants to talk/);
assert.match(igDraftSource, /why by April\?/);
assert.match(igDraftSource, /local\/in-person trainer/);
assert.match(qualifierSource, /LOCAL \/ IN-PERSON \/ EXISTING TRAINER GATE/);
assert.ok(!/Example shape:\s*"honestly this is pretty much what the free 30 day challenge is for/i.test(igDraftSource));
assert.ok(!/pretty much what the free 30 day challenge is for/i.test(igDraftSource));
assert.ok(!/pretty much what the free 30 day challenge is for/i.test(qualifierSource));

assert.strictEqual(isMeaningfulLeadReply('haha yeah sounds good'), false);
assert.strictEqual(isMeaningfulLeadReply('work makes food hard after long shifts'), true);
assert.strictEqual(
    countMeaningfulLeadReplies([
        { direction: 'in', text: 'haha yeah sounds good' },
        { direction: 'out', text: 'yeah fair, work weeks can get messy' },
        { direction: 'in', text: 'work makes food hard after long shifts' },
        { direction: 'in', text: 'i want more energy but keep falling off' },
    ], 'training is the other thing i struggle with'),
    3
);

const normalizedProfile = normalizeBehaviorProfile({
    primary_need: 'Accountability',
    protection_pattern: 'fear-of-failing-again',
    autonomy_sensitivity: 'HIGH',
    sales_readiness: 'bridge ready',
    identity_signal: 'does better with structure than winging it',
    best_next_move: 'lower pressure, label the structure gap, then offer details',
});
assert.deepStrictEqual(normalizedProfile, {
    primary_need: 'accountability',
    protection_pattern: 'fear_of_failing_again',
    autonomy_sensitivity: 'high',
    sales_readiness: 'bridge_ready',
    identity_signal: 'does better with structure than winging it',
    best_next_move: 'lower pressure, label the structure gap, then offer details',
});

const normalizedQualifier = normalizeQualifier({
    ...base,
    behavior_profile: {
        primary_need: 'food_simplicity',
        protection_pattern: 'hates_being_sold_to',
        autonomy_sensitivity: 'high',
        sales_readiness: 'protection_named',
        identity_signal: 'does not want another random plan',
        best_next_move: 'protect autonomy before mentioning Starter Coaching',
    },
});
assert.strictEqual(normalizedQualifier.behavior_profile.primary_need, 'food_simplicity');
assert.strictEqual(normalizedQualifier.behavior_profile.protection_pattern, 'hates_being_sold_to');
assert.strictEqual(normalizedQualifier.behavior_profile.autonomy_sensitivity, 'high');
assert.strictEqual(normalizedQualifier.behavior_profile.sales_readiness, 'protection_named');

const qualifierBlock = buildQualifierRelationshipBlock(normalizedQualifier);
assert.match(qualifierBlock, /Lead behavior profile/);
assert.match(qualifierBlock, /Primary need: Food Simplicity/);
assert.match(qualifierBlock, /Protection pattern: Hates Being Sold To/);
assert.match(qualifierBlock, /Best next move: protect autonomy before mentioning Starter Coaching/);

const qualifierFcm = summarizeForFcmData(normalizedQualifier);
assert.strictEqual(qualifierFcm.qualifierPrimaryNeed, 'food_simplicity');
assert.strictEqual(qualifierFcm.qualifierProtectionPattern, 'hates_being_sold_to');
assert.strictEqual(qualifierFcm.qualifierAutonomySensitivity, 'high');
assert.strictEqual(qualifierFcm.qualifierSalesReadiness, 'protection_named');
assert.strictEqual(qualifierFcm.qualifierBestNextMove, 'protect autonomy before mentioning Starter Coaching');

assert.strictEqual(
    hasChallengeInviteReadinessSignal("Yeah, exactly. It feels like I'm constantly trying to piece things together myself, and I just want to feel like my effort is actually paying off."),
    true
);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("Boring, consistent stuff can still be overwhelming to figure out alone. How do you actually help people with that bit by bit part?"),
    true
);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("What's the commitment level like if someone has to miss a few days or starts a bit later?"),
    true
);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("Really want to get back into it but feel like I'm starting from scratch again. Send help!"),
    false
);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("Ugh, app glitched while logging. I need a new full-body plan for M/W/F, can you help?"),
    false
);

assert.strictEqual(
    hasChallengeInviteReadinessSignal("I'd love to hear some of your go-to minimal effort meals, especially when my energy is super low."),
    false
);

assert.strictEqual(isInPersonOrExistingCoachPreference('Still looking for a local trainer.'), true);
assert.strictEqual(isInPersonOrExistingCoachPreference('Is that in-person coaching?'), true);
assert.strictEqual(isInPersonOrExistingCoachPreference('My PT already writes my plan, how would this fit around that?'), true);
assert.strictEqual(
    handlesInPersonOrExistingCoachPreference("mine is online 1:1 coaching, so if you're only wanting in-person i totally get that. would online check-ins still be useful?"),
    true
);
assert.strictEqual(
    hasChallengeInviteReadinessSignal('Still looking for a local trainer.'),
    false
);
assert.strictEqual(
    hasChallengeInviteReadinessSignal('My PT already writes my plan, how would this fit around that?'),
    false
);

assert.strictEqual(isMeaningfulLeadReply('haha yeah sounds good'), false);
assert.strictEqual(isMeaningfulLeadReply('work makes food hard after long shifts'), true);
assert.strictEqual(
    countMeaningfulLeadReplies([
        { direction: 'in', text: 'haha yeah sounds good' },
        { direction: 'out', text: 'yeah fair, work weeks can get messy' },
        { direction: 'in', text: 'work makes food hard after long shifts' },
        { direction: 'in', text: 'i want more energy but keep falling off' },
    ], 'training is the other thing i struggle with'),
    3
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'yeah I can send you the starter coaching details if you want',
        currentMessage: 'keen haha yeah that sounds cool',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'yeah I can send you the starter coaching details if you want',
        currentMessage: "i need help, i dunno what i'm doing",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'starter coaching could help cut through the noise with one check-in a week. keen to hear more?',
        currentMessage: "Yeah, exactly. It feels like I'm constantly trying to piece things together myself, and I just want to feel like my effort is actually paying off.",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'starter coaching is flexible, so if a week gets messy we just adjust at the check-in. keen for me to send the link?',
        currentMessage: "What's the commitment level like if someone has to miss a few days or starts a bit later?",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'yeah I can send you the starter coaching details if you want',
        currentMessage: "Really want to get back into it but feel like I'm starting from scratch again. Send help!",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "given you've tried heaps already, would you be keen to try starter coaching to shake things up?",
        currentMessage: "I've tried adding volume, reducing volume, different rep ranges and deloading. Nothing seems to make a difference with my squat plateau.",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'we can get you into starter coaching to sort the stale workout plans',
        currentMessage: 'The app glitched and I need a new full-body plan for M/W/F, can you help?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "yeah 1:1 coaching is a bit more hands-on with weekly check-ins with me. here's the link: https://plantbased-balance.org/coaching.html",
        currentMessage: 'do you do 1:1 coaching? can you send me the details?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false,
    '1:1 coaching link should not be treated as a premature coaching invite'
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "yeah starter coaching would be perfect. here's the link: https://plantbased-balance.org/coaching.html",
        currentMessage: 'haha yeah sounds good',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true,
    'coaching link still needs readiness, it should not fire from vague warmth'
);

assert.strictEqual(
    isSignupLinkHandoffText("here's the link: https://plantbased-balance.org/coaching.html"),
    true
);

const approvedBioHandoff = buildLeadOnboardingHandoffData({
    draftText: "yeah sounds so good, stoked you're keen\nhere's the link: https://plantbased-balance.org/coaching.html",
    currentMessage: 'yeah sounds good',
    qualifier: { ...vagueWarmth, stage: 'won' },
    leadStage: 'qualifying',
    linkedUserId: null,
    threadId: 'thread-123',
    manychatMessageId: 'message-123',
});

assert.strictEqual(approvedBioHandoff.needs_you_required, false);
assert.strictEqual(approvedBioHandoff.lead_onboarding_handoff, false);
assert.strictEqual(approvedBioHandoff.signup_link_manual_only, false);
assert.strictEqual(approvedBioHandoff.approved_link_auto_sendable, true);

const unreadyBioHandoff = buildLeadOnboardingHandoffData({
    draftText: "yeah starter coaching would be perfect. here's the link: https://plantbased-balance.org/coaching.html",
    currentMessage: 'haha yeah sounds good',
    qualifier: vagueWarmth,
    leadStage: 'qualifying',
    linkedUserId: null,
    threadId: 'thread-456',
    manychatMessageId: 'message-456',
});

assert.strictEqual(unreadyBioHandoff.needs_you_required, false);
assert.strictEqual(unreadyBioHandoff.operator_queue, null);
assert.strictEqual(unreadyBioHandoff.client_manager_review_required, true);
assert.strictEqual(unreadyBioHandoff.signup_link_manual_only, true);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "no, that's online 1:1 coaching. it's designed to give you that push wherever you are. still want me to send the details?",
        currentMessage: 'Is that in-person coaching?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true,
    'local/in-person preference must be explored before pushing online coaching details'
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "mine is online 1:1 coaching, so if you're only wanting in-person i totally get that. would online check-ins still be useful or are you set on local?",
        currentMessage: 'Is that in-person coaching?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false,
    'answering the in-person preference without a link should be allowed'
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "if the reset link is bouncing to spam or an old email, would you be open to me manually resetting it on our end?",
        currentMessage: "It says my password is wrong and the reset link goes to spam or an old email.",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

const earnedInviteDeferral = {
    ...base,
    stage: 'commitment',
    stage_label: 'Commitment',
    stage_index: 4,
    warmth_score: 72,
    warmth_label: 'warm',
    facts: {
        ...base.facts,
        relationship_context: 'works long shifts and trains around a busy week',
        relationship_checklist: {
            ...base.facts.relationship_checklist,
            work_study: 'long shifts',
            training_background: 'trying to get back into training',
        },
        current_state: 'inconsistent with food and training after work',
        motivation: 'wants more energy and confidence',
        history_blockers: 'falls off when work gets busy',
    },
};

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInviteDeferral,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 2,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInviteDeferral,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 3,
    }),
    true
);

const midFunnelSpecificNeed = {
    ...base,
    stage: 'motivation',
    stage_label: 'Motivation',
    stage_index: 2,
    warmth_score: 70,
    warmth_label: 'warm',
    facts: {
        ...base.facts,
        relationship_context: 'works long shifts and has low energy after work',
        relationship_checklist: {
            ...base.facts.relationship_checklist,
            work_study: 'long shifts',
            daily_rhythm: 'tired after work',
        },
        current_state: 'food and training fall apart after shifts',
        motivation: 'wants energy back',
    },
};

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: midFunnelSpecificNeed,
        currentMessage: 'haha yeah true',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: midFunnelSpecificNeed,
        currentMessage: 'yeah food and training are the struggle after work, i keep falling off',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is exactly the kind of thing starter coaching can help with: simple structure after work without guessing. want me to send the details?',
        currentMessage: 'yeah food and training are the struggle after work, i keep falling off',
        qualifier: midFunnelSpecificNeed,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what starter coaching is for, want me to send you the details?',
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "honestly, that's exactly where starter coaching can help. want me to send you the details?",
        currentMessage: "I'd love to hear some of your go-to minimal effort meals, especially when my energy is super low.",
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 5,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "two easy ones are one-pot pasta with canned tomatoes and cannellini beans, or ramen with frozen veg and tofu. after that, starter coaching might help you build a few of these into a no-thinking rotation. want me to send the details?",
        currentMessage: "I'd love to hear some of your go-to minimal effort meals, especially when my energy is super low.",
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 5,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what starter coaching is for, want me to send you the details?',
        currentMessage: 'maybe later, not ready yet',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'want me to send you the coaching link?',
        currentMessage: 'yeah sounds good',
        qualifier: { ...vagueWarmth, stage: 'pitched' },
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInviteDeferral,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 2,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInviteDeferral,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what starter coaching is for, want me to send you the details?',
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInviteDeferral,
        currentMessage: 'maybe later, not ready yet',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what starter coaching is for, want me to send you the details?',
        currentMessage: 'maybe later, not ready yet',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isChallengeOfferWarningText('yeah I can send you the starter coaching details if you want'),
    true
);

assert.strictEqual(
    isChallengeOfferWarningText('sounds good, you training today or easing back into it?'),
    false
);

assert.strictEqual(
    isChallengeOfferWarningText("haha I can definitely relate to the screen time life working on the app all day. what's your go-to when you manage to break free from the screen?"),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "sunshine mostly runs laps around my desk, chews on anything she's not supposed to, or tries to jump on my lap when i'm deep in app work.",
        currentMessage: "She loves to help me work by sitting on my keyboard. What about Sunshine?",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isUnrequestedOfferInjection({
        originalDraft: "yeah that's a pretty unreal base haha. what is it like there?",
        repairedDraft: "yeah that's unreal. the founders pass is $99 once, want me to send the details?",
        currentMessage: 'yeah this is on my base :)',
        qualifier: { stage: 'current_state', commercial_stage: 'offer_ready' },
    }),
    true,
    'a repair must not introduce an offer into a casual off-topic reply'
);

assert.strictEqual(
    isUnrequestedOfferInjection({
        originalDraft: 'yeah that food setup sounds hard',
        repairedDraft: 'the founders pass includes six weeks of support, want me to send the details?',
        currentMessage: 'can you send me the founders pass details?',
        qualifier: { stage: 'commitment', commercial_stage: 'buyer_intent' },
    }),
    false,
    'direct buyer intent may move straight to the offer'
);

const currentIgDraftSource = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'ig-instant-draft.js'), 'utf8');
assert.match(currentIgDraftSource, /isDraftReviewAutoSendSafe\(repairedReview\)/);
assert.match(currentIgDraftSource, /isUnrequestedOfferInjection\(\{/);
assert.doesNotMatch(currentIgDraftSource, /doesn['’]?t include weekly 1:1 coaching/i);

console.log('qualifier rapport gate tests passed');
