const assert = require('assert');

const {
    applyLeadStoryReplyQuestionGuard,
} = require('../netlify/functions/_lib/client-context');

const passReview = {
    verdict: 'pass',
    confidence: 0.84,
    summary: 'Draft matches the available context.',
    issues: [],
    suggested_fix: '',
    context_loss_suspected: false,
    notification_required: false,
    notification_reason: 'none',
    reviewer_model: 'test',
};

function storyContextFor(message) {
    return `Just-arrived Instagram message from ally_3o: "${message}"
Prior unanswered messages: (none)
Recent timestamped Instagram timeline:
Shannon [29 May 2026, 08:49 AEST]: replied to their story (story media attached) love these InsightTimer reminders!
ally_3o [29 May 2026, 08:57 AEST]: ${message}
Story/content context:
Recent story opener already used: love these InsightTimer reminders!`;
}

function nativePostContextFor(message) {
    return `Just-arrived Instagram message from lea: "${message}"
Recent timestamped Instagram timeline:
Shannon [12 Jul 2026, 08:49 AEST]: good session?
lea [12 Jul 2026, 08:57 AEST]: ${message}
NATIVE STORY/POST OPENER CONTEXT:
Shannon previously commented on Lea's Instagram post before this inbound.
Shannon's native story reply/comment: "good session?"`;
}

const asideOnly = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'haha so true! i try to fit them in while sunshine is causing chaos',
    contextBlocks: storyContextFor('They truly fill your cup right?!'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(asideOnly.verdict, 'pass');
assert.strictEqual(asideOnly.deterministic_guard, undefined);

const withQuestion = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'they do hey. do you use it more for meditations or the little reminders?',
    contextBlocks: storyContextFor('They truly fill your cup right?!'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(withQuestion.verdict, 'pass');

const shortButNotDeadEnd = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'haha yeah, they are good for the head',
    contextBlocks: storyContextFor('so true'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(shortButNotDeadEnd.verdict, 'pass');
assert.strictEqual(shortButNotDeadEnd.deterministic_guard, undefined);

const lowSignalThanks = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'no worries at all',
    contextBlocks: storyContextFor('thanks'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(lowSignalThanks.verdict, 'pass');

const shortPositivePostReply = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'love that session',
    contextBlocks: nativePostContextFor('Amazing session!'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(shortPositivePostReply.verdict, 'pass');
assert.strictEqual(shortPositivePostReply.deterministic_guard, undefined);

const shortPostReplyWithQuestion = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'love that. what did you train?',
    contextBlocks: nativePostContextFor('Amazing session!'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(shortPostReplyWithQuestion.verdict, 'pass');

const oldInjuryHistory = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: "ahh wow, that's a massive thing to go through",
    contextBlocks: storyContextFor('i had acl surgery years ago, it is actually why nursing clicked for me'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(oldInjuryHistory.verdict, 'pass');
assert.strictEqual(oldInjuryHistory.deterministic_guard, undefined);

const currentInjuryAdvice = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'ahh that sounds rough, hope it settles soon',
    contextBlocks: storyContextFor('my knee is killing me at the moment, any advice?'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(currentInjuryAdvice.verdict, 'pass');

const stableTrainingConstraint = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'ahh fair, good call avoiding the movements that flare it',
    contextBlocks: storyContextFor('i do all those exercises except smith machine squats and romanians, they hurt my lower back. i have constant lower back pain from lumbar degeneration'),
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(stableTrainingConstraint.verdict, 'pass');
assert.strictEqual(stableTrainingConstraint.deterministic_guard, undefined);

const oldStoryContext = applyLeadStoryReplyQuestionGuard(passReview, {
    draftText: 'that sounds full on but makes sense',
    contextBlocks: `Just-arrived Instagram message from lead: "Emergency has been intense lately"
Prior unanswered messages: (none)
Recent timestamped Instagram timeline:
Shannon [29 May 2026, 08:49 AEST]: replied to their story (story media attached) nice session
lead [29 May 2026, 08:57 AEST]: thanks!
Shannon [29 May 2026, 09:10 AEST]: what do you do for work?
lead [29 May 2026, 09:18 AEST]: Emergency has been intense lately
Story/content context:
Recent story opener already used: nice session`,
    alertType: 'ig_incoming_dm',
});

assert.strictEqual(oldStoryContext.verdict, 'pass');

console.log('lead story-reply next-handle tests passed');
