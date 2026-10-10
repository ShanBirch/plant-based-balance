const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildContext, promptBlock, loadContext } = require('../netlify/functions/_lib/engagement-ai-context');
const thread = { id: 'synthetic', subscriber_id: 'recipient', channel: 'instagram', goals: 'Old stored weight-loss goal', running_notes: 'Unverified older summary' };
const m = (id, direction, text, created_at) => ({ id, thread_id: thread.id, direction, text, created_at, source: 'synthetic' });

test('a returning person carries source-linked history, goals and uncertainty', () => {
    const context = buildContext({ thread, complete: true, messages: [
        m('1', 'in', 'My goal is to train twice weekly', '2026-10-01T01:00:00Z'),
        m('2', 'out', 'Which days suit you best?', '2026-10-01T01:01:00Z'),
        m('3', 'in', 'I enjoy cycling around the park', '2026-10-03T01:00:00Z'),
        m('4', 'out', 'That sounds like a good outing', '2026-10-03T01:01:00Z'),
    ] });
    assert.equal(context.activity.uniqueInboundDays, 2);
    assert.equal(context.activity.candidateReturns, 1);
    assert.equal(context.explicitInterestOrGoalLanguage[0].messageId, '1');
    assert.equal(context.priorSessions.length, 2);
    assert.equal(context.whereStopped.messageId, '4');
    assert.equal(context.followUpReview.defaultDecision, 'wait_no_follow_up');
    assert.equal(context.reviewedExchanges.length, 0);
    assert.match(context.storedMemory.verification, /unsupported/);
});
test('newest changed goal is preserved over stale memory, not flattened into a fact', () => {
    const context = buildContext({ thread, complete: true, messages: [
        m('1', 'in', 'My goal is to lose weight', '2026-10-01T01:00:00Z'),
        m('2', 'in', 'My goal is strength now, not weight loss', '2026-10-10T01:00:00Z'),
    ] });
    assert.match(context.whereStopped.quote, /strength now/);
    assert.equal(context.explicitInterestOrGoalLanguage.at(-1).messageId, '2');
    assert.match(promptBlock(context), /Newest corrections and changed goals override/);
    assert.match(promptBlock(context), /Do not re-ask goals/);
});
test('foreign/invalid/duplicate evidence cannot supply identity, reviewed returns or completeness', () => {
    const row = m('1', 'in', 'I want help with a training schedule', '2026-10-01T01:00:00Z');
    const context = buildContext({ thread, complete: true, messages: [row, row,
        m('2', 'out', 'Let us discuss the schedule', '2026-10-01T01:01:00Z'),
        { ...row, id: 'foreign', thread_id: 'other' }, { ...row, id: 'bad', created_at: 'invalid' },
    ], reviewedExchanges: [{ reviewed: true, messageIds: ['1', 'foreign'] }, { reviewed: true, messageIds: ['1', '2'] }] });
    assert.equal(context.reviewedExchanges.length, 1);
    assert.equal(context.sourceMessages.length, 2);
    assert.equal(context.coverage.capturedHistoryComplete, false);
    assert.equal(context.identityScope.crossThreadAssociations, 'none');
});
test('message volume, acknowledgements and short fresh replies do not become commercial intent', () => {
    const context = buildContext({ thread, complete: true, messages: Array.from({ length: 60 }, (_, i) =>
        m(String(i), i % 2 ? 'out' : 'in', i % 2 ? 'Hello' : 'Thanks!', new Date(Date.UTC(2026, 8, 1 + i)).toISOString())) });
    assert.equal(context.activity.candidateReturns, 0);
    assert.match(promptBlock(context), /not genuine interest/);
    assert.match(promptBlock(context), /Short fresh replies are not automatically closers/);
});
test('follow-up excerpts preserve source and timing words without granting consent or action', () => {
    const context = buildContext({ thread, complete: true, messages: [
        m('1', 'in', 'Could you check back after my Friday shift?', '2026-10-01T01:00:00Z'),
        m('2', 'out', 'I can check after your shift', '2026-10-01T01:01:00Z'),
    ] });
    assert.equal(context.followUpReview.historicalCheckBackLanguage[0].messageId, '1');
    assert.match(context.followUpReview.historicalCheckBackLanguage[0].quote, /Friday shift/);
    assert.match(context.followUpReview.evidenceStatus, /not verified consent/);
    assert.match(context.followUpReview.authority, /Silence or volume creates no authority/);
    assert.match(promptBlock(context), /existing explicitly authorised due follow-up/i);
});
test('partial history blocks missing-answer claims and retains latest eighty sources', () => {
    const context = buildContext({ thread, messages: Array.from({ length: 100 }, (_, i) =>
        m(String(i), 'in', 'My goal is to build consistency', new Date(Date.UTC(2026, 8, 1 + i)).toISOString())) });
    assert.equal(context.sourceMessages.length, 80);
    assert.equal(context.coverage.sourceMessagesShown, 80);
    assert.equal(context.followUpReview.defaultDecision, 'review_history_coverage');
    assert.match(promptBlock(context), /do not claim the person never answered/);
});
test('Brisbane dates and stable same-timestamp IDs govern ordering', () => {
    const context = buildContext({ thread, complete: true, messages: [
        m('b', 'in', 'I want to train twice weekly', '2026-10-01T14:01:00Z'),
        m('a', 'in', 'I enjoy the morning workouts', '2026-10-01T14:01:00Z'),
        m('0', 'in', 'My goal is to build consistency', '2026-10-01T13:59:00Z'),
    ] });
    assert.equal(context.activity.uniqueInboundDays, 2);
    assert.deepEqual(context.sourceMessages.map(row => row.id), ['0', 'a', 'b']);
});
test('disabled loader performs no read and bounded reader uses exact identity and sentinel row', async () => {
    let calls = 0;
    const query = async url => { calls++; assert.match(url, /select=id,thread_id/); assert.match(url, /thread_id=eq.synthetic/); assert.match(url, /limit=501$/);
        return Array.from({ length: 501 }, (_, i) => m(String(i), 'in', 'hello', '2026-10-01T00:00:00Z')); };
    assert.equal(await loadContext({ query, thread }), ''); assert.equal(calls, 0);
    assert.match(await loadContext({ query, thread, enabled: true }), /"countsAreLowerBounds":true/);
    assert.equal(calls, 1);
    await assert.rejects(loadContext({ query: async () => null, thread, enabled: true }), /source rows/);
    await assert.rejects(loadContext({ query: async () => { throw new Error('denied'); }, thread, enabled: true }), /denied/);
});
