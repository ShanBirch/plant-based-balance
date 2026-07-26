const assert = require('assert');

const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
const sendIgReply = require('../netlify/functions/send-ig-reply')._test;
const instagramWebhook = require('../netlify/functions/instagram-webhook')._test;
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: null,
    threadAutoSendEnabled: true,
}), true, 'an explicitly enabled unlinked Balance lead belongs to the AI coach send lane');
assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: 'client-user-1',
    threadAutoSendEnabled: true,
}), false, 'linked clients remain approval-only even when an old thread toggle is true');
assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: null,
    threadAutoSendEnabled: false,
}), false, 'a disabled lead thread remains out of auto-send');
assert.equal(instantDraft.isCanceledLatestRecoveryCandidate({
    status: 'canceled',
    data: { cancel_reason: 'superseded_by_new_message' },
    autoSendEnabled: true,
    isLatestInbound: true,
}), true, 'an out-of-order worker may revive the canonical latest inbound');
assert.equal(instantDraft.isCanceledLatestRecoveryCandidate({
    status: 'canceled',
    data: { cancel_reason: 'superseded_by_new_message' },
    autoSendEnabled: true,
    isLatestInbound: false,
}), false, 'a genuinely superseded alert remains canceled');

assert.deepStrictEqual(instantDraft.getBalanceAutoContextBypass({
    balanceAutoSendLane: true,
    contextReview: {
        required: true,
        reasons: [
            'first_captured_reply_with_hidden_context',
            'reference_heavy_reply_without_tracked_context',
            'draft_review_none',
        ],
        tracked_outbound_context: false,
        context_dependent: true,
    },
    draft: { joined: 'Morning haha what’s up?' },
    draftReview: { verdict: 'pass', issues: [], context_loss_suspected: true },
    currentMessage: 'Yo',
})?.reason, 'safe_first_captured_opener', 'a reviewed harmless opener can proceed without the old manager');
assert.equal(instantDraft.getBalanceAutoContextBypass({
    balanceAutoSendLane: true,
    contextReview: { required: true, reasons: ['first_captured_reply_with_hidden_context'] },
    draft: { joined: 'Join my coaching program with this link' },
    draftReview: { verdict: 'pass', issues: [] },
    currentMessage: 'Yo',
}), null, 'a risky first-captured draft remains held');

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

assert.equal(instantDraft.getAutoDmHoldReason({
    draft: { joined: 'A safe but slightly generic test reply.' },
    draftReview: {
        verdict: 'warn',
        summary: 'Style could be tighter.',
        notification_required: false,
        context_loss_suspected: false,
    },
    allowTestLaneDraftReviewWarning: true,
}), null, 'the explicit Cocos to Shan n Sunny test lane may send a safe style warning');

assert.equal(instantDraft.getAutoDmHoldReason({
    draft: { joined: 'A risky test reply.' },
    draftReview: {
        verdict: 'warn',
        summary: 'Context may be missing.',
        notification_required: false,
        context_loss_suspected: true,
    },
    allowTestLaneDraftReviewWarning: true,
})?.code, 'draft_review', 'context-loss warnings still stop the test lane');

assert.equal(instantDraft.getCocosCodexReviewHold({
    cocosAutoSendLane: true,
    voiceReplyTestLane: false,
    approvedCoachingLinkHandoff: false,
    metaAdFastLane: true,
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

const activeExchangeTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: {
        delay_ms: 2 * 60 * 1000,
        reason: 'active rapid back-and-forth',
        signals: { active_back_and_forth: true },
    },
});
assert.equal(activeExchangeTiming.action, 'schedule');
assert.equal(activeExchangeTiming.delay_ms, 2 * 60 * 1000);

const directChallengeTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: {
        delay_ms: 60 * 1000,
        reason: 'direct challenge question',
        signals: { direct_challenge_question: true },
    },
    fastLaneDelayMs: 4 * 60 * 1000,
});
assert.equal(directChallengeTiming.action, 'schedule');
assert.equal(directChallengeTiming.delay_ms, 60 * 1000, 'challenge interest outranks the generic four-minute test delay');

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

const adReferral = instagramWebhook.normalizeMetaAdReferral({
    item: {
        referral: {
            source: 'ADS',
            ad_id: '2385000012345',
            ref: 'balance_founders_reel',
        },
    },
});
assert.equal(adReferral.source, 'meta_ads');
assert.equal(adReferral.ad_id, '2385000012345');

assert.equal(instagramWebhook.normalizeMetaAdReferral({
    item: { referral: { source: 'SHORTLINK', ref: 'profile_link' } },
}), null);

const adThreadData = instagramWebhook.mergeGraphCustomData({
    acquisition_source: 'native_story_outreach',
}, {
    participantId: 'lead-1',
    igAccountId: 'account-1',
    nowIso: '2026-07-24T03:00:00.000Z',
    messageId: 'mid-ad-1',
    participantUsername: 'vegan_runner',
    direction: 'in',
    metaAdReferral: adReferral,
});
assert.equal(adThreadData.acquisition_source, 'native_story_outreach');
assert.equal(adThreadData.latest_paid_acquisition, 'meta_ads');
assert.equal(adThreadData.current_inbound_routing.source, 'meta_ads');
assert.equal(adThreadData.current_inbound_routing.message_id, 'mid-ad-1');

