import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CRITERIA, buildReviewRequest, interpretAnswers, reviewCandidate, validateReviewBinding,
    reviewClaim, validateClaimReview }
    from '../scripts/review-dm-decisions.mjs';

const fixture = () => ({
    threadId: '10000000-0000-4000-8000-000000000001',
    sourceMessageId: '20000000-0000-4000-8000-000000000001',
    lane: 'organic_business', fullThreadReviewed: true,
    historyProof: { mode: 'full_raw_history' },
    currentPolicy: 'Offline fixture. Four weeks FREE, optional continuation only with consent. Stable ABC.',
    messages: [{ id: '20000000-0000-4000-8000-000000000001', direction: 'in',
        text: 'How much is it, and can I train at home?', created_at: '2026-10-29T00:00:00Z' }],
    candidateText: 'The four weeks are free, and I can set it up for home. What equipment have you got?',
    conversationReview: { reason: 'Answer both questions, then establish equipment.', disposition: 'continue' },
    challengeTimingExperiment: { assignment: { variant: 'C' }, training_due: false },
    learningRevision: 'offline-fixture-v1'
});
const answers = probability => ({ answers: Object.keys(CRITERIA).map(name => ({ name, type: 'predicate', probability })) });

test('request preserves complete turn and ABC but excludes arbitrary secrets', () => {
    const input = { ...fixture(), apiKey: 'fixture-secret', contactEmail: 'private@example.invalid' };
    const { request } = buildReviewRequest(input);
    const text = JSON.stringify(request);
    assert.equal(request.model, 'gpt-6-luna');
    assert.equal(request.questions.length, 6);
    assert.equal(request.input[1].content[0].type, 'input_json');
    assert.equal(request.input[1].content[0].data.challenge_timing_experiment.assignment.variant, 'C');
    assert.match(text, /How much is it, and can I train at home/);
    assert.doesNotMatch(text, /fixture-secret|private@example/);
});

test('incomplete, truncated, wrong-lane or missing-current-source evidence is rejected', () => {
    for (const patch of [{ fullThreadReviewed: false }, { messages: [] }, { lane: 'client' },
        { historyProof: {} }, { currentPolicy: '' }, { messages: [{ id: 'wrong', direction: 'in' }] },
        { historyProof: { validated_compaction: true }, historySummary: '' }]) {
        assert.throws(() => buildReviewRequest({ ...fixture(), ...patch }));
    }
    assert.doesNotThrow(() => buildReviewRequest({ ...fixture(), historyProof: { validated_compaction: true }, historySummary: 'Complete verified history.' }));
});

test('probabilities are advisory triage, never a prediction or send permission', async () => {
    assert.equal(interpretAnswers(answers(0.95)).status, 'passed');
    assert.equal(interpretAnswers(answers(0.6)).status, 'uncertain');
    const failed = answers(0.95); failed.answers[0].probability = 0.1;
    assert.deepEqual(interpretAnswers(failed).issues, ['answers_turn']);
    assert.equal(interpretAnswers(failed).status, 'revise');
    const result = await reviewCandidate(fixture(), { apiKey: 'offline-fixture-key',
        fetchImpl: async (url, options) => {
            assert.equal(url, 'https://api.openai.com/v1/decisions');
            assert.equal(options.method, 'POST');
            assert.equal(JSON.parse(options.body).model, 'gpt-6-luna');
            return { ok: true, json: async () => answers(0.95) };
        } });
    assert.equal(result.sendAuthorized, false);
    assert.equal(result.thresholdsCalibrated, false);
    assert.equal(result.mode, 'advisory');
    assert.doesNotMatch(JSON.stringify(result), /offline-fixture-key|How much/);
    assert.equal(validateReviewBinding(fixture(), result), result);
    assert.throws(() => validateReviewBinding({ ...fixture(), candidateText: 'Different reply' }, result));
    const changedContext = fixture(); changedContext.messages[0].text = 'New information';
    assert.throws(() => validateReviewBinding(changedContext, result));
    assert.throws(() => validateReviewBinding(fixture(), { ...result, reviewedAt: '2020-01-01T00:00:00Z' }));
});

