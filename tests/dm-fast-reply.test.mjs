import test from 'node:test';
import assert from 'node:assert/strict';
import { fastReplyContext, fastReplyClaim } from '../scripts/balance-dm-fast-reply.mjs';

const input = { threadId: '11111111-1111-4111-8111-111111111111',
    sourceMessageId: '22222222-2222-4222-8222-222222222222', runId: 'fixture-run',
    tabId: 'fixture-tab', username: 'fixture', nativeConversationId: 'native-fixture', leadState: 'qualifying',
    finalText: "It's a test", fullThreadReviewed: true, nativeIdentityVerified: true,
    independentHoldsChecked: true };

test('one context read includes complete history, holds, actions, personal registry and ownership', () => {
    const query = fastReplyContext(input);
    for (const table of ['ig_threads', 'ig_messages', 'ig_next_actions', 'ig_personal_contacts', 'ig_browser_shift_runs']) {
        assert.ok(query.includes(table));
    }
    assert.doesNotMatch(query, /\b(update|insert|delete)\b/i);
    assert.match(query, /messages_compacted/);
    assert.match(query, /last_compacted_event_key/);
    assert.match(query, /full_history_summary_and_complete_delta/);
    assert.match(query, /full_raw_history/);
    assert.match(query, /created_at<=/);
    assert.match(query, /not coalesce\(\(select valid from proof\),false\)/);
    assert.throws(() => fastReplyContext({ ...input, threadId: 'bad' }), /UUID/);
});

test('claim batches existing source/claim/guard functions without replacing their safety rules', () => {
    const query = fastReplyClaim(input);
    for (const name of ['upsert_ig_next_action', 'claim_ig_next_actions', 'ig_browser_action_owned']) {
        assert.ok(query.includes(name));
    }
    assert.match(query, /It''s a test/);
    assert.match(query, /staged as materialized/);
    assert.match(query, /ARRAY\[\(staged.action\).thread_id\]/);
    assert.match(query, /where claimed.source_message_id=/);
    assert.match(query, /direction='in' order by created_at desc,id desc limit 1/);
    assert.doesNotMatch(query, /\b(update|insert|delete)\b/i);
    for (const gate of ['fullThreadReviewed', 'nativeIdentityVerified', 'independentHoldsChecked']) {
        assert.throws(() => fastReplyClaim({ ...input, [gate]: false }), /gates/);
    }
});
