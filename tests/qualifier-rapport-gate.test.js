const assert = require('assert');

const {
    freshQualifier,
    applyRapportGate,
    hasChallengeInviteReadinessSignal,
    hasEarnedChallengeInviteMoment,
    isUnsafeStockDiscoveryQuestion,
    isChallengeOfferWarningText,
    isMeaningfulLeadReply,
    countMeaningfulLeadReplies,
    isPrematureChallengeInvite,
} = require('../netlify/functions/_lib/qualifier-engine');

const base = freshQualifier();

const vagueWarmth = applyRapportGate({
    qualifier: {
        ...base,
        stage: 'motivation',
        stage_label: 'Motivation',
        stage_index: 2,
        is_question_moment: true,
        next_question: 'want me to send you the challenge link?',
        facts: { ...base.facts },
    },
    currentMessage: 'keen haha yeah that sounds cool',
});

assert.strictEqual(vagueWarmth.stage, 'current_state');
assert.strictEqual(hasChallengeInviteReadinessSignal('keen haha yeah that sounds cool'), false);
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

assert.strictEqual(
    hasChallengeInviteReadinessSignal("i need help, i dunno what i'm doing"),
    true
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
        draftText: 'yeah I can get you into the free 30 day challenge if you want',
        currentMessage: 'keen haha yeah that sounds cool',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'yeah I can get you into the free 30 day challenge if you want',
        currentMessage: "i need help, i dunno what i'm doing",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'want me to send you the challenge link?',
        currentMessage: 'yeah sounds good',
        qualifier: { ...vagueWarmth, stage: 'pitched' },
        leadStage: 'qualifying',
    }),
    false
);

const earnedInvite = {
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
        qualifier: earnedInvite,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 2,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInvite,
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        qualifier: earnedInvite,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    hasEarnedChallengeInviteMoment({
        qualifier: earnedInvite,
        currentMessage: 'maybe later, not ready yet',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
        currentMessage: 'maybe later, not ready yet',
        qualifier: earnedInvite,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    true
);

assert.strictEqual(
    isChallengeOfferWarningText('yeah I can get you into the free 30 day challenge if you want'),
    true
);

assert.strictEqual(
    isChallengeOfferWarningText('sounds good, you training today or easing back into it?'),
    false
);

console.log('qualifier rapport gate tests passed');
