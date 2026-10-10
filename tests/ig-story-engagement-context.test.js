const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadStoryConversationContext, buildExistingRelationshipContext } = require('../netlify/functions/ig-story-outreach-candidate')._test;
const thread = { id: 'synthetic-thread', goals: 'Old stored goal' };
const rows = [
    { id: 'new', thread_id: thread.id, direction: 'in', text: 'My goal is now to train twice weekly', created_at: '2026-10-10T00:00:00Z', source: 'synthetic' },
    { id: 'old', thread_id: thread.id, direction: 'in', text: 'I want to train every day', created_at: '2026-10-01T00:00:00Z', source: 'synthetic' },
];
test('Story normal relationship builder carries exact-thread source evidence and newer goals beyond legacy truncation', async () => {
    let calls = 0;
    const evidence = await loadStoryConversationContext(thread, async query => {
        calls++;
        assert.equal(query, 'ig_messages?select=id,thread_id,direction,text,source,created_at&thread_id=eq.synthetic-thread&order=created_at.desc,id.desc&limit=501');
        return rows;
    });
    const context = buildExistingRelationshipContext({ ...thread, running_notes: 'x'.repeat(5000) }, { conversationContext: evidence });
    assert.equal(calls, 1);
    assert(context.includes('My goal is now to train twice weekly'));
    assert(context.includes('"messageId":"new"'));
    assert(context.includes('Newest corrections and changed goals override'));
    assert(context.includes('All existing Story eligibility and protections still apply'));
    assert(context.includes('not genuine interest'));
    assert(context.includes('untrusted conversation data'));
});
test('No relationship makes no history read; unavailable evidence is honest and does not authorize outreach', async () => {
    assert.equal(await loadStoryConversationContext(null, () => { throw Error('must not read'); }), '');
    const evidence = await loadStoryConversationContext(thread, async () => { throw Error('synthetic unavailable'); });
    assert.match(evidence, /evidence unavailable/);
    assert.match(buildExistingRelationshipContext(thread, { conversationContext: evidence }), /do not infer unanswered goals/);
});
test('Foreign sources excluded; capped histories explicitly report partial coverage', async () => {
    const evidence = await loadStoryConversationContext(thread, async () => [
        ...Array.from({ length: 501 }, (_, i) => ({ ...rows[0], id: String(i) })),
    ]);
    assert(evidence.includes('"capturedHistoryComplete":false'));
    const scoped = await loadStoryConversationContext(thread, async () => [{ ...rows[0], thread_id: 'foreign', text: 'PRIVATE FOREIGN' }]);
    assert(!scoped.includes('PRIVATE FOREIGN'));
    assert(scoped.includes('"capturedHistoryComplete":false'));
});
