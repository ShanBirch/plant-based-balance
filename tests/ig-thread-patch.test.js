const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeChanges, patchIgThread } = require('../netlify/functions/_lib/ig-thread-patch');

test('stale intake preserves released ownership and newly imposed independent holds', () => {
    const base = { manual_review_only: true, no_ai_send: true, instagram_graph: { participant_id: 'person' } };
    const intended = { ...base, instagram_graph: { ...base.instagram_graph, last_message_id: 'new' } };
    const live = { ...base, manual_review_only: false, no_ai_send: false,
        reply_owner: 'codex_conversation_operator', takeover_release: { source: 'human' }, codex_ai_opt_out: true,
        instagram_graph: { participant_id: 'person', verified_route: 'fresh' } };
    const result = mergeChanges(base, intended, live);
    assert.equal(result.manual_review_only, false);
    assert.equal(result.no_ai_send, false);
    assert.equal(result.reply_owner, 'codex_conversation_operator');
    assert.equal(result.codex_ai_opt_out, true);
    assert.deepEqual(result.takeover_release, { source: 'human' });
    assert.deepEqual(result.instagram_graph, { participant_id: 'person', verified_route: 'fresh', last_message_id: 'new' });
});
test('independent same-key changes win; intentional deletion affects only unchanged baseline values', () => {
    assert.deepEqual(mergeChanges({ no_ai_send: false, old: 1 }, { no_ai_send: true },
        { no_ai_send: 'manual_hold', old: 2, new: 3 }), { no_ai_send: 'manual_hold', old: 2, new: 3 });
    assert.deepEqual(mergeChanges({ old: 1 }, {}, { old: 1, new: 3 }), { new: 3 });
});
test('a handoff racing between read and PATCH forces a fresh merge and returns actual persisted state', async () => {
    const base = { id: 'thread', updated_at: 'old', lead_stage: 'new', custom_data: { no_ai_send: true } };
    let current = structuredClone(base);
    let writes = 0;
    const query = async (path, options) => {
        if (!options) return [structuredClone(current)];
        assert.equal(options.prefer, 'return=representation');
        assert.match(path, /updated_at=eq\./);
        if (++writes === 1) {
            current = { ...current, updated_at: 'handoff', lead_stage: 'hot',
                custom_data: { no_ai_send: false, reply_owner: 'codex_conversation_operator' } };
            return [];
        }
        assert.match(path, /updated_at=eq\.handoff/);
        current = { ...current, ...options.body, updated_at: 'new' };
        return [current];
    };
    const result = await patchIgThread(query, base, { custom_data: { ...base.custom_data, memory: 'new summary' }, lead_stage: 'new' });
    assert.equal(writes, 2);
    assert.equal(result.custom_data.no_ai_send, false);
    assert.equal(result.custom_data.reply_owner, 'codex_conversation_operator');
    assert.equal(result.custom_data.memory, 'new summary');
    assert.equal(result.lead_stage, 'hot');
});
test('repeated conflicts fail closed and older activity timestamps never regress current state', async () => {
    const current = { id: 't', updated_at: 'version', last_inbound_at: '2026-09-30T07:20:00Z', custom_data: { no_ai_send: true } };
    let writes = 0;
    await assert.rejects(patchIgThread(async (path, options) => {
        if (!options) return [current];
        assert.equal(options.body.last_inbound_at, undefined);
        assert.equal(options.body.custom_data.no_ai_send, true);
        writes++; return [];
    }, current, { last_inbound_at: '2026-09-30T07:00:00Z', custom_data: { ...current.custom_data, source: 'webhook' } }), /changed repeatedly/);
    assert.equal(writes, 4);
});
