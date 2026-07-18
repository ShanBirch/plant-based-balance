const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyLeadDirectQuestionCoverageGuard,
} = require('../netlify/functions/_lib/client-context');

function reviewContext(message) {
    return `LATEST just-arrived Instagram message from Veatriki (this is the message the draft must answer): "${message}"`;
}

test('reciprocal yours question cannot pass without Shannon answering it', () => {
    const review = applyLeadDirectQuestionCoverageGuard({
        verdict: 'pass',
        confidence: 0.96,
        summary: 'Draft follows the latest reply.',
        issues: [],
        suggested_fix: '',
        context_loss_suspected: false,
        notification_required: false,
        reviewer_model: 'test-reviewer',
    }, {
        draftText: 'Germany and Spain are such a good shout haha. What was the best thing you ate there?',
        contextBlocks: reviewContext("Hi 😊 probably germany and spain I'd say, yours?"),
        alertType: 'ig_incoming_dm',
    });

    assert.equal(review.verdict, 'warn');
    assert.equal(review.deterministic_guard, 'unanswered_reciprocal_question');
    assert.equal(review.notification_required, false);
});

test('reciprocal question passes when the draft includes a first-person answer', () => {
    const base = {
        verdict: 'pass',
        confidence: 0.96,
        summary: 'Draft follows the latest reply.',
        issues: [],
        suggested_fix: '',
        context_loss_suspected: false,
        notification_required: false,
    };
    const review = applyLeadDirectQuestionCoverageGuard(base, {
        draftText: 'Spain for me too haha, the food was unreal. What was the best thing you ate there?',
        contextBlocks: reviewContext("Probably Germany and Spain I'd say, yours?"),
        alertType: 'ig_incoming_dm',
    });

    assert.equal(review, base);
});

test('ordinary questions ending in you do not trigger the reciprocal guard', () => {
    const base = { verdict: 'pass', confidence: 0.9, issues: [] };
    const review = applyLeadDirectQuestionCoverageGuard(base, {
        draftText: 'Usually later in the day 😁',
        contextBlocks: reviewContext('Are you training before work too?'),
        alertType: 'ig_incoming_dm',
    });

    assert.equal(review, base);
});

test('direct-question guard does not soften an existing block', () => {
    const base = {
        verdict: 'block',
        confidence: 0.99,
        notification_required: true,
        notification_reason: 'ai_suspicion',
    };
    const review = applyLeadDirectQuestionCoverageGuard(base, {
        draftText: 'Germany and Spain are a great shout.',
        contextBlocks: reviewContext("Probably Germany and Spain, yours?"),
        alertType: 'ig_incoming_dm',
    });

    assert.equal(review, base);
});
