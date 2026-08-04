const assert = require('assert');

const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
const sendIgReply = require('../netlify/functions/send-ig-reply')._test;
const instagramWebhook = require('../netlify/functions/instagram-webhook')._test;
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: null,
    threadAutoSendEnabled: true,
    metaAdFastLane: true,
}), true, 'an explicitly enabled current Meta ad lead belongs to the AI coach fast lane');
assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: null,
    threadAutoSendEnabled: true,
    metaAdFastLane: false,
}), false, 'a normal unlinked Balance lead stays in the manager review lane');
assert.equal(instantDraft.isExerciseConversationFastLaneEligible({
    linkedUserId: null,
    currentMessage: 'I have been struggling to get back to the gym this week',
}), true, 'a clear exercise conversation is eligible for the fast lane');
assert.equal(instantDraft.isExerciseConversationFastLaneEligible({
    linkedUserId: null,
    currentMessage: 'What are you up to today?',
}), false, 'ordinary small talk is not treated as an exercise conversation');
assert.equal(instantDraft.isExerciseConversationFastLaneEligible({
    linkedUserId: null,
    currentMessage: 'Yeah definitely',
    recentMessages: [{
        direction: 'out',
        text: 'Has getting back to the gym been the hardest part?',
        created_at: '2026-07-27T01:45:00.000Z',
    }],
    nowMs: Date.parse('2026-07-27T02:00:00.000Z'),
}), true, 'short replies keep the fast lane during an active exercise conversation');
assert.equal(instantDraft.isExerciseConversationFastLaneEligible({
    linkedUserId: null,
    currentMessage: 'Please stop messaging me',
    recentMessages: [{
        direction: 'out',
        text: 'How has training been?',
        created_at: '2026-07-27T01:59:00.000Z',
    }],
    nowMs: Date.parse('2026-07-27T02:00:00.000Z'),
}), false, 'an opt-out never inherits the exercise fast lane');
assert.equal(instantDraft.isExerciseConversationFastLaneEligible({
    linkedUserId: 'client-user-1',
    currentMessage: 'My workout felt strong today',
}), false, 'linked client exercise messages remain approval-only');
assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: null,
    threadAutoSendEnabled: true,
    metaAdFastLane: false,
    exerciseConversationFastLane: true,
}), true, 'an explicitly enabled exercise lead belongs to the AI coach fast lane');
assert.equal(instantDraft.isBalanceLeadAutoSendEnabled({
    linkedUserId: 'client-user-1',
    threadAutoSendEnabled: true,
    metaAdFastLane: true,
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

assert.equal(instantDraft.getAutoDmHoldReason({
    draft: { joined: 'Yeah the evening crowd would do it. Once you are in, you actually love it.' },
    draftReview: {
        verdict: 'warn',
        summary: 'Safe reply, but the style could be tighter.',
        notification_required: false,
        context_loss_suspected: false,
    },
    allowBalanceLeadDraftReviewWarning: false,
})?.code, 'draft_review', 'a Balance fast-lane reply must receive a clean reviewer pass');

assert.equal(instantDraft.getAutoDmHoldReason({
    draft: { joined: 'Yeah okay. How long have you been trying to lose it for?' },
    draftReview: {
        verdict: 'warn',
        summary: 'The original option-menu wording was removed.',
        notification_required: false,
        context_loss_suspected: false,
    },
    alertData: { meta_ad_style_warning_safe_after_sanitize: true },
}), null, 'a marked deterministic cleanup does not get re-held before scheduling');

assert.equal(instantDraft.getAutoDmHoldReason({
    draft: { joined: 'A reply with uncertain context.' },
    draftReview: {
        verdict: 'warn',
        summary: 'Tracked context may be incomplete.',
        notification_required: true,
        context_loss_suspected: true,
    },
    allowBalanceLeadDraftReviewWarning: true,
})?.code, 'draft_review', 'context and notification warnings still hold an unlinked Balance lead');

const paidMetaPriceDraft = {
    joined: 'Six weeks of coaching is $99 once for the Founders Pass. Want me to send the details?',
};
const cleanPaidMetaReview = {
    verdict: 'pass',
    issues: [],
    notification_required: false,
    context_loss_suspected: false,
};
assert.equal(instantDraft.isPaidMetaBuyerIntentOfferReplyAllowed({
    alertData: { meta_ad_fast_lane: true },
    challengeOfferWarning: { required: true },
    currentMessage: "What's the six-week coaching cost?",
    draft: paidMetaPriceDraft,
    draftReview: cleanPaidMetaReview,
}), true, 'a clean paid-Meta answer to explicit price intent can continue without manager latency');
assert.equal(instantDraft.isPaidMetaBuyerIntentOfferReplyAllowed({
    alertData: { meta_ad_fast_lane: true },
    challengeOfferWarning: { required: true },
    currentMessage: 'That sounds interesting',
    draft: paidMetaPriceDraft,
    draftReview: cleanPaidMetaReview,
}), false, 'generic interest does not bypass coaching-offer review');
assert.equal(instantDraft.isPaidMetaBuyerIntentOfferReplyAllowed({
    alertData: { meta_ad_fast_lane: true },
    challengeOfferWarning: { required: true },
    currentMessage: 'Can you send the link?',
    draft: { joined: 'Jump in here: https://example.com/signup' },
    draftReview: cleanPaidMetaReview,
}), false, 'an unapproved URL never uses the buyer-intent offer bypass');

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

const paidMetaTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: { delay_ms: 15 * 60 * 1000, reason: 'learned historic pacing' },
    fastLaneDelayMs: 0,
});
assert.equal(paidMetaTiming.action, 'send_now');
assert.equal(paidMetaTiming.delay_ms, 0, 'verified Meta ad replies have no artificial delay');
assert.equal(instantDraft.resolveIgFastLaneDelayMs({ metaAdFastLane: true }), 0);
assert.equal(instantDraft.resolveIgFastLaneDelayMs({ exerciseConversationFastLane: true }), 4 * 60 * 1000);
assert.equal(instantDraft.shouldDispatchMetaAdReplyImmediately({
    alertData: {
        meta_ad_fast_lane: true,
        draft_review: {
            verdict: 'pass',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
    normalizedTiming: paidMetaTiming,
    scheduleResolution: { deferredForWorkingHours: false },
}), true, 'a clean reviewed paid-Meta reply dispatches immediately instead of waiting for cron');
assert.equal(instantDraft.shouldDispatchMetaAdReplyImmediately({
    alertData: {
        meta_ad_fast_lane: true,
        draft_review: { verdict: 'warn' },
    },
    normalizedTiming: paidMetaTiming,
    scheduleResolution: { deferredForWorkingHours: false },
}), false, 'a review warning never enters direct paid-Meta dispatch');
const safeWeightLossFallback = instantDraft.buildSafeMetaAdStyleFallback({
    draft: {
        chunks: [
            'Yeah, I get it. What usually makes weight loss hardest for you right now?',
            'Like is it cravings, weekends, stress, or just not having a simple routine?',
        ],
        joined: 'Yeah, I get it. What usually makes weight loss hardest for you right now?\nLike is it cravings, weekends, stress, or just not having a simple routine?',
    },
    draftReview: {
        verdict: 'warn',
        notification_required: false,
        context_loss_suspected: false,
        issues: ['Generic multi-option intake question.'],
    },
    currentMessage: 'I need to lose weight',
});
assert.equal(safeWeightLossFallback.joined, 'Yeah okay. How long have you been trying to lose it for?');
const safeConsistencyFallback = instantDraft.buildSafeMetaAdStyleFallback({
    draft: {
        chunks: [
            'Yeah that one’s brutal, because you already know what to do, it just drops off.',
            'Is it the weekend itself, or what happens after a long day?',
        ],
        joined: 'Yeah that one’s brutal, because you already know what to do, it just drops off.\nIs it the weekend itself, or what happens after a long day?',
    },
    draftReview: {
        verdict: 'warn',
        notification_required: false,
        context_loss_suspected: false,
        issues: ['Asks a two-part question and a second question without a clear tie-back.'],
    },
    currentMessage: 'Mhmm I can just never stick to the program',
});
assert.equal(safeConsistencyFallback.joined, 'Yeah that makes sense. How long do you normally stick to it before it drops off?');
assert.equal(instantDraft.draftParrotsLatestInbound(
    'Yeah that one’s brutal, because you already know what to do, it just drops off. Mhmm I can just never stick to the program.',
    'Mhmm I can just never stick to the program'
), true, 'repair safety rejects a verbatim echo of the latest inbound');
assert.equal(instantDraft.draftParrotsLatestInbound(
    'Yeah that makes sense. How long do you normally stick to it before it drops off?',
    'Mhmm I can just never stick to the program'
), false);
assert.equal(instantDraft.shouldDispatchMetaAdReplyImmediately({
    alertData: {
        meta_ad_fast_lane: true,
        meta_ad_style_warning_safe_after_sanitize: true,
        draft_review: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
    normalizedTiming: paidMetaTiming,
    scheduleResolution: { deferredForWorkingHours: false },
}), true, 'a deterministically sanitized style-only warning dispatches immediately');
assert.equal(instantDraft.shouldDispatchMetaAdReplyImmediately({
    alertData: {
        meta_ad_fast_lane: true,
        draft_review: { verdict: 'pass' },
        needs_you_required: true,
    },
    normalizedTiming: paidMetaTiming,
    scheduleResolution: { deferredForWorkingHours: false },
}), false, 'a Needs You alert never enters direct paid-Meta dispatch');

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

const liveFitnessHelpTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: {
        delay_ms: 5 * 60 * 1000,
        reason: 'lead shared a live fitness blocker',
        signals: { live_fitness_help_intent: true },
    },
});
assert.equal(liveFitnessHelpTiming.action, 'schedule');
assert.equal(liveFitnessHelpTiming.delay_ms, 5 * 60 * 1000);

const directChallengeTiming = instantDraft.normalizeIgAutoTimingSuggestion({
    timingSuggestion: {
        delay_ms: 0,
        reason: 'direct challenge question',
        signals: { direct_challenge_question: true },
    },
    fastLaneDelayMs: 4 * 60 * 1000,
});
assert.equal(directChallengeTiming.action, 'send_now');
assert.equal(directChallengeTiming.delay_ms, 0, 'challenge interest queues immediately instead of using the generic four-minute test delay');

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
            campaign_id: '2385000000001',
            adset_id: '2385000000002',
            ads_context_data: {
                creative_id: '2385000000003',
                ad_title: 'A1 Brain Angle',
            },
            placement: 'instagram_reels',
        },
    },
});
assert.equal(adReferral.source, 'meta_ads');
assert.equal(adReferral.ad_id, '2385000012345');
assert.equal(adReferral.campaign_id, '2385000000001');
assert.equal(adReferral.adset_id, '2385000000002');
assert.equal(adReferral.creative_id, '2385000000003');
assert.equal(adReferral.placement, 'instagram_reels');
assert.equal(adReferral.ad_name, 'A1 Brain Angle');

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
assert.equal(adThreadData.current_inbound_routing.campaign_id, '2385000000001');
assert.equal(adThreadData.current_inbound_routing.adset_id, '2385000000002');
assert.equal(adThreadData.current_inbound_routing.creative_id, '2385000000003');

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
assert.equal(instantDraft.isMetaAdConversationFastLaneEligible({
    linkedUserId: null,
    customData: adThreadData,
}), true, 'every follow-up stays fast in a Meta-attributed lead conversation');
assert.equal(instantDraft.isMetaAdConversationFastLaneEligible({
    linkedUserId: null,
    customData: adThreadData,
}), true, 'historic Meta attribution permanently owns the unlinked lead fast lane');
assert.equal(instantDraft.isMetaAdConversationFastLaneEligible({
    linkedUserId: 'client-user-1',
    customData: adThreadData,
}), false, 'linked clients never enter the Meta auto-send fast lane');

