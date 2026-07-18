const assert = require('node:assert/strict');
const test = require('node:test');

const {
    classifyHealthProgressionAnswer,
    classifyHealthProgressionAttempt,
    isAutomatedManagerDelivery,
    progressionMilestones,
} = require('../netlify/functions/_lib/lead-health-progression');

test('counts an AI-authored exercise question as a health progression attempt', () => {
    const result = classifyHealthProgressionAttempt('are you into fitness much too?', { aiAuthored: true });
    assert.equal(result.is_attempt, true);
    assert.equal(result.move_type, 'question');
    assert.deepEqual(result.topics, ['exercise']);
});

test('does not count ordinary food banter as a health progression attempt', () => {
    const result = classifyHealthProgressionAttempt("what's your favourite Denmark comfort food?", { aiAuthored: true });
    assert.equal(result.is_attempt, false);
});

test('counts a statement-led consistency reflection', () => {
    const result = classifyHealthProgressionAttempt('sounds like work keeps knocking your training routine off track', { aiAuthored: true });
    assert.equal(result.is_attempt, true);
    assert.equal(result.move_type, 'statement');
    assert.ok(result.topics.includes('exercise'));
    assert.ok(result.topics.includes('consistency'));
});

test('does not credit a Shannon-edited message to the AI', () => {
    const result = classifyHealthProgressionAttempt('are you training much at the moment?', { aiAuthored: false });
    assert.equal(result.is_attempt, false);
});

test('recognises a detailed or short direct answer to the recorded health move', () => {
    const detailed = classifyHealthProgressionAnswer('I lift three days a week but struggle to stay consistent', { topics: ['exercise'] });
    assert.equal(detailed.is_answer, true);
    assert.equal(detailed.answer_type, 'health_detail');

    const short = classifyHealthProgressionAnswer('yeah a little', { topics: ['exercise'] });
    assert.equal(short.is_answer, true);
    assert.equal(short.answer_type, 'direct_short_answer');
});

test('records first goal, blocker and commercial-stage transitions', () => {
    const events = progressionMilestones(
        { facts: { motivation: null, history_blockers: null }, commercial_stage: 'engaged' },
        {
            facts: { motivation: 'feel stronger', history_blockers: 'work ruins the routine' },
            commercial_stage: 'problem_qualified',
            commercial_reason: 'Exact goal and blocker are present.',
        }
    );
    assert.deepEqual(events.map(event => event.type), [
        'lead_goal_identified',
        'lead_blocker_identified',
        'lead_problem_qualified',
    ]);
});

test('scheduled manager deliveries retain manager attribution', () => {
    assert.equal(isAutomatedManagerDelivery('scheduled_worker', { scheduled_via: 'balance_lead_client_manager_cron' }), true);
    assert.equal(isAutomatedManagerDelivery('scheduled_worker', { scheduled_via: 'send_later' }), false);
});
