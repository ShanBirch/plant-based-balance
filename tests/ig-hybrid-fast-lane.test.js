const assert = require('assert');

const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
const sendIgReply = require('../netlify/functions/send-ig-reply')._test;

const held = instantDraft.getCocosCodexReviewHold({
    cocosAutoSendLane: true,
    voiceReplyTestLane: false,
    approvedCoachingLinkHandoff: false,
});
assert.equal(held.code, 'codex_conversation_review');

assert.equal(instantDraft.getCocosCodexReviewHold({
    cocosAutoSendLane: true,
    voiceReplyTestLane: true,
    approvedCoachingLinkHandoff: false,
}), null);

assert.equal(instantDraft.getCocosCodexReviewHold({
    cocosAutoSendLane: true,
    voiceReplyTestLane: false,
    approvedCoachingLinkHandoff: true,
}), null);

const fastTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 0, reason: 'test' },
    fastLaneDelayMs: 4 * 60 * 1000,
});
assert.equal(fastTiming.action, 'schedule');
assert.equal(fastTiming.delay_ms, 4 * 60 * 1000);

const legacyImmediateTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 0, reason: 'legacy immediate request' },
});
assert.equal(legacyImmediateTiming.action, 'schedule');
assert.equal(legacyImmediateTiming.delay_ms, 15 * 60 * 1000);

const textTypingDelay = sendIgReply.resolveFirstItemTypingDelayMs({
    kind: 'text',
    text: 'quick reply',
    random: () => 0,
});
assert(textTypingDelay >= 1800 && textTypingDelay <= 4200);

const voiceTypingDelay = sendIgReply.resolveFirstItemTypingDelayMs({
    kind: 'audio',
    text: 'a natural twenty second voice note script',
    random: () => 1,
});
assert(voiceTypingDelay >= 1800 && voiceTypingDelay <= 4200);
assert(voiceTypingDelay > textTypingDelay);

console.log('ig-hybrid-fast-lane tests passed');