const internalPlantBasedTestData = {
    bot_account: 'shan_n_sunny',
    internal_test_auto_reply_enabled: true,
    internal_test_meta_ad_flow: 'plant_based_control',
};
assert.equal(instantDraft.isInternalMetaAdConversationTestLane({
    customData: internalPlantBasedTestData,
}), true, 'the explicitly armed Coco test thread can exercise paid-flow pacing when Meta preview strips attribution');
assert.equal(instantDraft.isMetaAdConversationFastLaneEligible({
    customData: internalPlantBasedTestData,
}), true);
assert.equal(instantDraft.isInternalMetaAdConversationTestLane({
    linkedUserId: 'client-user-1',
    customData: internalPlantBasedTestData,
}), false, 'the internal test override never applies to a linked client');
assert.equal(instantDraft.isContextualMetaAdOfferLinkRequest({
    currentMessage: 'Can I see it?',
    qualifier: { commercial_stage: 'buyer_intent' },
    history: [
        { direction: 'out', text: 'Founders Pass is a guided six-week kickstart in the Balance app.' },
        { direction: 'out', text: 'It includes one-to-one in-app support from me.' },
    ],
}), true, 'a contextual request to see the just-explained offer is a link request');
assert.equal(instantDraft.isContextualMetaAdOfferLinkRequest({
    currentMessage: 'Can I see it?',
    qualifier: { commercial_stage: 'engaged' },
    history: [{ direction: 'out', text: 'That sunset looks unreal.' }],
}), false, 'the same phrase outside an offer context cannot trigger a checkout link');
const contextualLinkReply = instantDraft.buildContextualMetaAdOfferLinkReply({
    checkoutUrl: 'https://plantbased-balance.org/plant-based-fitness.html?utm_source=instagram',
    flowVariant: 'plant_based_control',
});
assert.match(contextualLinkReply.joined, /have a look here/i);
assert.match(contextualLinkReply.joined, /plant-based-fitness\.html\?utm_source=instagram/);
assert.match(contextualLinkReply.joined, /does that feel like the kind of support you need\?/i);
assert.equal(contextualLinkReply.model, 'deterministic_meta_ad_contextual_link_v1');
const progressedMetaReply = instantDraft.ensureMetaAdSalesProgressionQuestion({
    draft: { chunks: ['It includes one-to-one support from me.'], joined: 'It includes one-to-one support from me.', model: 'test' },
    currentMessage: "What's included in Founders Pass?",
    qualifier: { commercial_stage: 'engaged', facts: {} },
    leadStage: 'qualifying',
});
assert.match(progressedMetaReply.joined, /what's the main thing you'd want to change first\?/i,
    'an active paid-ad reply always leaves one useful sales-progression question');
