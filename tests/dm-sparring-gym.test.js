const assert = require('assert');

const {
    DEFAULT_PERSONAS,
    choosePersonas,
    parseJsonObject,
    normalizeScorecard,
    mergeScenarioPersona,
    detectCoachTurnIssues,
    runSparringBatch,
} = require('../netlify/functions/_lib/dm-sparring-gym');

const firstPick = choosePersonas({ count: 3, seed: 'same-seed' }).map(p => p.key);
const secondPick = choosePersonas({ count: 3, seed: 'same-seed' }).map(p => p.key);
assert.deepStrictEqual(firstPick, secondPick);
assert.strictEqual(firstPick.length, 3);

assert.deepStrictEqual(
    parseJsonObject('```json\n{"messages":["hey"]}\n```'),
    { messages: ['hey'] }
);

const score = normalizeScorecard({
    felt_human: 11,
    heard_first: -2,
    context_use: 8.27,
    risk_flags: ['x', null, ''],
});
assert.strictEqual(score.felt_human, 10);
assert.strictEqual(score.heard_first, 0);
assert.strictEqual(score.context_use, 8.3);
assert.deepStrictEqual(score.risk_flags, ['x']);

const merged = mergeScenarioPersona(DEFAULT_PERSONAS[0], {
    hidden_profile: 'more realistic hidden profile',
    lead_rules: ['answer only the newest question'],
    reality_checks: ['do not become hot from one nice reply'],
});
assert.strictEqual(merged.hiddenProfile, 'more realistic hidden profile');
assert.deepStrictEqual(merged.leadRules, ['answer only the newest question']);
assert.deepStrictEqual(merged.storyChecks, ['do not become hot from one nice reply']);

const premature = detectCoachTurnIssues({
    coachText: 'yeah i can get you into the free 30 day challenge if you want, want me to send the link?',
    leadText: 'haha yeah sounds cool',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(premature.includes('possible_premature_challenge_invite'));

const stock = detectCoachTurnIssues({
    coachText: 'what does a normal day look like for you at the moment?',
    leadText: 'food is where i struggle',
    qualifier: null,
    leadStage: 'qualifying',
});
assert.ok(stock.includes('stock_discovery_question'));

(async () => {
    const batch = await runSparringBatch({
        count: 1,
        turns: 2,
        seed: 'offline-test',
        personaKeys: [DEFAULT_PERSONAS[0].key],
        offline: true,
    });
    assert.strictEqual(batch.count, 1);
    assert.strictEqual(batch.conversations.length, 1);
    assert.ok(batch.conversations[0].transcript.length >= 2);
    assert.ok(batch.summary.averages.overall >= 0);
    console.log('dm sparring gym tests passed');
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
