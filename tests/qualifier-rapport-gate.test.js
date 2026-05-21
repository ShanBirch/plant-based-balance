const assert = require('assert');

const {
    freshQualifier,
    applyRapportGate,
    hasChallengeInviteReadinessSignal,
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

assert.strictEqual(
    hasChallengeInviteReadinessSignal("i need help, i dunno what i'm doing"),
    true
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

console.log('qualifier rapport gate tests passed');
