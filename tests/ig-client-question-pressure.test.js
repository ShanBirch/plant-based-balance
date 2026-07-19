const assert = require('assert');

const {
    buildConversationLanePolicyBlock,
    buildAcquisitionStyleBlock,
} = require('../netlify/functions/ig-instant-draft')._test;

const clientPolicy = buildConversationLanePolicyBlock({
    linkedUserId: 'client-123',
});
assert(clientPolicy.includes('CLIENT RELATIONSHIP MODE (HARD LANE SEPARATION)'));
assert(clientPolicy.includes('Do not apply acquisition momentum'));
assert(clientPolicy.includes('Do not append a question just to keep the conversation open'));
assert(clientPolicy.includes('not a ban on questions'));

const staleLeadStageClientPolicy = buildConversationLanePolicyBlock({
    linkedUserId: 'client-123',
    leadStage: 'new',
});
assert(staleLeadStageClientPolicy.includes('existing client even if lead_stage is stale'));

const leadPolicy = buildConversationLanePolicyBlock({
    linkedUserId: null,
    leadStage: 'qualifying',
});
assert(leadPolicy.includes('LEAD CONVERSATION MODE'));
assert(leadPolicy.includes('Be a little more question-led than with clients'));
assert(leadPolicy.includes('every question needs'));

assert.strictEqual(
    buildAcquisitionStyleBlock({ leadStage: 'new', linkedUserId: 'client-123' }),
    '',
    'linked clients must never receive the acquisition style block'
);

console.log('ig client question-pressure tests passed');