assert.equal((progressedMetaReply.joined.match(/\?/g) || []).length, 1);
const repairedBlockerReply = instantDraft.ensureMetaAdSalesProgressionQuestion({
    draft: { chunks: ['Yeah chocolate every weekend is brutal haha.'], joined: 'Yeah chocolate every weekend is brutal haha.', model: 'test+cocos-repair' },
    currentMessage: 'Chocolate! Every weekend!',
    qualifier: { commercial_stage: 'problem_qualified', facts: { history_blockers: 'Chocolate every weekend' } },
    leadStage: 'qualifying',
});
assert.match(repairedBlockerReply.joined, /would having me check in and help you stay on track make that easier\?/i,
    'the paid-ad sales guard restores a natural next question after a style repair removes it');
assert.equal((repairedBlockerReply.joined.match(/\?/g) || []).length, 1);

const paidMetaWriterPolicy = instantDraft.buildPaidMetaConversationWriterBlock({
    linkedUserId: null,
    acquisitionMode: 'paid_meta',
});
assert.match(paidMetaWriterPolicy, /You own the conversational reply/i);
assert.match(paidMetaWriterPolicy, /must not invent or force a follow-up question/i);
assert.match(paidMetaWriterPolicy, /Never repeat or lightly reword a question Shannon already asked/i);
assert.match(paidMetaWriterPolicy, /One question is the maximum, not a quota/i);
assert.equal(instantDraft.buildPaidMetaConversationWriterBlock({
    linkedUserId: 'client-user-1',
    acquisitionMode: 'paid_meta',
}), '', 'the paid-ad writer playbook never leaks into linked client conversations');
assert.equal(instantDraft.buildPaidMetaConversationWriterBlock({
    linkedUserId: null,
    acquisitionMode: 'organic_inbound',
}), '', 'organic lead conversations keep their existing writer and policy layers');
assert.equal(instantDraft.ensureMetaAdSalesProgressionQuestion({
    draft: { chunks: ['No worries.'], joined: 'No worries.', model: 'test' },
    currentMessage: 'Stop messaging me',
    qualifier: { commercial_stage: 'engaged' },
    leadStage: 'qualifying',
}).joined, 'No worries.', 'opt-outs never receive a continuation question');
const metaAdCardMarker = '[attachment:https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=123]';
assert.equal(instantDraft.isMetaAdCardAttachmentTransportArtifact({
    currentMessage: metaAdCardMarker,
    metaAdFirstInbound: true,
}), true, 'a first paid-ad card marker is ignored as a transport artifact');
assert.equal(instantDraft.isMetaAdCardAttachmentTransportArtifact({
    currentMessage: metaAdCardMarker,
    internalMetaAdConversationTestLane: true,
}), true, 'the armed Coco test lane ignores the same hidden ad-card marker');
assert.equal(instantDraft.isMetaAdCardAttachmentTransportArtifact({
    currentMessage: metaAdCardMarker,
}), false, 'an ordinary organic attachment is preserved for real media review');
assert.equal(instantDraft.isMetaAdCardAttachmentTransportArtifact({
    currentMessage: 'Do you offer personalized coaching plans?',
    internalMetaAdConversationTestLane: true,
}), false, 'normal test-lane text is never suppressed');
const unresolvedCardSuppression = instantDraft.suppressUnresolvedMetaAdCardPhoto({
    inboundMessageBatch: [
        { text: '📷 photo', media: [], created_at: '2026-08-01T10:00:00.000Z', is_current: false },
        { text: 'Do you offer personalized coaching plans?', media: [], created_at: '2026-08-01T10:02:00.000Z', is_current: true },
    ],
    currentMessage: 'Do you offer personalized coaching plans?',
    metaAdFastLane: true,
});
assert.equal(unresolvedCardSuppression.suppressedCount, 1,
    'an unresolved ad card cannot put a known paid-ad question into media review');
