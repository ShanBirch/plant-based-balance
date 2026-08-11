const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyLeadDirectQuestionCoverageGuard,
    applyLeadMediaEvidenceGuard,
    applyLeadRecentRepetitionGuard,
    normalizeGeneratedCoachDraftText,
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

test('direct yes-no question cannot be replaced with unrelated banter', () => {
    const review = applyLeadDirectQuestionCoverageGuard({ verdict: 'pass', confidence: 0.94, issues: [] }, {
        draftText: "You're officially my favourite reaction person now.",
        contextBlocks: reviewContext('Do you have a close friends story as well on Insta?'),
        alertType: 'ig_incoming_dm',
    });

    assert.equal(review.verdict, 'warn');
    assert.equal(review.deterministic_guard, 'unanswered_direct_yes_no_question');
});

test('direct yes-no question passes when the first sentence answers it', () => {
    const base = { verdict: 'pass', confidence: 0.94, issues: [] };
    const review = applyLeadDirectQuestionCoverageGuard(base, {
        draftText: "Nah I don't have one going at the moment.",
        contextBlocks: reviewContext('Do you have a close friends story as well on Insta?'),
        alertType: 'ig_incoming_dm',
    });
    assert.equal(review, base);
});

test('explicit media reference stays held until media evidence is supplied', () => {
    const review = applyLeadMediaEvidenceGuard({ verdict: 'pass', confidence: 0.9, issues: [] }, {
        draftText: "Hahaha fair, what's the answer then?",
        contextBlocks: reviewContext('Answer is in the video :)'),
        alertType: 'ig_incoming_dm',
    });
    assert.equal(review.verdict, 'warn');
    assert.equal(review.context_loss_suspected, true);
    assert.equal(review.deterministic_guard, 'unresolved_media_reference');
});

test('decoded media context clears the explicit media hold', () => {
    const base = { verdict: 'pass', confidence: 0.9, issues: [] };
    const review = applyLeadMediaEvidenceGuard(base, {
        draftText: 'Hahaha okay, that reveal got me.',
        contextBlocks: `${reviewContext('Answer is in the video :)')}\n\nMedia analysis/context:\nThe reveal is a fake-out at the end.`,
        alertType: 'ig_incoming_dm',
    });
    assert.equal(review, base);
});

test('near-duplicate recent topic point is warned before send', () => {
    const review = applyLeadRecentRepetitionGuard({ verdict: 'pass', confidence: 0.91, issues: [] }, {
        draftText: 'Hahaha yeah, filthy straps are the worst. Your Hokas are taking one for the team.',
        contextBlocks: `${reviewContext("It's grim how filthy the straps are")}
Recent timestamped timeline:
Shannon: Hahaha filthy Hokas are elite, those foot straps destroy them.`,
        alertType: 'ig_incoming_dm',
    });
    assert.equal(review.verdict, 'warn');
    assert.equal(review.deterministic_guard, 'recent_outbound_semantic_repetition');
});

test('generated phone copy restores safe common contractions', () => {
    assert.equal(
        normalizeGeneratedCoachDraftText('whats the plan? thats class, youre flying'),
        "What's the plan? That's class, you're flying"
    );
    assert.equal(normalizeGeneratedCoachDraftText('we were there as well'), 'We were there as well');
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
