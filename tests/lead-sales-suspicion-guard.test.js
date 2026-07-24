const assert = require('assert');

const {
    applyLeadSalesSuspicionGuard,
} = require('../netlify/functions/_lib/client-context');

const passReview = {
    verdict: 'pass',
    confidence: 0.95,
    summary: 'Draft matches the available context.',
    issues: [],
    suggested_fix: '',
    context_loss_suspected: false,
    notification_required: false,
    notification_reason: 'none',
    reviewer_model: 'test-reviewer',
};

const salesSensitiveQualifier = {
    commercial_stage: 'engaged',
    behavior_profile: {
        protection_pattern: 'hates_being_sold_to',
        autonomy_sensitivity: 'high',
        sales_readiness: 'protection_named',
    },
};

const pushedFitnessQuestion = applyLeadSalesSuspicionGuard(passReview, {
    draftText: 'yeah that is such a brutal combo. what usually makes it easiest to build cardio again?',
    contextBlocks: 'Just-arrived Instagram message from Angie: "I used to be a long distance runner but now stairs are a fight"',
    alertType: 'ig_incoming_dm',
    qualifier: salesSensitiveQualifier,
    linkedUserId: null,
});
assert.strictEqual(pushedFitnessQuestion.verdict, 'block');
assert.strictEqual(pushedFitnessQuestion.notification_required, true);
assert.strictEqual(pushedFitnessQuestion.notification_reason, 'sales_suspicion_progression');
assert.match(pushedFitnessQuestion.suggested_fix, /leave space|Do not ask another fitness question/i);

const statementOnlyBackoff = applyLeadSalesSuspicionGuard(passReview, {
    draftText: 'yeah that is a brutal drop after being able to run for ages',
    contextBlocks: 'Just-arrived Instagram message from Angie: "I used to be a long distance runner but now stairs are a fight"',
    alertType: 'ig_incoming_dm',
    qualifier: salesSensitiveQualifier,
    linkedUserId: null,
});
assert.strictEqual(statementOnlyBackoff.verdict, 'pass');

const directHelpReopensConversation = applyLeadSalesSuspicionGuard(passReview, {
    draftText: 'yeah absolutely. what part do you want help figuring out first?',
    contextBlocks: 'Just-arrived Instagram message from Angie: "I actually need help figuring out where to start"',
    alertType: 'ig_incoming_dm',
    qualifier: salesSensitiveQualifier,
    linkedUserId: null,
});
assert.strictEqual(directHelpReopensConversation.verdict, 'pass');

console.log('lead sales suspicion guard tests passed');
