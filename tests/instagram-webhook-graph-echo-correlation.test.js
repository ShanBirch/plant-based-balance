const test = require('node:test');
const assert = require('node:assert/strict');

const webhook = require('../netlify/functions/instagram-webhook');

test('a Graph echo can only clear a pending alert for the same inbound', () => {
    const sent = { idempotency_key: 'ig_incoming_dm:ig_graph:goal-inbound' };
    const sameInboundShell = { idempotency_key: 'ig_incoming_dm:ig_graph:goal-inbound' };
    const newerBlockerShell = { idempotency_key: 'ig_incoming_dm:ig_graph:blocker-inbound' };

    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending(sent, sameInboundShell), true);
    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending(sent, newerBlockerShell), false);
    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending({}, newerBlockerShell), false);
});

test('an active sender claim keeps a one-item Graph echo from completing the whole reply', () => {
    assert.equal(webhook._test.hasActiveGraphSendClaim({ send_claim_id: 'claim-123' }), true);
    assert.equal(webhook._test.hasActiveGraphSendClaim({ send_claim_id: '  ' }), false);
    assert.equal(webhook._test.hasActiveGraphSendClaim({}), false);
});

test('multi-item and media replies can only be completed by their owning sender', () => {
    assert.equal(webhook._test.requiresOwningGraphSenderCompletion({
        draft_messages: ['First bubble', 'Second bubble'],
    }), true);
    assert.equal(webhook._test.requiresOwningGraphSenderCompletion({
        draft_messages: ['Here is the course video.'],
        draft_video_attachment_url: 'https://example.com/course.mp4',
    }), true);
    assert.equal(webhook._test.requiresOwningGraphSenderCompletion({
        paid_meta_app_preview_handoff: true,
    }), true);
    assert.equal(webhook._test.requiresOwningGraphSenderCompletion({
        draft_messages: ['A normal single text reply'],
    }), false);
});

test('only unlinked verified paid Meta threads start immediate webhook typing', () => {
    const paidMetaThread = {
        linked_user_id: null,
        custom_data: {
            meta_ad_attribution: { source: 'meta_ads', platform_source: 'ADS', ad_id: 'ad-1' },
            instagram_graph: {
                send_ready: true,
                ig_graph_user_id: 'lead-1',
                ig_account_id: 'account-1',
            },
        },
    };
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread(paidMetaThread), true);
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread({
        ...paidMetaThread,
        linked_user_id: 'client-1',
    }), false);
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread({
        linked_user_id: null,
        custom_data: { instagram_graph: paidMetaThread.custom_data.instagram_graph },
    }), false);
});

test('intentional repeated inbound text keeps its distinct Graph message identity', () => {
    const source = require('node:fs').readFileSync(
        require.resolve('../netlify/functions/instagram-webhook'),
        'utf8',
    );

    assert.match(source, /const exactDuplicate = graphMessageId\s*\? await findGraphMessageByDedupeId\(dedupeId\)/);
    assert.match(source, /!graphMessageId\s*\? await findRecentDuplicateMessage/);
    assert.match(source, /duplicateReason: exactDuplicate \? 'exact_graph_message_id' : 'recent_same_text'/);
});