test('missing, duplicate, unknown, refused and invalid probabilities cannot pass', () => {
    for (const payload of [{}, { answers: [] },
        { answers: answers(0.95).answers.map(() => ({ name: 'answers_turn', type: 'predicate', probability: 0.95 })) },
        { answers: answers(0.95).answers.map(a => ({ ...a, type: 'refusal' })) },
        answers(1.1), answers(NaN)]) {
        assert.equal(interpretAnswers(payload).status, 'uncertain');
    }
});

test('key, transport, HTTP and JSON failures return bounded fallback without leaking details', async () => {
    const noKey = await reviewCandidate(fixture(), { apiKey: '' });
    assert.equal(noKey.reason, 'missing_api_key');
    const cases = [
        async () => { throw new Error('secret text must not escape'); },
        async () => ({ ok: false, status: 401 }),
        async () => ({ ok: false, status: 429 }),
        async () => ({ ok: true, json: async () => { throw new Error('private response'); } })
    ];
    for (const fetchImpl of cases) {
        const result = await reviewCandidate(fixture(), { apiKey: 'offline-key', fetchImpl });
        assert.equal(result.status, 'unavailable');
        assert.equal(result.sendAuthorized, false);
        assert.doesNotMatch(JSON.stringify(result), /secret text|private response|offline-key/);
    }
});

const claimFixture = () => {
    const f = fixture();
    return { threadId: f.threadId, sourceMessageId: f.sourceMessageId,
        finalText: f.candidateText, fullThreadReviewed: true,
        conversationReview: { ...f.conversationReview, lane: 'organic_business' },
        decisionsContext: { thread: { id: f.threadId }, messages: f.messages,
            history_proof: f.historyProof, challenge_timing_experiment: f.challengeTimingExperiment } };
};
const claimOptions = probability => ({ currentPolicy: fixture().currentPolicy,
    learningRevision: 'fixture-actual-policy-hash', apiKey: 'offline-key',
    fetchImpl: async () => ({ ok: true, json: async () => answers(probability) }) });

test('claim bridge persists review and binds final text without sending', async () => {
    const records = [];
    const reviewed = await reviewClaim(claimFixture(), { ...claimOptions(0.95), recordReview: async r => records.push(r) });
    assert.equal(records.length, 1);
    assert.equal(validateClaimReview(reviewed).status, 'passed');
    assert.throws(() => validateClaimReview({ ...reviewed, finalText: 'Changed after review' }));
    assert.equal((await reviewClaim({ ...claimFixture(), conversationReview: { lane: 'other' } }, claimOptions(0.95))).decisionsReview, undefined);
});

test('high-confidence flag is recorded before SQL, with an evidenced override path', async () => {
    let record;
    await assert.rejects(reviewClaim(claimFixture(), { ...claimOptions(0.01), recordReview: async r => { record = r; } }), { code: 'DM_REVIEW_REVISE' });
    assert.equal(record.status, 'revise');
    const reviewed = await reviewClaim({ ...claimFixture(), decisionsResolution: {
        mode: 'deep_review_override', reason: 'Offline example was reviewed against each criterion.',
        checkedIssues: Object.keys(CRITERIA) } }, claimOptions(0.01));
    assert.equal(validateClaimReview(reviewed).resolution.mode, 'deep_review_override');
    await assert.rejects(reviewClaim({ ...claimFixture(), decisionsResolution: {
        mode: 'deep_review_override', reason: 'Not enough', checkedIssues: [] } }, claimOptions(0.01)), { code: 'DM_REVIEW_REVISE' });
});

test('missing context, missing credentials and artifact failure preserve honest ordinary review fallback', async () => {
    const missing = await reviewClaim({ ...claimFixture(), decisionsContext: null }, claimOptions(0.95));
    assert.equal(validateClaimReview(missing).reason, 'missing_or_invalid_complete_context');
    const noKey = await reviewClaim(claimFixture(), { ...claimOptions(0.95), apiKey: '' });
    assert.equal(validateClaimReview(noKey).reason, 'missing_api_key');
    const noArtifact = await reviewClaim(claimFixture(), { ...claimOptions(0.95), recordReview: async () => { throw new Error('disk'); } });
    assert.equal(noArtifact.decisionsReview.artifactWriteFailed, true);
    assert.equal(validateClaimReview(noArtifact).status, 'passed');
});