assert.deepEqual(unresolvedCardSuppression.batch.map(item => item.text), ['Do you offer personalized coaching plans?']);
assert.equal(instantDraft.suppressUnresolvedMetaAdCardPhoto({
    inboundMessageBatch: [
        { text: '📷 photo', media: [{ type: 'image', url: 'https://example.com/progress.jpg' }], created_at: '2026-08-01T10:00:00.000Z', is_current: false },
        { text: 'Do you offer personalized coaching plans?', media: [], created_at: '2026-08-01T10:02:00.000Z', is_current: true },
    ],
    currentMessage: 'Do you offer personalized coaching plans?',
    metaAdFastLane: true,
}).suppressedCount, 0, 'a genuine resolved client photo still requires normal media handling');
assert.equal(instantDraft.resolveMetaAdEarlyTypingDelayMs({
    lastInboundAt: '2026-08-01T10:00:00.000Z',
    seed: 'message-1',
    nowMs: Date.parse('2026-08-01T10:00:01.000Z'),
}) <= 2000, true, 'a continuing ad conversation starts typing within a couple of seconds');
const firstReplyTypingDelay = instantDraft.resolveMetaAdEarlyTypingDelayMs({
    lastInboundAt: '2026-08-01T10:00:00.000Z',
    seed: 'message-1',
    nowMs: Date.parse('2026-08-01T10:00:01.000Z'),
    firstReply: true,
});
assert.equal(firstReplyTypingDelay >= 11000 && firstReplyTypingDelay <= 29000, true,
    'the opening ad reply waits long enough to feel considered but stays comfortably under a minute');