assert.equal(instantDraft.isCurrentMetaAdInbound({
    customData: adThreadData,
    manychatMessageId: 'ig_graph:mid-ad-1',
}), true);
assert.equal(instantDraft.isCurrentMetaAdInbound({
    customData: adThreadData,
    manychatMessageId: 'ig_graph:different-message',
}), false);

assert.equal(instantDraft.isMetaAdFastLaneEligible({
    linkedUserId: null,
    customData: adThreadData,
    manychatMessageId: 'ig_graph:mid-ad-1',
}), true);
assert.equal(instantDraft.isMetaAdFastLaneEligible({
    linkedUserId: 'client-user-1',
    customData: adThreadData,
    manychatMessageId: 'ig_graph:mid-ad-1',
}), false);

const linkedClientAlert = {
    client_id: 'client-user-1',
    data: {
        channel: 'instagram',
        linked_user_id: 'client-user-1',
    },
};
assert.equal(sendIgReply.shouldBlockLinkedClientAutomatedIgSend({
    alert: linkedClientAlert,
    alertData: linkedClientAlert.data,
    thread: { linked_user_id: 'client-user-1' },
    source: 'balance_lead_client_manager_cron',
}), true);
assert.equal(sendIgReply.shouldBlockLinkedClientAutomatedIgSend({
    alert: linkedClientAlert,
    alertData: linkedClientAlert.data,
    thread: { linked_user_id: 'client-user-1' },
    source: 'admin_dashboard',
}), false);
assert.equal(sendIgReply.shouldBlockLinkedClientAutomatedIgSend({
    alert: { data: { channel: 'instagram' } },
    alertData: { channel: 'instagram' },
    thread: { linked_user_id: null },
    source: 'balance_lead_client_manager_cron',
}), false);
assert.equal(sendIgReply.shouldBlockLinkedClientAutomatedIgSend({
    alert: linkedClientAlert,
    alertData: {
        ...linkedClientAlert.data,
        scheduled_via: 'auto_send',
    },
    thread: { linked_user_id: 'client-user-1' },
    source: 'scheduled_worker',
}), true);

const laterOrganicData = instagramWebhook.mergeGraphCustomData(adThreadData, {
    participantId: 'lead-1',
    igAccountId: 'account-1',
    nowIso: '2026-07-24T04:00:00.000Z',
    messageId: 'mid-organic-2',
    participantUsername: 'vegan_runner',
    direction: 'in',
});
assert.equal(laterOrganicData.current_inbound_routing.source, 'instagram_graph');
assert.equal(instantDraft.isCurrentMetaAdInbound({
    customData: laterOrganicData,
    manychatMessageId: 'ig_graph:mid-organic-2',
}), false);

const referralOnlyData = instagramWebhook.mergeGraphCustomData({}, {
    participantId: 'lead-2',
    igAccountId: 'account-1',
    nowIso: '2026-07-24T05:00:00.000Z',
    messageId: null,
    direction: 'in',
    metaAdReferral: adReferral,
    attributionOnly: true,
});
assert.equal(referralOnlyData.meta_ad_attribution.awaiting_message, true);

const referralConsumedData = instagramWebhook.mergeGraphCustomData(referralOnlyData, {
    participantId: 'lead-2',
    igAccountId: 'account-1',
    nowIso: '2026-07-24T05:02:00.000Z',
    messageId: 'mid-after-referral',
    direction: 'in',
});
assert.equal(referralConsumedData.current_inbound_routing.source, 'meta_ads');
assert.equal(referralConsumedData.meta_ad_attribution.awaiting_message, false);

assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        meta_ad_fast_lane: true,
        draft_review: {
            verdict: 'pass',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
}), null);

assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        meta_ad_fast_lane: true,
        draft_review: {
            verdict: 'block',
            summary: 'unsafe draft',
        },
    },
}).code, 'draft_review');

assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        outbound_voice_message_reason: 'cocos_pt_studio_to_shan_n_sunny_test',
        auto_send_review_hold: { code: 'draft_review', label: 'style could be tighter' },
        draft_review: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
}), null, 'worker does not re-hold a safe style warning in the explicit Cocos test lane');

const balanceSafeOpenerData = {
    channel: 'instagram',
    scheduled_via: 'auto_send',
    bot_account: 'shan_n_sunny',
    auto_send_default_reason: 'balance_ai_coach_lane',
    message_preview: 'Yo',
    draft_text: 'Morning haha what’s up?',
    context_review: {
        required: true,
        reasons: [
            'first_captured_reply_with_hidden_context',
            'reference_heavy_reply_without_tracked_context',
            'draft_review_none',
        ],
    },
    draft_review: {
        verdict: 'pass',
        issues: [],
        notification_required: true,
        context_loss_suspected: true,
    },
    auto_send_context_bypass: {
        allowed: true,
        reason: 'safe_first_captured_opener',
        draft_review_reason: 'passed_safe_opener',
    },
};
assert.equal(scheduledWorker.hasBalanceSafeOpenerContextBypass(balanceSafeOpenerData), true);
assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: balanceSafeOpenerData,
}), null, 'scheduled worker honors the reviewed Balance safe-opener bypass');
assert.equal(scheduledWorker.hasBalanceSafeOpenerContextBypass({
    ...balanceSafeOpenerData,
    draft_text: 'Join my coaching program with this link',
}), false, 'scheduled worker rejects risky text even with a stored bypass');

console.log('ig-hybrid-fast-lane tests passed');
