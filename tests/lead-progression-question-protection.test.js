const assert = require('node:assert/strict');
const test = require('node:test');

const {
    applyLeadProgressionQuestionProtection,
    softenAbsoluteLearnedInstruction,
} = require('../netlify/functions/_lib/client-context');

const qualifier = {
    is_question_moment: true,
    next_question: 'what kind of stuff keeps you feeling active on the Gold Coast?',
    meaningful_lead_reply_count: 4,
};

test('question-only review warnings cannot delete an earned progression move', () => {
    const review = applyLeadProgressionQuestionProtection({
        verdict: 'warn',
        confidence: 0.86,
        summary: 'The draft adds an optional curiosity question.',
        issues: ['Optional follow-up question is not needed.'],
        suggested_fix: 'Remove the question and keep the reaction.',
        context_loss_suspected: false,
        notification_required: false,
        reviewer_model: 'test-reviewer',
    }, {
        draftText: 'Honestly pretty cruisy down here. What kind of stuff keeps you feeling active?',
        alertType: 'ig_incoming_dm',
        qualifier,
        linkedUserId: null,
        meaningfulLeadReplyCount: 4,
    });

    assert.equal(review.verdict, 'pass');
    assert.equal(review.deterministic_guard, 'lead_next_missing_fact_protected');
});

test('progression protection does not hide independent review problems', () => {
    const review = applyLeadProgressionQuestionProtection({
        verdict: 'warn',
        confidence: 0.9,
        summary: 'The question includes an unsupported medical claim.',
        issues: ['Unsupported medical question.'],
        suggested_fix: 'Remove the diagnosis.',
        context_loss_suspected: false,
        notification_required: false,
    }, {
        draftText: 'Sounds like arthritis. What training can you do?',
        alertType: 'ig_incoming_dm',
        qualifier,
        linkedUserId: null,
        meaningfulLeadReplyCount: 4,
    });

    assert.equal(review.verdict, 'warn');
    assert.equal(review.deterministic_guard, undefined);
});

test('learned editing style cannot disable lead progression', () => {
    const softened = softenAbsoluteLearnedInstruction(
        'Do not turn low-stakes Instagram banter into coaching or discovery unless they ask for help.'
    );
    assert.match(softened, /next-missing-fact/i);
    assert.match(softened, /do not wait for them to ask for help/i);
});