assert.equal(instantDraft.resolveMetaAdEarlyTypingDelayMs({
    lastInboundAt: '2026-08-01T10:00:00.000Z',
    seed: 'message-1',
    nowMs: Date.parse('2026-08-01T10:00:20.000Z'),
}), 0, 'late webhook processing shows typing immediately instead of waiting longer');
const contextualLinkHandoff = instantDraft.buildLeadOnboardingHandoffData({
    draftText: contextualLinkReply.joined,
    qualifier: { commercial_stage: 'buyer_intent', stage: 'current_state' },
    leadStage: 'qualifying',
    linkedUserId: null,
    threadId: 'thread-1',
    manychatMessageId: 'message-1',
    currentMessage: 'Can I see it?',
});
assert.equal(contextualLinkHandoff.approved_link_auto_sendable, true,
    'the contextual offer request receives an approved branded-link handoff');
const resetTestHistory = [
    { direction: 'in', text: 'old opener', created_at: '2026-08-01T09:00:00.000Z' },
    { direction: 'out', text: 'old reply', created_at: '2026-08-01T09:01:00.000Z' },
    { direction: 'in', text: 'fresh opener', created_at: '2026-08-01T10:01:00.000Z' },
];
assert.deepEqual(instantDraft.filterInternalTestHistoryAfterReset({
    history: resetTestHistory,
    customData: {
        ...internalPlantBasedTestData,
        internal_test_conversation_reset_at: '2026-08-01T10:00:00.000Z',
    },
}), [resetTestHistory[2]], 'a reset test thread ignores any Meta-backfilled messages from before the reset');
assert.deepEqual(instantDraft.filterInternalTestHistoryAfterReset({
    history: resetTestHistory,
    linkedUserId: 'client-user-1',
    customData: {
        ...internalPlantBasedTestData,
        internal_test_conversation_reset_at: '2026-08-01T10:00:00.000Z',
    },
}), resetTestHistory, 'the reset cutoff cannot affect a linked client conversation');
assert.deepEqual(instantDraft.filterInternalTestHistoryAfterReset({
    history: resetTestHistory,
    customData: internalPlantBasedTestData,
}), resetTestHistory, 'an unreset test thread keeps its complete history');

