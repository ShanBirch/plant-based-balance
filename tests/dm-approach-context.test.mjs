import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITERIA, reviewClaim, validateReviewBinding, buildReviewRequest } from '../scripts/instagram-dm/review-dm-decisions.mjs';

const threadId = '11111111-1111-4111-8111-111111111111';
const sourceMessageId = '22222222-2222-4222-8222-222222222222';
test('claim sends both factors to Decisions and binds the assigned approach into its context hash', async () => {
  for (const subvariant of ['direct_challenge', 'fitness_first']) {
    const input = { threadId, sourceMessageId, finalText: 'Offline example', fullThreadReviewed: true,
      conversationReview: { lane: 'organic_business', reason: 'Reviewed offline context.' },
      decisionsContext: { thread: { id: threadId }, history_proof: { mode: 'full_raw_history' },
        messages: [{ id: sourceMessageId, direction: 'in', text: 'Offline context' }],
        challenge_timing_experiment: { assignment: { variant: 'B' }, training_due: false },
        approach_timing_experiment: { enabled: true, assignment: { subvariant } } } };
    let captured;
    const result = await reviewClaim(input, { currentPolicy: 'Offline current policy.', apiKey: 'offline',
      fetchImpl: async (_, options) => {
        captured = JSON.parse(options.body).input[1].content[0].data;
        return { ok: true, json: async () => ({ answers: Object.keys(CRITERIA).map(name => ({ name, type: 'predicate', probability: 0.95 })) }) };
      } });
    assert.equal(captured.approach_timing_experiment.assignment.subvariant, subvariant);
    assert.equal(captured.challenge_timing_experiment.assignment.variant, 'B');
    assert.equal(result.decisionsReview.approachSubvariant, subvariant);
    assert.equal(result.decisionsReview.sendAuthorized, false);
    const evidence = { threadId, sourceMessageId, candidateText: input.finalText, lane: 'organic_business',
      fullThreadReviewed: true, currentPolicy: 'Offline current policy.', messages: input.decisionsContext.messages,
      historyProof: input.decisionsContext.history_proof, conversationReview: input.conversationReview,
      challengeTimingExperiment: input.decisionsContext.challenge_timing_experiment,
      approachTimingExperiment: input.decisionsContext.approach_timing_experiment };
    assert.doesNotThrow(() => validateReviewBinding(evidence, result.decisionsReview));
    const changed = { ...evidence, approachTimingExperiment: { assignment: { subvariant: 'changed' } } };
    assert.notEqual(buildReviewRequest(changed).inputHash, result.decisionsReview.inputHash);
    assert.throws(() => validateReviewBinding(changed, result.decisionsReview));
  }
});
