const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    STAGES,
    freshQualifier,
    applyRapportGate,
    hasChallengeInviteReadinessSignal,
    hasEarnedChallengeInviteMoment,
    isUnsafeStockDiscoveryQuestion,
    isChallengeOfferWarningText,
    isMeaningfulLeadReply,
    countMeaningfulLeadReplies,
    isPrematureChallengeInvite,
    isInPersonOrExistingCoachPreference,
    handlesInPersonOrExistingCoachPreference,
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

const commitmentStage = STAGES.find(stage => stage.key === 'commitment');
assert.ok(commitmentStage);
assert.match(commitmentStage.strategy, /exact context|stock invite line/i);

const igDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
const qualifierSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/_lib/qualifier-engine.js'), 'utf8');
assert.match(igDraftSource, /Anchor the app rundown to their actual situation/);
assert.match(qualifierSource, /Explain the app setup before asking for another yes/);
assert.match(igDraftSource, /https:\/\/future-balance\.netlify\.app\/coaching\.html/);
assert.match(igDraftSource, /The DM offer right now is the free 30-day Balance Challenge/);
assert.match(igDraftSource, /Paid coaching is the natural follow-up after the 30 days, not the headline/);
assert.match(igDraftSource, /Shannon built Balance this year/);
assert.match(igDraftSource, /little character levels up/);
assert.match(igDraftSource, /logs earn XP/);
assert.match(igDraftSource, /Do not call the character FitGotchi in DMs/);
assert.match(qualifierSource, /app-explainer bridge/);
assert.match(igDraftSource, /Earn the next response/);
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
        draftText: 'we have a free 30 day challenge that helps cut through the noise. keen to hear more?',
        currentMessage: "Yeah, exactly. It feels like I'm constantly trying to piece things together myself, and I just want to feel like my effort is actually paying off.",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'the challenge is self-paced so you can miss days and jump back in. keen for me to send the link?',
        currentMessage: "What's the commitment level like if someone has to miss a few days or starts a bit later?",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'yeah I can get you into the free 30 day challenge if you want',
        currentMessage: "Really want to get back into it but feel like I'm starting from scratch again. Send help!",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "given you've tried heaps already, would you be keen to try my free 30 day challenge to shake things up?",
        currentMessage: "I've tried adding volume, reducing volume, different rep ranges and deloading. Nothing seems to make a difference with my squat plateau.",
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'we can get you into the free 30 day challenge to sort the stale workout plans',
        currentMessage: 'The app glitched and I need a new full-body plan for M/W/F, can you help?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "yeah 1:1 coaching is a bit more hands-on with weekly check-ins with me. here's the link: https://future-balance.netlify.app/coaching.html",
        currentMessage: 'do you do 1:1 coaching? can you send me the details?',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    false,
    '1:1 coaching link should not be treated as a premature free-challenge invite'
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "yeah the free 30 day challenge would be perfect. here's the link: https://future-balance.netlify.app/coaching.html",
        currentMessage: 'haha yeah sounds good',
        qualifier: vagueWarmth,
        leadStage: 'qualifying',
    }),
    true,
    'challenge link still needs readiness, it should not fire from vague warmth'
);

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
        draftText: 'honestly this is exactly the kind of thing the free 30 day challenge can help with: simple structure after work without guessing. want me to send the details?',
        currentMessage: 'yeah food and training are the struggle after work, i keep falling off',
        qualifier: midFunnelSpecificNeed,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
        currentMessage: 'yeah exactly, it is mainly after work that i fall off',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "honestly, that's exactly why i put together the 30-day plant-based challenge. want me to send you the details?",
        currentMessage: "I'd love to hear some of your go-to minimal effort meals, especially when my energy is super low.",
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 5,
    }),
    true
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: "two easy ones are one-pot pasta with canned tomatoes and cannellini beans, or ramen with frozen veg and tofu. after that, the free 30 day challenge might help you build a few of these into a no-thinking rotation. want me to send the details?",
        currentMessage: "I'd love to hear some of your go-to minimal effort meals, especially when my energy is super low.",
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 5,
    }),
    false
);

assert.strictEqual(
    isPrematureChallengeInvite({
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
        currentMessage: 'maybe later, not ready yet',
        qualifier: earnedInviteDeferral,
        leadStage: 'qualifying',
        leadReplyCount: 3,
    }),
    true
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
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
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
        draftText: 'honestly this is pretty much what the free 30 day challenge is for, want me to send you the details?',
        currentMessage: 'maybe later, not ready yet',
        qualifier: earnedInviteDeferral,
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

console.log('qualifier rapport gate tests passed');