assert.deepEqual(instantDraft.classifySourceMessageFreshness({
    sourceMessage: { id: 'old-inbound', direction: 'in', created_at: '2026-08-01T09:59:59.000Z' },
    latestMessage: { id: 'old-inbound', direction: 'in', created_at: '2026-08-01T09:59:59.000Z' },
    resetAt: '2026-08-01T10:00:00.000Z',
}), {
    state: 'stale',
    reason: 'source_predates_conversation_reset',
}, 'a replayed native message is stale even when it is currently the only canonical row');
assert.deepEqual(instantDraft.classifySourceMessageFreshness({
    sourceMessage: { id: 'fresh-inbound', direction: 'in', created_at: '2026-08-01T10:00:01.000Z' },
    latestMessage: { id: 'fresh-inbound', direction: 'in', created_at: '2026-08-01T10:00:01.000Z' },
    resetAt: '2026-08-01T10:00:00.000Z',
}), {
    state: 'current',
    reason: 'source_is_latest_canonical_message',
}, 'the first genuinely new message after reset remains eligible');

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
        bot_account: 'shan_n_sunny',
        ig_username: 'cocos_pt_studio',
        auto_send_review_hold: { code: 'draft_review', label: 'style could be tighter' },
        draft_review: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
})?.code, 'draft_review', 'worker holds every reviewer warning in the explicit Cocos test lane');

assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        meta_ad_fast_lane: true,
        meta_ad_style_warning_safe_after_sanitize: true,
        draft_review: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
}), null, 'worker preserves the fast-lane decision for a sanitized style-only warning');

assert.equal(scheduledWorker.buildAutoSendReviewHold({
    alert_type: 'ig_incoming_dm',
    data: {
        channel: 'instagram',
        scheduled_via: 'auto_send',
        auto_send_default_reason: 'balance_exercise_fast_lane',
        auto_send_enabled_at_draft: true,
        auto_send_review_hold: { code: 'draft_review', label: 'style could be tighter' },
        draft_review: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
    },
})?.code, 'draft_review', 'worker re-holds a warning for a Balance exercise fast-lane reply');

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
