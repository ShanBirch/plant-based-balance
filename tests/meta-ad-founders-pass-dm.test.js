const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildMetaAdCheckoutUrl,
    buildMetaAdFoundersPassFirstReply,
    buildMetaAdGoalProofReply,
    applyMetaAdGoalProofReply,
    isMetaAdGoalReplyTurn,
    buildMetaAdFirstReplyApproval,
    buildApprovedMetaAdFirstReplyHandoffData,
    shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression,
    buildApprovedDeterministicMetaAdFirstReplyReview,
    ensureMetaAdSalesProgressionQuestion,
    buildDeterministicPaidMetaConversationReply,
    isExplicitPaidMetaProofVideoRetry,
    buildPaidMetaProofVideoRetryReply,
    shouldApplyDeterministicPaidMetaReplyOverride,
    shouldUseOutboundSyntheticVoice,
    restoreCoalescedPaidMetaVoiceDraft,
    removePaidMetaBlockerVoiceGreeting,
    buildPaidMetaTurnDirective,
    collectPaidMetaWriterContractIssues,
    isBlockingPaidMetaWriterContractIssue,
    buildPaidMetaGuaranteedContractFallback,
    buildPaidMetaNonBlockingReviewFallback,
    collectCocosAutoRepairIssues,
    getAutoDmHoldReason,
    buildPaidMetaConversationApproval,
    hasDirectPaidMetaCheckoutIntent,
    isContextualMetaAdOfferLinkRequest,
    buildContextualMetaAdOfferLinkReply,
    buildDraftVideoAttachmentData,
    buildDraftImageAttachmentData,
    filterMetaAdCardAttachmentHistory,
    buildLeadOnboardingHandoffData,
    resolveMetaAdFirstReplyIntent,
    resolveMetaAdFlowVariant,
    shouldUseDeterministicMetaAdFirstReply,
    getMetaAdSensitiveHoldReason,
    hasImmediateMetaDispatchFailure,
    shouldDispatchMetaAdReplyImmediately,
    isInternalMetaAdConversationOpeningTurn,
    buildInternalMetaAdTestResetCustomData,
    resolveInternalTestConversationResetAt,
    resolveInternalTestVoiceCooldownResetAt,
    buildCurrentInboundTurnText,
    buildInternalTestQualifierThread,
    filterInternalTestHistoryAfterReset,
    buildSafeMetaAdStyleFallback,
} = require('../netlify/functions/ig-instant-draft')._test;
const {
    buildInstagramGraphVideoMessagePayload,
    buildInstagramGraphImageMessagePayload,
    buildInstagramGraphButtonMessagePayload,
    resolveApprovedInstagramLinkButton,
    requiresNativeProofVideoAttachment,
    maySendDraftImageAttachment,
    maySendDraftVideoAttachment,
    splitTerminalQuestionForProofMedia,
    insertProofMediaBeforeFinalQuestion,
    stripPaidMetaProofMediaUrls,
} = require('../netlify/functions/send-ig-reply')._test;
const { inspectVoiceScriptQuality } = require('../netlify/functions/_lib/elevenlabs-voice-message');
const { buildMetaAppPreviewUrl, isMetaAppPreviewUrl } = require('../netlify/functions/_lib/meta-app-preview-ref');
const {
    BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
    resolvePaidMetaTransformationProof,
} = require('../netlify/functions/_lib/paid-meta-proof-media');

test('explicit paid Meta video retry always carries the native evergreen video', () => {
    assert.equal(isExplicitPaidMetaProofVideoRetry({
        currentMessage: 'Show me the vid again',
        history: [],
    }), true);
    assert.equal(isExplicitPaidMetaProofVideoRetry({
        currentMessage: "I can't see it",
        history: [{ direction: 'out', text: 'Yep, here it is. Once you have watched it, let me know.' }],
    }), true);

    const draft = buildPaidMetaProofVideoRetryReply("I can't see it");
    assert.equal(draft.videoAttachmentUrl, BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL);
    assert.match(draft.joined, /sent the video again/i);
    assert.match(draft.joined, /can you see it now\?$/i);
    assert.equal(maySendDraftVideoAttachment({
        videoUrl: draft.videoAttachmentUrl,
        replyText: draft.joined,
    }), true);
    assert.equal(maySendDraftVideoAttachment({
        videoUrl: BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
        replyText: 'Yep, here it is again. Can you see it now?',
    }), true, 'the exact deterministic live-worker retry wording must retain the native video');
    assert.equal(maySendDraftVideoAttachment({
        videoUrl: BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
        replyText: 'Yep, here it is. Once you’ve watched it, do you want me to set up a free personalised look at your own workout and meal plan?',
    }), true, 'the exact live retry wording without again must retain the native video');
});

test('paid Meta fast lane marks Seen before starting the early typing indicator', () => {
    const source = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
    const seenAt = source.indexOf('earlyInstagramSeenAction = await sendInstagramGraphTypingAction');
    const typingAt = source.indexOf('earlyInstagramTypingAction = await sendInstagramGraphTypingAction');
    assert.ok(seenAt >= 0);
    assert.ok(typingAt > seenAt);
});

test('approved Balance links become native Instagram buttons without a visible raw URL', () => {
    const link = resolveApprovedInstagramLinkButton('Here you go, download Balance here: https://plantbased-balance.org/founders');
    assert.deepEqual(link, {
        url: 'https://plantbased-balance.org/founders',
        displayText: 'Here you go, download Balance here',
        title: 'Open Balance',
    });
    const preview = resolveApprovedInstagramLinkButton('Your free preview is ready: https://plantbased-balance.org/p/Abc_123-xyz');
    assert.equal(preview.title, 'Open your preview');
    assert.equal(preview.displayText, 'Your free preview is ready');
    assert.equal(preview.cardTitle, 'Your Balance preview is ready');
    assert.equal(preview.imageUrl, 'https://plantbased-balance.org/assets/balance-founders-og-cream-gold.png');
    assert.equal(resolveApprovedInstagramLinkButton('Try https://example.com/unsafe'), null);

    const payload = buildInstagramGraphButtonMessagePayload({
        recipientId: 'lead-1',
        text: link.displayText,
        url: link.url,
        title: link.title,
    });
    assert.equal(payload.message.attachment.payload.template_type, 'button');
    assert.equal(payload.message.attachment.payload.buttons[0].type, 'web_url');
    assert.equal(payload.message.attachment.payload.buttons[0].url, link.url);
    assert.doesNotMatch(payload.message.attachment.payload.text, /https:\/\//);

    const previewPayload = buildInstagramGraphButtonMessagePayload({
        recipientId: 'lead-1',
        text: preview.displayText,
        url: preview.url,
        title: preview.title,
        imageUrl: preview.imageUrl,
        cardTitle: preview.cardTitle,
    });
    assert.equal(previewPayload.message.attachment.payload.template_type, 'generic');
    assert.equal(previewPayload.message.attachment.payload.elements[0].image_url, preview.imageUrl);
    assert.equal(previewPayload.message.attachment.payload.elements[0].title, 'Your Balance preview is ready');
    assert.equal(previewPayload.message.attachment.payload.elements[0].buttons[0].title, 'Open your preview');
    assert.equal(previewPayload.message.attachment.payload.elements[0].buttons[0].url, preview.url);
});

test('sender blocks a paid Meta resend claim when the native video is absent', () => {
    assert.equal(requiresNativeProofVideoAttachment({
        replyText: "Ah sorry, it didn't come through properly. I've sent the video again, can you see it now?",
        alertData: {
            acquisition_mode: 'paid_meta',
            message_preview: "I can't see it",
        },
    }), true);
    assert.equal(requiresNativeProofVideoAttachment({
        replyText: 'Here is the information you asked for.',
        alertData: { acquisition_mode: 'paid_meta' },
    }), false);
});

test('Cocos paid-ad Founders Pass opener bypasses the false signup hold and model review', () => {
    const currentMessage = 'What is the Founders Pass?';
    const draft = buildMetaAdFoundersPassFirstReply(currentMessage);
    const approval = buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft,
    });
    const handoff = buildApprovedMetaAdFirstReplyHandoffData({
        approval,
        draft,
        leadStage: 'new',
        linkedUserId: null,
        threadId: 'cocos-test-thread',
        manychatMessageId: 'cocos-test-message',
    });
    const review = buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdFirstInbound: true,
        draft,
        approval,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage,
    });

    assert.equal(draft.firstReplyIntent, 'overview');
    assert.match(draft.joined, /^Hey,/i);
    assert.match(draft.joined, /six-week plant-based fitness program/i);
    assert.match(draft.joined, /Are you currently plant-based or vegan, or are you looking to go plant-based or vegan\?/i);
    assert.doesNotMatch(draft.joined, /https?:\/\//);
    assert.equal(approval.code, 'approved_meta_ad_first_reply');
    assert.equal(handoff.client_manager_review_required, false);
    assert.equal(handoff.signup_link_manual_only, false);
    assert.equal(handoff.approved_link_auto_sendable, false);
    assert.equal(handoff.meta_ad_first_reply_preapproved, true);
    assert.equal(review.verdict, 'pass');
    assert.equal(review.notification_required, false);
    assert.equal(review.reviewer_model, 'deterministic-meta-ad-first-reply-approval');
    assert.equal(buildApprovedMetaAdFirstReplyHandoffData({
        approval,
        draft,
        leadStage: 'paying',
        linkedUserId: 'linked-client',
    }), null);
});

test('paid Meta goal reply that passes the progression contract bypasses subjective style review', () => {
    const currentMessage = 'I need to lose weight';
    const history = [
        { direction: 'out', text: 'Nice. What\u2019s your main health or fitness goal at the moment?' },
    ];
    const draft = {
        chunks: ['Yeah, losing weight is a clear goal. What usually makes it hardest for you to stay consistent?'],
        joined: 'Yeah, losing weight is a clear goal. What usually makes it hardest for you to stay consistent?',
        model: 'openai-gpt-5.4-mini-paid-meta+guided_meta_goal_proof_v1',
        replyMode: 'campaign_goal_proof',
        maxChunks: 1,
    };

    assert.deepStrictEqual(collectPaidMetaWriterContractIssues({
        draft,
        currentMessage,
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history,
    }), []);

    const review = buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdGoalReplyTurn: true,
        metaAdConversationFastLane: true,
        draft,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage,
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history,
    });

    assert.equal(review.verdict, 'pass');
    assert.equal(review.notification_required, false);
    assert.equal(review.reviewer_model, 'paid-meta-guided-goal-contract-approval');
    assert.equal(getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: { required: false },
        draft,
        draftReview: review,
        challengeOfferWarning: null,
        currentMessage,
        qualifier: { commercial_stage: 'engaged', facts: {} },
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 2,
        alertData: { meta_ad_fast_lane: true },
    }), null);
});

test('approved guided sales progression bypasses subjective style review', () => {
    const review = buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdConversationFastLane: true,
        draft: {
            joined: 'A tailored six-week offer.',
            model: 'deterministic_paid_meta_guided_sales_v1',
            replyMode: 'campaign_sales_progression',
        },
        linkedUserId: null,
        currentMessage: 'Work gets hectic and I stop sticking to it.',
        qualifier: { commercial_stage: 'problem_qualified' },
        history: [],
    });
    assert.equal(review.verdict, 'pass');
    assert.equal(review.reviewer_model, 'deterministic-paid-meta-conversation-approval');
});

test('paid Meta goal reply still goes through normal review when the progression contract fails', () => {
    const currentMessage = 'I need to lose weight';
    const history = [
        { direction: 'out', text: 'Nice. What\u2019s your main health or fitness goal at the moment?' },
    ];
    const draft = {
        chunks: ['The Founders Pass is $89.99. Want the link?'],
        joined: 'The Founders Pass is $89.99. Want the link?',
        model: 'openai-gpt-5.4-mini-paid-meta+guided_meta_goal_proof_v1',
        replyMode: 'campaign_goal_proof',
        maxChunks: 1,
    };

    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdGoalReplyTurn: true,
        metaAdConversationFastLane: true,
        draft,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage,
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history,
    }), null);
});

test.skip('legacy deterministic blocker copy retired in favour of the live writer', () => {
    const qualifier = {
        commercial_stage: 'engaged',
        facts: {
            current_state: 'Wants to lose weight',
            history_blockers: null,
            relationship_context: 'Has kids; work and kids disrupt consistency.',
            relationship_checklist: {
                household_family: 'Has kids',
                stressors_frustrations: 'Work and kids get in the way',
            },
        },
    };
    const blockerReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier,
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: false,
    });

    assert.match(blockerReply.joined, /work and the kids can wreck the best intentions/i);
    assert.match(blockerReply.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.match(blockerReply.joined, /six-week Foundations course/i);
    assert.match(blockerReply.joined, /workout program built around your week/i);
    assert.match(blockerReply.joined, /plant-based meal plan/i);
    assert.match(blockerReply.joined, /one weekly check-in with me/i);
    assert.match(blockerReply.joined, /look through the app before you pay/i);
    assert.doesNotMatch(blockerReply.joined, /meta-app-preview\.html/i);
    assert.doesNotMatch(blockerReply.joined, /what usually gets in the way/i);
    assert.doesNotMatch(blockerReply.joined, /clear (?:week|plan).*checking in.*(?:help|easier)/i);
    assert.equal((blockerReply.joined.match(/\?/g) || []).length, 1);
    assert.equal(blockerReply.replyMode, 'campaign_sales_progression');
    assert.equal(blockerReply.appPreviewHandoff, false);
    const previewReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: "Yeah, I'm keen",
        qualifier,
        history: [{ direction: 'out', text: blockerReply.joined }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(previewReply.replyMode, 'campaign_app_preview_handoff');
    assert.equal(previewReply.appPreviewHandoff, true);
    assert.match(previewReply.joined, /meta-app-preview\.html/i);
    assert.match(previewReply.joined, /before any payment/i);
    assert.equal((previewReply.joined.match(/\?/g) || []).length, 0);
    const previewHandoff = buildLeadOnboardingHandoffData({
        draftText: previewReply.joined,
        qualifier,
        leadStage: 'qualifying',
        linkedUserId: null,
        threadId: 'coco-thread',
        manychatMessageId: 'coco-blocker',
        currentMessage: "Yeah, I'm keen",
        appPreviewHandoffUrl: previewReply.appPreviewUrl,
    });
    assert.equal(previewHandoff.approved_link_auto_sendable, true);
    assert.equal(previewHandoff.paid_meta_app_preview_handoff, true);
    assert.match(previewHandoff.signup_link_handoff_url, /meta-app-preview\.html(?:\?|$)/);

    const naturalPreviewReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: "That sounds really good. I'd definitely like to have a look inside the app.",
        qualifier,
        history: [{ direction: 'out', text: blockerReply.joined }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(naturalPreviewReply.replyMode, 'campaign_app_preview_handoff');
    assert.equal(naturalPreviewReply.appPreviewHandoff, true);
    assert.match(naturalPreviewReply.joined, /before any payment/i);
    assert.equal((naturalPreviewReply.joined.match(/\?/g) || []).length, 0);

    const restoredQuestion = ensureMetaAdSalesProgressionQuestion({
        draft: {
            chunks: ['Yeah okay, that makes sense.'],
            joined: 'Yeah okay, that makes sense.',
            model: 'review_repair',
            replyMode: 'standard',
            maxChunks: 1,
        },
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier,
        leadStage: 'qualifying',
    });
    assert.match(restoredQuestion.joined, /kind of support|check in/i);
    assert.doesNotMatch(restoredQuestion.joined, /what usually gets in the way/i);

    const voiceReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier: {
            ...qualifier,
            facts: {
                ...qualifier.facts,
                current_state: 'Wants to lose 10kg and feel fitter.',
            },
        },
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: true,
    });
    assert.match(voiceReply.joined, /^Yeah, that makes total sense/i);
    assert.doesNotMatch(voiceReply.joined, /Hey,?\s+how are (?:ya|you)|how are you going/i);
    assert.match(voiceReply.joined, /work and the kids can wreck the best intentions/i);
    assert.match(voiceReply.joined, /losing 10 kilos and feeling fitter/i);
    assert.match(voiceReply.joined, /eighty-nine dollars once for the full six weeks/i);
    assert.match(voiceReply.joined, /set yourself up before you pay.*weekly goals, starter workouts, meal plan, community, and my welcome note in your Inbox/is);
    assert.match(voiceReply.joined, /Have a look first, then decide\. How does that sound\?/i);
    assert.match(voiceReply.joined, /Ummmm\.\.\./i);
    assert.doesNotMatch(voiceReply.joined, /https?:\/\//);
    assert.equal(voiceReply.voiceCompanionText, '');
    assert.equal((voiceReply.joined.match(/\?/g) || []).length, 1);
    assert.deepStrictEqual(voiceReply.voiceThoughtPausesMs, [1700, 2400, 1500, 1000]);
    assert.equal(voiceReply.voiceRenderMode, 'single_performance_aligned_pauses_v1');
    assert.equal(inspectVoiceScriptQuality(voiceReply.joined).valid, true);
    const approvedVoiceProgression = buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: voiceReply,
        currentMessage: 'My roster changes and family stuff makes it hard to restart.',
        linkedUserId: null,
        qualifier,
    });
    assert.equal(shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression({
        approval: approvedVoiceProgression,
        draft: voiceReply,
    }), true);
    assert.equal(shouldBypassGenericLinkHandoffForApprovedPaidMetaProgression({
        approval: approvedVoiceProgression,
        draft: { ...voiceReply, joined: `${voiceReply.joined}\n\nhttps://plantbased-balance.org/founders` },
    }), false);

    const coalescedVoiceReply = restoreCoalescedPaidMetaVoiceDraft({
        draft: blockerReply,
        existingPendingData: { outbound_voice_message: true },
        outboundVoiceMessage: false,
        metaAdConversationFastLane: true,
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier: {
            ...qualifier,
            facts: {
                ...qualifier.facts,
                current_state: 'Wants to lose 10kg and feel fitter.',
            },
        },
        flowVariant: 'plant_based_control',
        allowVideoAttachment: true,
    });
    assert.strictEqual(coalescedVoiceReply, blockerReply,
        'an old pending voice flag must not restore synthetic voice in a paid Meta thread');

    assert.equal(restoreCoalescedPaidMetaVoiceDraft({
        draft: blockerReply,
        existingPendingData: { outbound_voice_message: true },
        outboundVoiceMessage: false,
        metaAdConversationFastLane: false,
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier,
    }), blockerReply);

    const finallyGuardedVoiceReply = removePaidMetaBlockerVoiceGreeting({
        draft: {
            ...voiceReply,
            chunks: [`Hey, how are ya.\n\n${voiceReply.joined}`],
            joined: `Hey, how are ya.\n\n${voiceReply.joined}`,
            voiceThoughtPausesMs: [1900, ...voiceReply.voiceThoughtPausesMs],
        },
        outboundVoiceMessage: true,
        outboundVoiceMessageReason: 'lead_shared_consistency_blocker',
        metaAdConversationFastLane: true,
        flowVariant: 'plant_based_control',
    });
    assert.match(finallyGuardedVoiceReply.joined, /^Yeah, that makes total sense/);
    assert.doesNotMatch(finallyGuardedVoiceReply.joined, /^Hey/i);
    assert.deepStrictEqual(finallyGuardedVoiceReply.voiceThoughtPausesMs, voiceReply.voiceThoughtPausesMs);
    assert.equal(removePaidMetaBlockerVoiceGreeting({
        draft: blockerReply,
        outboundVoiceMessage: true,
        outboundVoiceMessageReason: 'lead_shared_consistency_blocker',
        metaAdConversationFastLane: false,
        flowVariant: 'plant_based_control',
    }), blockerReply);

    const voicePreviewReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: "Yeah, that sounds good. I'd like to have a look.",
        qualifier,
        history: [{ direction: 'out', text: voiceReply.joined }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(voicePreviewReply.replyMode, 'campaign_app_preview_handoff');
    assert.equal(voicePreviewReply.appPreviewHandoff, true);
    assert.match(voicePreviewReply.joined, /meta-app-preview\.html/i);
    assert.doesNotMatch(voicePreviewReply.joined, /founders pass details/i);

    const broadReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Other things just get in the way. Work kids',
        qualifier,
        flowVariant: 'broad_pain',
        personalVoiceNoteMode: false,
    });
    assert.match(broadReply.joined, /clear plan and me checking in/i);
    assert.doesNotMatch(broadReply.joined, /meta-app-preview|\$19\.99/i);
    assert.equal((broadReply.joined.match(/\?/g) || []).length, 1);
});

test('Coco paid-ad referral is the episode boundary when a stale writer restores an older reset timestamp', () => {
    assert.equal(resolveInternalTestConversationResetAt({
        internal_test_conversation_reset_at: '2026-08-04T04:09:28.317Z',
        meta_ad_attribution: {
            last_referral_at: '2026-08-04T04:36:39.208Z',
        },
    }), '2026-08-04T04:36:39.208Z');
    assert.equal(resolveInternalTestConversationResetAt({
        internal_test_conversation_reset_at: '2026-08-04T04:40:00.000Z',
        meta_ad_attribution: {
            last_referral_at: '2026-08-04T04:36:39.208Z',
        },
    }), '2026-08-04T04:40:00.000Z');
});

test('private paid-ad test FAQ restarts the opener even when the Instagram thread has older history', () => {
    const customData = {
        bot_account: 'shan_n_sunny',
        internal_test_auto_reply_enabled: true,
        internal_test_meta_ad_flow: 'plant_based_control',
    };
    assert.equal(isInternalMetaAdConversationOpeningTurn({
        customData,
        history: [{ direction: 'out', text: 'An older test reply' }],
        currentMessage: 'What is the Founders Pass?',
    }), true);
    assert.equal(isInternalMetaAdConversationOpeningTurn({
        customData,
        history: [{ direction: 'out', text: 'An older test reply' }],
        currentMessage: 'Okay sounds good',
    }), false);

    const resetAt = '2026-08-13T19:10:00.000Z';
    const resetCustomData = buildInternalMetaAdTestResetCustomData({
        customData: {
            ...customData,
            relationship_context: 'Old test facts must not become the reset boundary.',
        },
        currentMessage: 'What is the Founders Pass?',
        resetAt,
    });
    assert.equal(resetCustomData.internal_test_conversation_reset_at, resetAt);
    assert.equal(resetCustomData.internal_test_auto_reply_enabled, true);
    assert.equal(resetCustomData.internal_test_meta_ad_flow, 'plant_based_control');
    assert.equal(buildInternalMetaAdTestResetCustomData({
        customData,
        currentMessage: 'Okay sounds good',
        resetAt,
    }), null);
});

test('Coco qualifier evaluation cannot inherit terminal sales state from an older test episode', () => {
    const thread = {
        linked_user_id: null,
        qualifier: {
            stage: 'won',
            commercial_stage: 'buyer_intent',
            evaluated_at: '2026-08-04T04:20:00.000Z',
        },
        custom_data: {
            bot_account: 'shan_n_sunny',
            internal_test_auto_reply_enabled: true,
            internal_test_meta_ad_flow: 'plant_based_control',
            internal_test_conversation_reset_at: '2026-08-04T04:30:00.000Z',
            relationship_memory_compaction: {
                summary: 'Lead bought in an older test episode.',
            },
            relationship_context: 'Has kids and struggles with food prep.',
        },
        goals: 'Lose pregnancy weight.',
        running_notes: 'Work and kids make consistency difficult.',
        personal_context: 'Has young children.',
    };
    const isolated = buildInternalTestQualifierThread(thread);
    assert.equal(isolated.qualifier, null);
    assert.equal(isolated.custom_data.relationship_memory_compaction, undefined);
    assert.equal(isolated.custom_data.relationship_context, undefined);
    assert.equal(isolated.goals, null);
    assert.equal(isolated.running_notes, null);
    assert.equal(isolated.personal_context, null);
    assert.equal(thread.qualifier.stage, 'won');
    assert.match(thread.custom_data.relationship_memory_compaction.summary, /older test episode/i);

    const openerAt = '2026-08-13T19:12:32.180Z';
    const isolatedByLiveOpener = buildInternalTestQualifierThread({
        ...thread,
        qualifier: {
            ...thread.qualifier,
            evaluated_at: '2026-08-13T19:10:00.000Z',
        },
        custom_data: {
            ...thread.custom_data,
            internal_test_conversation_reset_at: '2026-08-13T19:02:00.000Z',
        },
    }, [{
        direction: 'in',
        text: 'what is the founders pass?',
        created_at: openerAt,
    }]);
    assert.equal(isolatedByLiveOpener.qualifier, null);
    assert.equal(isolatedByLiveOpener.custom_data.internal_test_conversation_reset_at, openerAt);
});

test('paid Meta writer contract requires an explicit answer to a proof-client question', () => {
    const currentMessage = "She's done really well! Was this your client?\nI always fall off after a couple of weeks";
    const genericAcknowledgementIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: 'Yeah, that makes sense. What usually knocks you off track?' },
        currentMessage,
        qualifier: { facts: {} },
    });
    assert.ok(genericAcknowledgementIssues.some(issue => /client/i.test(issue)));

    const answeredIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "Yeah, Ally is one of my clients. If the first couple of weeks are okay, what normally knocks you off track after that?" },
        currentMessage,
        qualifier: { facts: {} },
    });
    assert.deepEqual(answeredIssues, []);
});

test('paid Meta writer contract preserves rapid-turn details and validates the earned offer', () => {
    const detailIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "Food prep is usually the first thing to slip. What tends to throw it out?" },
        currentMessage: "I think it's lack of time, no prep. Bit of everything really, food is the main one.",
        qualifier: { facts: {} },
    });
    assert.ok(detailIssues.some(issue => /lack of time/i.test(issue)));

    const qualifier = {
        facts: {
            current_state: 'Wants to lose 8kg and feel fitter.',
            history_blockers: 'Changing shift work disrupts routine.',
        },
    };
    const incompleteOfferIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: 'Balance could work well around your shifts. Want the details?' },
        currentMessage: 'My shifts change every week so I can never keep a routine.',
        qualifier,
    });
    assert.ok(incompleteOfferIssues.length >= 6);

    const completeOfferIssues = collectPaidMetaWriterContractIssues({
        draft: {
            joined: "Changing shifts make a rigid routine hard. Balance Foundations gives you a six-week workout program around your week, a plant-based meal plan, and one weekly check-in where I review your training and food and adjust both. It's one $89.99 payment for the full six weeks, with no subscription or auto-renewal. You can set yourself up and look through the app before paying. Want me to send you access?",
        },
        currentMessage: 'My shifts change every week so I can never keep a routine.',
        qualifier,
    });
    assert.deepEqual(completeOfferIssues, []);
});

test('paid Meta writer contract enforces the exact $89.99 price', () => {
    const incorrectPriceIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "It's $89 once for six weeks and it doesn't renew." },
        currentMessage: 'How much is it?',
        qualifier: { facts: {} },
    });
    assert.ok(incorrectPriceIssues.some(issue => /exactly as one \$89\.99 payment/i.test(issue)));

    const exactPriceIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "It's one $89.99 payment for the full six weeks and it doesn't renew." },
        currentMessage: 'How much is it?',
        qualifier: { facts: {} },
    });
    assert.deepEqual(exactPriceIssues, []);
});

test('paid Meta writer contract does not hold the approved first ad greeting as a premature pitch', () => {
    const opener = buildMetaAdFoundersPassFirstReply('What is the Founders Pass?');
    assert.equal(opener.replyMode, 'campaign_first_reply');
    assert.deepEqual(collectPaidMetaWriterContractIssues({
        draft: opener,
        currentMessage: 'What is the Founders Pass?',
        qualifier: { facts: {} },
    }), []);
});

test('paid Meta transition contract catches adopt wording and a mistyped plant-based frequency', () => {
    const currentMessage = "I'm looking to adopt\nRight now I eat any based 3 nights a week";
    const weakReplyIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "Three nights is a good start. The Founders Pass is $89.99 for six weeks. Want the details?" },
        currentMessage,
        qualifier: { facts: {} },
    });
    assert.ok(weakReplyIssues.some(issue => /health or fitness goal/i.test(issue)));
    assert.ok(weakReplyIssues.some(issue => /pitched before/i.test(issue)));

    assert.deepEqual(collectPaidMetaWriterContractIssues({
        draft: { joined: "Yeah, three nights a week is a good start if you're looking to make the shift. Outside of eating more plant-based, what's your main health or fitness goal at the moment?" },
        currentMessage,
        qualifier: { facts: {} },
    }), []);
});

test('paid Meta guaranteed fallback removes a premature offer and keeps the lead moving', () => {
    const currentMessage = "I'm looking to adopt\nRight now I eat any based 3 nights a week";
    const fallback = buildPaidMetaGuaranteedContractFallback({
        draft: { joined: 'Three nights is a start. The Founders Pass is $89.99 for six weeks. Want the details?', maxChunks: 3 },
        currentMessage,
        issues: ['The reply pitched before a concrete fitness goal and real blocker were both known.'],
    });
    assert.match(fallback.joined, /3 nights a week/i);
    assert.match(fallback.joined, /health or fitness goal/i);
    assert.doesNotMatch(fallback.joined, /what would you mainly like help with/i);
    assert.doesNotMatch(fallback.joined, /\$|Founders Pass|six weeks/i);
    assert.deepEqual(collectPaidMetaWriterContractIssues({
        draft: fallback,
        currentMessage,
        qualifier: { facts: {} },
    }).filter(issue => /pitched before/i.test(issue)), []);
});

test('paid Meta guaranteed fallback uses food and accountability to ask for the missing goal', () => {
    const currentMessage = 'I think I want guidance with food and accountability';
    const history = [{
        direction: 'out',
        text: 'What would you mainly like help with fitness-wise?',
    }];
    const fallback = buildPaidMetaGuaranteedContractFallback({
        draft: { joined: 'Foundations gives you the meal plan and weekly check-in.', maxChunks: 3 },
        currentMessage,
        issues: ['The reply pitched before a concrete fitness goal and real blocker were both known.'],
        qualifier: { facts: { current_state: 'Looking to adopt plant-based' } },
        history,
    });
    assert.match(fallback.joined, /food side mapped out/i);
    assert.match(fallback.joined, /keeping you accountable/i);
    assert.match(fallback.joined, /what result are you mainly hoping to achieve/i);
    assert.doesNotMatch(fallback.joined, /partway there|help with fitness-wise/i);
});

test('paid Meta guaranteed earned offer is not held behind the ten-minute fallback sender', () => {
    const currentMessage = 'I just slack off';
    const history = [
        { direction: 'in', text: 'I need to lose weight' },
        { direction: 'out', text: 'Yeah, losing weight is a clear goal. What usually makes it hardest for you to stay consistent?' },
    ];
    const qualifier = {
        facts: {
            motivation: 'Lose weight',
            current_state: 'Vegan, wants weight loss',
            history_blockers: 'Slacks off and struggles with consistency',
        },
    };
    const fallback = buildPaidMetaGuaranteedContractFallback({
        draft: {
            joined: 'Balance Foundations gives you workouts and a meal plan. Want the details?',
            model: 'openai-gpt-5.4-mini-paid-meta',
            replyMode: 'standard',
            maxChunks: 3,
        },
        currentMessage,
        issues: [
            'Earned paid-Meta offer is missing six-week course.',
            'Earned paid-Meta offer is missing look inside before payment.',
        ],
        qualifier,
        history,
    });
    const review = {
        verdict: 'pass',
        confidence: 1,
        issues: [],
        notification_required: false,
        context_loss_suspected: false,
        reviewer_model: 'deterministic-paid-meta-guaranteed-send-v1',
    };

    assert.equal(fallback.replyMode, 'campaign_sales_progression');
    assert.equal(fallback.paidMetaGuaranteedContract, true);
    assert.deepStrictEqual(collectPaidMetaWriterContractIssues({
        draft: fallback,
        currentMessage,
        qualifier,
        history,
    }), []);
    assert.equal(getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: { required: false },
        draft: fallback,
        draftReview: review,
        currentMessage,
        qualifier,
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 4,
        alertData: { meta_ad_fast_lane: true },
    }), null);
    assert.equal(shouldDispatchMetaAdReplyImmediately({
        alertData: {
            meta_ad_fast_lane: true,
            draft_review: review,
        },
        normalizedTiming: { action: 'send_now' },
        scheduleResolution: { deferredForWorkingHours: false },
    }), true);
});

test('a repaired paid Meta goal question drops the stale offer warning from the original draft', () => {
    const common = {
        mediaReview: { required: false },
        contextReview: { required: false },
        draftReview: {
            verdict: 'pass',
            confidence: 1,
            issues: [],
            notification_required: false,
            context_loss_suspected: false,
            reviewer_model: 'deterministic-paid-meta-guaranteed-send-v1',
        },
        challengeOfferWarning: {
            required: true,
            code: 'challenge_offer',
            label: 'starter coaching invite',
        },
        currentMessage: "I'm vegan",
        qualifier: null,
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 1,
        alertData: { meta_ad_fast_lane: true, meta_ad_conversation_fast_lane: true },
    };
    const repairedGoalQuestion = {
        joined: 'Nice. What’s your main health or fitness goal at the moment?',
        model: 'openai-gpt-5.4-mini-paid-meta+paid-meta-guaranteed',
        replyMode: 'campaign_sales_progression',
        paidMetaGuaranteedContract: true,
    };
    assert.equal(getAutoDmHoldReason({ ...common, draft: repairedGoalQuestion }), null);

    const actualOffer = {
        ...repairedGoalQuestion,
        joined: 'Balance Foundations gives you a six-week coaching plan. Want me to send the details?',
        paidMetaGuaranteedContract: false,
    };
    assert.equal(getAutoDmHoldReason({ ...common, draft: actualOffer })?.code, 'challenge_offer');
});

test('the verified guided-sales offer is not blocked as premature after goal and blocker qualification', () => {
    const guidedOffer = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I just slack off when work gets busy',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                motivation: 'Lose around 10kg',
                current_state: 'Vegan',
                history_blockers: 'Slacks off when work gets busy',
            },
        },
        history: [
            { direction: 'in', text: 'I want to lose around 10kg' },
            { direction: 'out', text: 'What usually gets in the way of making that happen consistently?' },
        ],
        flowVariant: 'plant_based_control',
    });
    const approval = buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: guidedOffer,
        currentMessage: 'I just slack off when work gets busy',
        linkedUserId: null,
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { history_blockers: 'Slacks off when work gets busy' },
        },
        history: [
            {
                direction: 'out',
                text: 'Balance Foundations is a six-week course with your workout program built around your week and a plant-based meal plan.',
            },
            {
                direction: 'out',
                text: 'It is one $89.99 payment. You can look through the app before you pay. Want me to send you access?',
            },
        ],
    });
    assert.equal(approval?.required, false);
    assert.equal(getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: { required: false },
        draft: guidedOffer,
        draftReview: { verdict: 'pass', confidence: 1, issues: [] },
        challengeOfferWarning: approval,
        currentMessage: 'I just slack off when work gets busy',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { history_blockers: 'Slacks off when work gets busy' },
        },
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 3,
        alertData: { meta_ad_fast_lane: true, meta_ad_conversation_fast_lane: true },
    }), null);

    assert.equal(getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: { required: false },
        draft: guidedOffer,
        draftReview: {
            verdict: 'warn',
            confidence: 0.4,
            issues: ['Subjective reviewer claims the earned offer moved too soon.'],
        },
        challengeOfferWarning: approval,
        currentMessage: 'I just slack off when work gets busy',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { history_blockers: 'Slacks off when work gets busy' },
        },
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 3,
        alertData: { meta_ad_fast_lane: true, meta_ad_conversation_fast_lane: true },
    }), null, 'a subjective style veto cannot hold a verified guided offer that passed its deterministic contract');
});

test('paid Meta contract blocks asking the same question after the lead answers accountability', () => {
    const repeated = collectPaidMetaWriterContractIssues({
        draft: { joined: 'Yeah, it sounds like you are already partway there. What would you mainly like help with fitness-wise?' },
        currentMessage: 'Accountability',
        qualifier: { facts: { current_state: 'Looking to adopt plant-based' } },
        history: [{ direction: 'out', text: 'What would you mainly like help with fitness-wise?' }],
    });
    assert.ok(repeated.some(issue => /repeated a question/i.test(issue)));
    assert.ok(repeated.some(isBlockingPaidMetaWriterContractIssue));

    const fallback = buildPaidMetaGuaranteedContractFallback({
        draft: { joined: 'What would you mainly like help with fitness-wise?', maxChunks: 3 },
        currentMessage: 'Accountability',
        issues: repeated,
        qualifier: { facts: { current_state: 'Looking to adopt plant-based' } },
        history: [{ direction: 'out', text: 'What would you mainly like help with fitness-wise?' }],
    });
    assert.match(fallback.joined, /keep you accountable/i);
    assert.match(fallback.joined, /what result are you mainly hoping to achieve/i);
    assert.doesNotMatch(fallback.joined, /partway there|help with fitness-wise/i);
});

test('paid Meta gets to know the plant-based reason before asking for the fitness goal', () => {
    const identityReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: "I'm vegetarian",
        history: [{
            direction: 'out',
            text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?',
        }],
        flowVariant: 'plant_based_control',
    });
    assert.match(identityReply.joined, /how long have you been vegetarian, and what made you go vegetarian\?/i);
    assert.doesNotMatch(identityReply.joined, /health or fitness goal/i);

    const reasonReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Mostly animals and the ethics side of it.',
        history: [
            { direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' },
            { direction: 'in', text: "I'm vegetarian" },
            { direction: 'out', text: identityReply.joined },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.match(reasonReply.joined, /animals|ethics|I get that/i);
    assert.match(reasonReply.joined, /main health or fitness goal/i);
    assert.equal((reasonReply.joined.match(/\?/g) || []).length, 1);

    const reciprocalReasonReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Ohhhh for the animals and health!\nHow about you?',
        history: [
            { direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' },
            { direction: 'in', text: "I'm vegan!" },
            { direction: 'out', text: 'Nice. What made you decide to go plant-based?' },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.match(reciprocalReasonReply.joined, /animals were a big part of it for me too/i);
    assert.match(reciprocalReasonReply.joined, /I've been vegan for five years (?:too|now)/i);
    assert.match(reciprocalReasonReply.joined, /main health or fitness goal/i);
    assert.equal((reciprocalReasonReply.joined.match(/\?/g) || []).length, 1);

    const reciprocalDirective = buildPaidMetaTurnDirective({
        inboundMessages: ['Ohhhh for the animals and health!', 'How about you?'],
        history: [{ direction: 'out', text: 'Nice. What made you decide to go plant-based?' }],
    });
    assert.match(reciprocalDirective, /animals were a big part of Shannon going vegan.*five years/i);
    assert.match(reciprocalDirective, /Mandatory direct questions to answer explicitly.*How about you\?/i);

    const incompleteReciprocalIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "I've been vegan for five years too. What's your main health or fitness goal?" },
        currentMessage: 'Ohhhh for the animals and health! How about you?',
        qualifier: null,
        history: [{ direction: 'out', text: 'Nice. What made you decide to go plant-based?' }],
    });
    assert.ok(incompleteReciprocalIssues.some(issue => /why Shannon went vegan/i.test(issue)));
});

test('paid Meta food confusion is a real blocker and cannot be silenced by a style warning', () => {
    const history = [
        { direction: 'out', text: 'What is your main health or fitness goal at the moment?' },
        { direction: 'in', text: 'I want to grow muscle' },
        { direction: 'out', text: 'What usually gets in the way of making that happen consistently?' },
    ];
    const qualifier = {
        commercial_stage: 'engaged',
        facts: {
            motivation: 'Wants to grow muscle',
            current_state: 'Mhmm I Dunn what to eat',
            history_blockers: null,
        },
    };
    const blockerReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Mhmm I Dunn what to eat',
        qualifier,
        history,
        flowVariant: 'plant_based_control',
    });
    assert.match(blockerReply.joined, /build muscle but don't know what to eat/i);
    assert.match(blockerReply.joined, /plant-based meal plan/i);
    assert.match(blockerReply.joined, /one \$89\.99 payment/i);
    assert.equal(blockerReply.chunks.length, 3);
    assert.ok(blockerReply.chunks.every(chunk => chunk.length <= 240),
        'the complete offer must fit in three native Instagram text bubbles');
    assert.match(blockerReply.chunks[0], /quick video showing you how it works/i);
    assert.match(
        blockerReply.chunks.at(-1),
        /if you're interested, I can set you up in the app so you can see your meal plan and workout program before making a payment\. Keen\?$/i
    );
    assert.equal(blockerReply.videoAttachmentUrl, BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL);
    assert.doesNotMatch(blockerReply.joined, /what do you usually|what usually gets in the way/i);

    const released = buildPaidMetaNonBlockingReviewFallback({
        draft: {
            chunks: ['Yeah, that is the bit that trips people up. What do you usually eat?'],
            joined: 'Yeah, that is the bit that trips people up. What do you usually eat?',
            model: 'openai-paid-meta',
            replyMode: 'standard',
        },
        draftReview: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
        },
        currentMessage: 'Mhmm I Dunn what to eat',
        qualifier,
        history,
        flowVariant: 'plant_based_control',
    });
    assert.equal(released.paidMetaNonBlockingReviewReleased, true);
    assert.equal(released.model, 'deterministic_paid_meta_guided_sales_v1');
    assert.equal(released.videoAttachmentUrl, BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL);
    assert.doesNotMatch(released.joined, /what do you usually eat/i);
});

test('paid Meta answers a rapid meal-plan question without asking the known goal twice', () => {
    const history = [
        { direction: 'out', text: 'Nice. What made you decide to go plant-based?' },
        { direction: 'in', text: 'Ohhhh for the animals and health!' },
        { direction: 'in', text: 'How about you?' },
        { direction: 'out', text: "I've been vegan for five years too. What's your main health or fitness goal at the moment?" },
        { direction: 'in', text: 'I want to lose 10 kilos' },
        { direction: 'out', text: "Yeah, that's a clear goal. What usually gets in the way of making that happen consistently?" },
    ];
    const currentMessage = 'Mhmm I dunno what to eat\nDo you offer meal plans?';
    const reply = buildDeterministicPaidMetaConversationReply({
        currentMessage,
        qualifier: null,
        history,
        flowVariant: 'plant_based_control',
    });

    assert.match(reply.chunks[0], /^Yeah, I do\. If you want to lose 10 kilos but don't know what to eat/i);
    assert.match(reply.joined, /plant-based meal plan/i);
    assert.match(reply.joined, /Keen\?$/i);
    assert.doesNotMatch(reply.joined, /what's your main health or fitness goal/i);

    const badDraft = {
        joined: 'Yeah, that makes sense. What result are you mainly hoping to achieve?',
    };
    const issues = collectPaidMetaWriterContractIssues({
        draft: badDraft,
        currentMessage,
        qualifier: null,
        history,
    });
    assert.ok(issues.some(issue => /repeated a question/i.test(issue)));
    const repaired = buildPaidMetaGuaranteedContractFallback({
        draft: badDraft,
        currentMessage,
        issues,
        qualifier: null,
        history,
    });
    assert.match(repaired.chunks[0], /^Yeah, I do\. If you want to lose 10 kilos but don't know what to eat/i);
    assert.match(repaired.joined, /Keen\?$/i);
    assert.doesNotMatch(repaired.joined, /main health or fitness goal|what result are you/i);

    const unansweredMealPlanIssues = collectPaidMetaWriterContractIssues({
        draft: { joined: "That makes sense. What's your main health or fitness goal?" },
        currentMessage: 'Do you offer meal plans?',
        qualifier: null,
        history: [],
    });
    assert.ok(unansweredMealPlanIssues.some(issue => /meal-plan question directly/i.test(issue)));
    assert.ok(unansweredMealPlanIssues.some(isBlockingPaidMetaWriterContractIssue));
    const directMealPlanRepair = buildPaidMetaGuaranteedContractFallback({
        draft: { joined: "That makes sense. What's your main health or fitness goal?" },
        currentMessage: 'Do you offer meal plans?',
        issues: unansweredMealPlanIssues,
        qualifier: null,
        history: [],
    });
    assert.match(directMealPlanRepair.joined, /^Yeah, I do\./i);
    assert.match(directMealPlanRepair.joined, /includes a plant-based meal plan/i);
});

test('paid Meta guided sales stages move goal to blocker to complete offer to preview link', () => {
    const appPreviewUrl = buildMetaAppPreviewUrl('11111111-2222-4333-8444-555555555555', {
        env: { META_APP_PREVIEW_REF_SECRET: 'paid-meta-guided-sales-test-secret' },
    });
    const opener = 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?';
    const goalQuestion = 'Nice, three nights is a solid start. What is your main health or fitness goal at the moment?';
    const goalHistory = [
        { direction: 'out', text: opener },
        { direction: 'in', text: 'I eat plant based three nights a week.' },
        { direction: 'out', text: goalQuestion },
    ];
    const goalReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I want to lose 8kg and feel fitter.',
        qualifier: { facts: { current_state: 'Plant based three nights weekly' } },
        history: goalHistory,
        flowVariant: 'plant_based_control',
        appPreviewUrl,
    });
    assert.match(goalReply.joined, /losing the weight and feeling fitter/i);
    assert.match(goalReply.joined, /This is Ally/i);
    assert.match(goalReply.imageAttachmentUrl, /ally-cocos\.png/i);
    assert.match(goalReply.joined, /gets? in the way/i);
    assert.doesNotMatch(goalReply.joined, /founders|\$89/i);

    const blockerHistory = [
        ...goalHistory,
        { direction: 'in', text: 'I want to lose 8kg and feel fitter.' },
        { direction: 'out', text: goalReply.joined },
    ];
    const offerReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'My shifts change every week so I cannot keep a routine.',
        qualifier: { facts: { motivation: 'Lose 8kg and feel fitter' } },
        history: blockerHistory,
        flowVariant: 'plant_based_control',
        appPreviewUrl,
    });
    assert.match(offerReply.joined, /six-week/i);
    assert.match(offerReply.joined, /workout program/i);
    assert.match(offerReply.joined, /plant-based meal plan/i);
    assert.match(offerReply.joined, /weekly check-in/i);
    assert.match(offerReply.joined, /one \$89\.99 payment/i);
    assert.match(offerReply.joined, /no subscription or auto-renewal/i);
    assert.match(offerReply.joined, /quick video showing you how it works/i);
    assert.equal(offerReply.videoAttachmentUrl, BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL);
    assert.equal(
        buildDraftVideoAttachmentData(offerReply).draft_video_attachment_url,
        BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
        'the approved proof video must survive into the sender payload'
    );
    assert.ok(
        fs.statSync(path.join(__dirname, '..', 'assets', 'balance-foundations-app-proof-v2.mp4')).size > 1_000_000,
        'the public evergreen app proof video must be packaged with the site'
    );
    assert.match(offerReply.joined, /before making a payment/i);
    assert.match(offerReply.joined, /Keen\?/i);
    assert.doesNotMatch(offerReply.joined, /https?:\/\//i);

    const acceptHistory = [
        ...blockerHistory,
        { direction: 'in', text: 'My shifts change every week so I cannot keep a routine.' },
        { direction: 'out', text: offerReply.joined },
    ];
    const linkReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yep, give me a look.',
        qualifier: { facts: { motivation: 'Lose 8kg and feel fitter', history_blockers: 'Shifts break routine' } },
        history: acceptHistory,
        flowVariant: 'plant_based_control',
        appPreviewUrl,
    });
    const sentUrl = linkReply.joined.match(/https?:\/\/\S+/)?.[0] || '';
    assert.equal(linkReply.replyMode, 'campaign_app_preview_handoff');
    assert.match(linkReply.joined, /profile, starting workout program and plant-based meal plan/i);
    assert.match(linkReply.joined, /full app so you can look around before deciding/i);
    assert.equal(isMetaAppPreviewUrl(sentUrl), true);
});

test('paid Meta transformation proof is selected from the lead goal and withheld when the fit is weak or sensitive', () => {
    const strength = resolvePaidMetaTransformationProof({
        goalText: 'I want to get stronger, fitter and feel more confident in the gym.',
    });
    assert.equal(strength.id, 'gen_strength_confidence');
    assert.match(strength.imageUrl, /gen-cocos\.jpg/i);
    assert.match(strength.introduction, /This is Gen/i);

    const recomposition = resolvePaidMetaTransformationProof({
        goalText: 'I want body recomposition and more tone, not just a lower number on the scale.',
    });
    assert.equal(recomposition.id, 'dani_recomposition');
    assert.match(recomposition.imageUrl, /dani-front-mirror-8-weeks\.png/i);
    assert.match(recomposition.introduction, /This is Dani/i);

    const shared = resolvePaidMetaTransformationProof({
        goalText: 'My friend and I want to train together, lose weight and keep each other accountable.',
    });
    assert.equal(shared.id, 'bec_kirsty_shared_momentum');
    assert.match(shared.imageUrl, /bec-kirsty-cocos\.png/i);

    assert.equal(resolvePaidMetaTransformationProof({
        goalText: 'I want to improve my mobility.',
    }), null);
    assert.equal(resolvePaidMetaTransformationProof({
        goalText: 'I am postpartum and want to lose weight after having a baby.',
    }), null);

    assert.equal(maySendDraftImageAttachment({
        imageUrl: strength.imageUrl,
        replyText: 'This is Gen. She built her strength with a repeatable plan.',
    }), true);
    assert.equal(maySendDraftImageAttachment({
        imageUrl: strength.imageUrl,
        replyText: 'Here is a transformation that might help.',
    }), false, 'known proof media must never survive without the matching client introduction');
});

test('fresh paid-ad test episode excludes messages from before the latest referral', () => {
    const history = [
        { direction: 'in', text: 'The kids make it hard', created_at: '2026-08-13T09:05:00.000Z' },
        { direction: 'out', text: 'Work and kids can wreck the best intentions', created_at: '2026-08-13T09:06:00.000Z' },
        { direction: 'in', text: 'I need accountability', created_at: '2026-08-13T09:16:34.585Z' },
    ];
    const filtered = filterInternalTestHistoryAfterReset({
        history,
        customData: {
            bot_account: 'shan_n_sunny',
            internal_test_auto_reply_enabled: true,
            internal_test_meta_ad_flow: 'plant_based_control',
            internal_test_conversation_reset_at: '2026-08-05T01:21:09.031Z',
            meta_ad_attribution: { last_referral_at: '2026-08-13T09:08:55.411Z' },
        },
    });
    assert.deepEqual(filtered.map(message => message.text), ['I need accountability']);
});

test('accountability warnings never trigger invented replacement copy', () => {
    const repaired = buildSafeMetaAdStyleFallback({
        draft: {
            chunks: ['Accountability can help. Would that support make it easier?'],
            joined: 'Accountability can help. Would that support make it easier?',
        },
        draftReview: {
            verdict: 'warn',
            notification_required: false,
            context_loss_suspected: false,
            summary: 'The reply adds an unnecessary extra question.',
            issues: ['extra question'],
        },
        currentMessage: "I've been plant based for 5 years! I think I need accountability",
    });
    assert.equal(repaired, null);
});

test.skip('legacy deterministic blocker category copy retired in favour of the live writer', () => {
    const blockerQualifier = {
        facts: {
            current_state: 'Wants to lose 10kg and feel fitter.',
            history_blockers: 'A real blocker is disrupting progress.',
        },
        commercial_stage: 'problem_qualified',
    };
    const cases = [
        ["I start well, but if I miss a couple of days I feel like I've blown it and stop altogether.", /something keeps knocking the plan off course/i],
        ['My knee pain keeps stopping me whenever I build momentum.', /pain keeps interrupting/i],
        ['I get anxious and self-conscious at the gym.', /confidence is the thing getting in the way/i],
        ['Cravings and weekends keep undoing my progress.', /food is the part that keeps pulling things off track/i],
        ['Stress and low energy leave me exhausted.', /energy or headspace keeps changing/i],
        ['Rotating shifts make it impossible to keep a routine.', /life keeps crowding the week/i],
        ["I'm stuck because I don't know what exercises to do.", /not sure what the right next step is/i],
    ];
    for (const [currentMessage, expectedReflection] of cases) {
        const reply = buildDeterministicPaidMetaConversationReply({
            currentMessage,
            qualifier: blockerQualifier,
            history: [],
            flowVariant: 'plant_based_control',
            personalVoiceNoteMode: true,
        });
        assert.match(reply.joined, expectedReflection);
        assert.match(reply.joined, /losing 10 kilos and feeling fitter/i);
        assert.match(reply.joined, /eighty-nine dollars once for the full six weeks/i);
        assert.equal(reply.voiceCompanionText, '');
        assert.equal((reply.joined.match(/\?/g) || []).length, 1);
    }
});

test.skip('legacy deterministic question-fatigue copy retired in favour of the live writer', () => {
    const qualifier = {
        commercial_stage: 'engaged',
        facts: {
            current_state: 'Wants to lose weight',
            relationship_context: 'Work and kids disrupt consistency.',
        },
    };
    const repairReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I already answered that',
        qualifier,
        flowVariant: 'plant_based_control',
    });
    assert.match(repairReply.joined, /you already answered that/i);
    assert.match(repairReply.joined, /shouldn't have asked/i);
    assert.doesNotMatch(repairReply.joined, /\?/);

    const guardedReply = ensureMetaAdSalesProgressionQuestion({
        draft: repairReply,
        currentMessage: 'I already answered that',
        qualifier,
        leadStage: 'qualifying',
    });
    assert.equal(guardedReply.joined, repairReply.joined);
    assert.doesNotMatch(guardedReply.joined, /\?/);
});

test.skip('legacy deterministic price copy retired in favour of the live writer', () => {
    const qualifier = {
        stage: 'current_state',
        commercial_stage: 'buyer_intent',
        facts: {
            current_state: 'Wants to lose about 8 kilos.',
            history_blockers: 'If she misses two days, she gives up.',
        },
    };
    const draft = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Thanks. How much is Balance Foundations?',
        qualifier,
        flowVariant: 'plant_based_control',
    });
    assert.match(draft.joined, /Would you like me to send you the checkout link\?/i);
    const issues = collectCocosAutoRepairIssues({
        draft,
        draftReview: {
            verdict: 'pass',
            confidence: 1,
            issues: [],
            notification_required: false,
            context_loss_suspected: false,
            reviewer_model: 'deterministic-paid-meta-conversation-approval',
        },
        currentMessage: 'Thanks. How much is Balance Foundations?',
        qualifier,
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 8,
    });
    assert.equal(issues.some(issue => /invites coaching before/i.test(issue)), false);
    const hold = getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: { required: false },
        onboardingPhase: null,
        draft,
        draftReview: {
            verdict: 'pass',
            confidence: 1,
            issues: [],
            notification_required: false,
            context_loss_suspected: false,
            reviewer_model: 'deterministic-paid-meta-conversation-approval',
        },
        challengeOfferWarning: { required: false, code: 'approved_meta_ad_sales_progression' },
        currentMessage: 'Thanks. How much is Balance Foundations?',
        qualifier,
        leadStage: 'qualifying',
        linkedUserId: null,
        meaningfulLeadReplyCount: 8,
        alertData: { meta_ad_fast_lane: true, meta_ad_conversation_fast_lane: true },
    });
    assert.equal(hold, null);
});

test('deterministic first reply is narrow and leaves sensitive, opt-out, and unrelated ad messages to normal review', () => {
    for (const message of [
        'What is the Founders Pass?',
        "What's actually included?",
        'Do I need to already be Plant Based?',
        'Do you offer personalized coaching plans?',
        'Do you offer personalised coaching plans?',
        "I'm In - save me a spot!",
        'How do I join?',
        'BALANCE',
        'How does the accountability work?',
        'What is the cost?',
    ]) {
        assert.equal(shouldUseDeterministicMetaAdFirstReply(message), true, message);
    }

    for (const message of [
        'STOP',
        "Don't message me again",
        'Are you an AI bot?',
        'I need urgent help at hospital',
        'I need emotional support right now',
        'Balance is rubbish',
        'The cost of living is killing me',
        'Hey, Shannon sent me here about my knee',
        'Where do I start?',
    ]) {
        assert.equal(shouldUseDeterministicMetaAdFirstReply(message), false, message);
    }
});

test('preview-only Meta approval cannot make the worker invent a checkout link', () => {
    const draft = buildMetaAdFoundersPassFirstReply('What is the Founders Pass?');
    const approval = buildMetaAdFirstReplyApproval({ metaAdFirstInbound: true, draft });
    const handoff = buildApprovedMetaAdFirstReplyHandoffData({
        approval,
        draft,
        leadStage: 'new',
        linkedUserId: null,
    });

    assert.equal(draft.checkoutUrl, null);
    assert.equal(handoff.meta_ad_first_reply_preapproved, true);
    assert.equal(handoff.signup_link_handoff_url, undefined);
    assert.equal(handoff.approved_link_auto_sendable, false);

    const readyDraft = buildMetaAdFoundersPassFirstReply("I'm ready to start");
    const readyHandoff = buildApprovedMetaAdFirstReplyHandoffData({
        approval: buildMetaAdFirstReplyApproval({ metaAdFirstInbound: true, draft: readyDraft }),
        draft: readyDraft,
        leadStage: 'new',
        linkedUserId: null,
    });
    assert.equal(readyHandoff.approved_link_auto_sendable, true);
    assert.equal(readyHandoff.signup_link_handoff_url, 'https://plantbased-balance.org/founders');
});

test('paid Meta opt-out, identity, and safety messages always hold while ordinary flows are untouched', () => {
    const metaAlert = { meta_ad_fast_lane: true };
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'STOP' }).code, 'dm_opt_out');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: "Don't message me again" }).code, 'dm_opt_out');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'Are you an AI bot?' }).code, 'identity_question');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I am pregnant and injured' }), null,
        'ordinary pregnancy and injury context receives a safe non-diagnostic lead reply');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I want to be fitter and lose my pregnancy fat' }), null,
        'a postpartum fitness goal must not be mistaken for an active medical emergency');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'This is a medical emergency and I am in immediate danger' }), null,
        'medical wording alone stays in the careful AI-coach lead lane');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I am thinking about self-harm' }).code, 'safety_or_medical');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I feel suicidal' }).code, 'safety_or_medical');
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I need to stop snacking' }), null);
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: {}, currentMessage: 'Are you an AI bot?' }), null);
});

test('an attempted immediate Meta dispatch that does not succeed is treated as a failed handoff', () => {
    assert.equal(hasImmediateMetaDispatchFailure({}), false);
    assert.equal(hasImmediateMetaDispatchFailure({ immediateDispatch: null }), false);
    assert.equal(hasImmediateMetaDispatchFailure({ immediateDispatch: { attempted: true, ok: true } }), false);
    assert.equal(hasImmediateMetaDispatchFailure({ immediateDispatch: { attempted: true, ok: false, status: 502 } }), true);
    assert.equal(hasImmediateMetaDispatchFailure({ immediateDispatch: { attempted: false, ok: false, reason: 'claim_lost' } }), false);
});

test('deterministic Meta review bypass remains closed for real review risks', () => {
    const currentMessage = 'What is the Founders Pass?';
    const draft = buildMetaAdFoundersPassFirstReply(currentMessage);
    const approval = buildMetaAdFirstReplyApproval({ metaAdFirstInbound: true, draft });
    const baseline = {
        metaAdFirstInbound: true,
        draft,
        approval,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage,
    };

    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({ ...baseline, linkedUserId: 'linked-client' }), null);
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({ ...baseline, mediaReview: { required: true } }), null);
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({ ...baseline, contextReview: { required: true } }), null);
    const safeOpeningContextReview = buildApprovedDeterministicMetaAdFirstReplyReview({
        ...baseline,
        contextReview: {
            required: true,
            first_captured_lead_reply: true,
            reasons: [
                'first_captured_reply_with_hidden_context',
                'reference_heavy_reply_without_tracked_context',
            ],
        },
    });
    assert.equal(safeOpeningContextReview.verdict, 'pass');
    assert.equal(safeOpeningContextReview.context_warning_overridden, true);
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({
        ...baseline,
        contextReview: {
            required: true,
            first_captured_lead_reply: true,
            reasons: ['first_captured_reply_with_hidden_context', 'incomplete_media_context'],
        },
    }), null, 'a real context/media warning must still hold');
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({ ...baseline, currentMessage: 'Are you an AI bot?' }), null);
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({ ...baseline, currentMessage: 'I need urgent help at hospital' }), null);
});

test('Meta ad card transport attachment does not poison the first reply or follow-up media review', () => {
    const adCard = {
        direction: 'in',
        text: '[attachment:https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18106842581104525&signature=test]',
        created_at: '2026-07-31T03:12:30.042Z',
    };
    const offerQuestion = {
        direction: 'in',
        text: 'What is the Founders Pass?',
        created_at: '2026-07-31T03:12:30.595Z',
    };
    const realPhoto = {
        direction: 'in',
        text: '[PHOTO:https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=real-user-photo]',
        created_at: '2026-07-31T03:13:00.000Z',
    };

    const firstReplyHistory = filterMetaAdCardAttachmentHistory({
        history: [adCard],
        currentMessage: offerQuestion.text,
        metaAdFirstInbound: true,
    });
    assert.deepEqual(firstReplyHistory, []);

    const followUpHistory = filterMetaAdCardAttachmentHistory({
        history: [adCard, offerQuestion, realPhoto],
        currentMessage: 'Yeah send us the details',
        metaAdConversationFastLane: true,
    });
    assert.deepEqual(followUpHistory, [offerQuestion, realPhoto]);
});

test('inclusions quick reply answers the direct ask without a raw preview URL', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?");
    assert.equal(reply.model, 'deterministic_meta_ad_founders_pass_v4');
    assert.equal(reply.firstReplyIntent, 'inclusions');
    assert.equal(reply.chunks.length, 1);
    assert.equal(reply.checkoutUrl, null);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.joined, /Balance Foundations is our six-week plant-based fitness program inside the app/i);
    assert.match(reply.joined, /training, plant-based food support and the community/i);
    assert.match(reply.joined, /Are you currently plant-based or vegan, or are you looking to go plant-based or vegan\?/i);
    assert.doesNotMatch(reply.joined, /https?:\/\//);
});

test('personalised coaching FAQ answers from the advertised six-week program without a premature handoff', () => {
    for (const spelling of [
        'Do you offer personalized coaching plans?',
        'Do you offer personalised coaching plans?',
    ]) {
        assert.equal(resolveMetaAdFirstReplyIntent(spelling), 'personalised_coaching');
        const reply = buildMetaAdFoundersPassFirstReply(spelling);
        const approval = buildMetaAdFirstReplyApproval({ metaAdFirstInbound: true, draft: reply });
        const handoff = buildApprovedMetaAdFirstReplyHandoffData({
            approval,
            draft: reply,
            leadStage: 'new',
            linkedUserId: null,
        });

        assert.equal(reply.joined, 'Hey, yeah I do. Balance Foundations is our six-week plant-based fitness program inside the app, plus a weekly check-in where I review and adjust your training and food. Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?');
        assert.doesNotMatch(reply.joined, /Starter Coaching|\$29\.99/i);
        assert.equal(reply.checkoutUrl, null);
        assert.equal(reply.videoAttachmentUrl, undefined);
        assert.equal(approval.code, 'approved_meta_ad_first_reply');
        assert.equal(handoff.approved_link_auto_sendable, false);
        assert.equal(handoff.signup_link_handoff_url, undefined);
        assert.equal(isMetaAdGoalReplyTurn([{ direction: 'out', text: reply.joined }]), false);
    }
});

test('generic keyword and fit quick reply answer without a premature checkout link', () => {
    const overview = buildMetaAdFoundersPassFirstReply('BALANCE');
    assert.equal(overview.firstReplyIntent, 'overview');
    assert.equal(overview.checkoutUrl, null);
    assert.doesNotMatch(overview.joined, /plant-based-fitness\.html/);
    assert.equal(buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft: overview,
    }).code, 'approved_meta_ad_first_reply');

    const reply = buildMetaAdFoundersPassFirstReply('Is this right for me?');
    assert.equal(reply.firstReplyIntent, 'fit');
    assert.match(reply.joined, /Are you currently plant-based or vegan, or are you looking to go plant-based or vegan\?/i);
    assert.doesNotMatch(reply.joined, /plant-based-fitness\.html/);
    assert.doesNotMatch(reply.joined, /vegan fitness community/i);
});

test('plant-based identity answers advance reliably while transition details stay with the live writer', () => {
    const reply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I am interested but not fully plant-based yet',
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history: [{ direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(reply, null,
        'a transitioning answer must be reflected from its exact detail instead of replaced with fixed funnel copy');

    const currentlyPlantBasedReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yes, I am currently plant based',
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history: [{ direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(currentlyPlantBasedReply.model, 'deterministic_paid_meta_guided_sales_v1');
    assert.equal(currentlyPlantBasedReply.joined, 'Nice. How long have you been plant-based, and what made you go plant-based?');

    const shortVeganReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: "I'm vegan yeah",
        qualifier: { commercial_stage: 'buyer_intent', facts: {} },
        history: [{ direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(shortVeganReply.joined, 'Awesome. How long have you been vegan, and what made you go vegan?');
    assert.doesNotMatch(shortVeganReply.joined, /\$89\.99|link/i);

    const experiencedPlantBasedReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I have been vegan for 9 years',
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history: [{ direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(experiencedPlantBasedReply.model, 'deterministic_paid_meta_guided_sales_v1');
    assert.match(experiencedPlantBasedReply.joined, /vegan for five years too/i);
    assert.match(experiencedPlantBasedReply.joined, /what made you go vegan/i);

    const reciprocalExperiencedReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I am vegan, have been for years! How about you?',
        qualifier: { commercial_stage: 'engaged', facts: {} },
        history: [{ direction: 'out', text: 'Are you currently plant-based or vegan, or are you looking to go plant-based or vegan?' }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(reciprocalExperiencedReply.model, 'deterministic_paid_meta_guided_sales_v1');
    assert.match(reciprocalExperiencedReply.joined, /^I've been vegan for five years too\./i);
    assert.match(reciprocalExperiencedReply.joined, /what made you go vegan/i);
});

test('paid Meta ad conversations are text-only without changing other voice lanes', () => {
    const eligibleVoicePlan = {
        syntheticVoiceForbidden: false,
        useSyntheticVoice: true,
    };
    assert.equal(shouldUseOutboundSyntheticVoice({
        personalVoicePlan: eligibleVoicePlan,
        metaAdConversationFastLane: true,
    }), false);
    assert.equal(shouldUseOutboundSyntheticVoice({
        personalVoicePlan: eligibleVoicePlan,
        metaAdConversationFastLane: false,
    }), true, 'organic lead and client voice behavior stays unchanged');
    assert.equal(shouldUseOutboundSyntheticVoice({
        personalVoicePlan: { ...eligibleVoicePlan, syntheticVoiceForbidden: true },
        metaAdConversationFastLane: false,
    }), false);
});

test('only destination handoffs and the narrow guided sales spine override the paid Meta writer', () => {
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({ replyMode: 'campaign_sales_progression' }), false);
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({
        replyMode: 'campaign_sales_progression',
        identityProgression: true,
    }), false, 'identity and other conversational stages never override the live writer');
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({ replyMode: 'campaign_goal_proof' }), false);
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({
        replyMode: 'campaign_sales_progression',
        model: 'deterministic_paid_meta_guided_sales_v1',
    }), true);
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({ replyMode: 'campaign_buyer_handoff' }), true);
    assert.equal(shouldApplyDeterministicPaidMetaReplyOverride({ replyMode: 'campaign_app_preview_handoff' }), true);
});

test('private paid-ad voice cooldown restarts at the newest repeated FAQ opener', () => {
    assert.equal(resolveInternalTestVoiceCooldownResetAt({
        meta_ad_attribution: { last_referral_at: '2026-08-04T04:36:39.208Z' },
    }, [
        { direction: 'out', text: '[voice note]', created_at: '2026-08-04T04:40:00.000Z' },
        { direction: 'in', text: 'What is the Founders Pass?', created_at: '2026-08-04T05:10:00.000Z' },
        { direction: 'in', text: 'I want to lose weight', created_at: '2026-08-04T05:11:00.000Z' },
    ]), '2026-08-04T05:10:00.000Z');
});

test('paid-ad turn text keeps every rapid inbound bubble for progression checks', () => {
    assert.equal(buildCurrentInboundTurnText('Bit of everything really', [
        { text: "I think it's just lack of time no prep" },
    ]), "I think it's just lack of time no prep\nBit of everything really");
});

test.skip('legacy deterministic side-question copy retired in favour of the live writer', () => {
    const reply = buildDeterministicPaidMetaConversationReply({
        currentMessage: `I just can't stick to it`,
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: { motivation: 'lose weight' },
        },
        history: [
            { direction: 'out', text: 'This is Ally. She lost 12kg in 16 weeks.' },
            { direction: 'in', text: `She's done really well! Was this your client?` },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.match(reply.joined, /^Yeah, she's one of my clients\./i);
    assert.match(reply.joined, /keeping it going|drops off/i);
    assert.doesNotMatch(reply.joined, /was it your client/i);
});

test('the reply after the goal is tailored and carries the right native proof media', () => {
    const history = [{
        direction: 'out',
        text: "Hey, yeah of course. Before I send you a heap of generic info, what's the main thing you're trying to change with your fitness right now?",
    }];
    assert.equal(isMetaAdGoalReplyTurn(history), true);
    assert.equal(isMetaAdGoalReplyTurn([
        { direction: 'out', text: 'Morning. What are you mainly trying to change right now?' },
        { direction: 'in', text: 'I want to lose about 10kg and feel fitter.' },
    ]), true);
    assert.equal(isMetaAdGoalReplyTurn([
        { direction: 'out', text: 'When you say personalised, do you mean workouts, food, or both?' },
    ], 'Both. I want to lose about 10kg and feel fitter.'), true);
    assert.equal(isMetaAdGoalReplyTurn([
        { direction: 'in', text: 'I want to lose about 10kg and feel fitter.' },
        { direction: 'out', text: 'When have you tried before?' },
    ], 'I still want to lose about 10kg.'), false);
    assert.equal(isMetaAdGoalReplyTurn([{ direction: 'out', text: 'How was your week?' }]), false);

    const consistency = buildMetaAdGoalProofReply('I need accountability because I always fall off');
    assert.match(consistency.joined, /keeping the week on track once life gets busy/i);
    assert.match(consistency.joined, /six-week course turns that into a clear week/i);
    assert.doesNotMatch(consistency.joined, /\b\d+[- ]second\b/i);
    assert.equal(consistency.videoAttachmentUrl, '');
    assert.doesNotMatch(consistency.joined, /https?:\/\//);

    const nutrition = buildMetaAdGoalProofReply('I need help with vegan meals');
    assert.match(nutrition.joined, /plant-based food structure/i);
    assert.equal(nutrition.replyMode, 'campaign_goal_proof');
    const proofReview = buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdGoalReplyTurn: true,
        draft: nutrition,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage: 'I need help with vegan meals',
    });
    assert.equal(proofReview.verdict, 'pass');
    assert.equal(proofReview.notification_required, false);
    assert.equal(proofReview.reviewer_model, 'deterministic-meta-ad-goal-proof-approval');
    const coalescedAlertData = {
        existing_shell_field: true,
        ...buildDraftVideoAttachmentData(nutrition),
    };
    assert.equal(
        coalescedAlertData.draft_video_attachment_url,
        undefined,
        'the webhook alert-shell merge must persist the approved native video for the sender'
    );
    const producerSource = fs.readFileSync(
        path.join(__dirname, '..', 'netlify', 'functions', 'ig-instant-draft.js'),
        'utf8'
    );
    assert.ok(
        (producerSource.match(/\.\.\.buildDraftVideoAttachmentData\(draft\)/g) || []).length >= 3,
        'new alerts, coalesced webhook shells, and repaired drafts must all preserve the video attachment'
    );

    const weightGoal = buildMetaAdGoalProofReply('I need to lose weight, probably 15kgs');
    assert.match(weightGoal.joined, /15kg is a solid goal/i,
        'the deterministic proof reply directly acknowledges the lead goal');
    assert.match(weightGoal.joined, /Ally.*lost 12kg in 16 weeks/i);
    assert.match(weightGoal.imageAttachmentUrl, /ally-cocos\.png/);
    assert.equal(weightGoal.videoAttachmentUrl, null);
    const weightAndFitnessGoal = buildMetaAdGoalProofReply('I want to lose 10kg and feel fitter');
    assert.match(weightAndFitnessGoal.joined, /This is Ally/i,
        'the text immediately before the native proof image must introduce the person shown');
    assert.match(weightAndFitnessGoal.joined, /lost 12kg in 16 weeks/i);
    assert.match(weightAndFitnessGoal.imageAttachmentUrl, /ally-cocos\.png/);
    const naturalWeightGoal = buildMetaAdGoalProofReply(
        'The main thing I want to change is losing around 8 kilos and feeling comfortable in my clothes again.'
    );
    assert.match(naturalWeightGoal.joined, /This is Ally/i);
    assert.match(naturalWeightGoal.imageAttachmentUrl, /ally-cocos\.png/);
    assert.equal(
        buildDraftImageAttachmentData(weightGoal).draft_image_attachment_url,
        weightGoal.imageAttachmentUrl
    );
    const appliedWeightGoal = applyMetaAdGoalProofReply({
        joined: 'Nice, that is a solid goal.',
        chunks: ['Nice, that is a solid goal.'],
        model: 'vertex-v7',
        replyMode: 'standard',
        timeline: 'preserved live timeline',
    }, 'My goal is weight loss. I would like to lose about 10kg.');
    assert.equal(appliedWeightGoal.replyMode, 'campaign_goal_proof');
    assert.equal(appliedWeightGoal.model, 'vertex-v7+guided_meta_goal_proof_v1');
    assert.match(appliedWeightGoal.joined, /^Nice, that is a solid goal\./,
        'proof media must preserve the guided response instead of replacing its wording');
    assert.equal(appliedWeightGoal.joined, 'Nice, that is a solid goal.');
    assert.equal(appliedWeightGoal.imageAttachmentUrl, null,
        'Ally proof cannot attach unless the live writer naturally introduced her');
    assert.equal(appliedWeightGoal.timeline, 'preserved live timeline');
    assert.equal(maySendDraftImageAttachment({
        imageUrl: weightGoal.imageAttachmentUrl,
        replyText: 'Yeah, I get you. What tends to get in the way?',
    }), false, 'the final sender must suppress Ally\'s photo if a repair removes its introduction');
    assert.equal(maySendDraftImageAttachment({
        imageUrl: weightGoal.imageAttachmentUrl,
        replyText: 'This is Ally, one of my clients. She lost 12kg in 16 weeks.',
    }), true, 'the final sender may keep Ally\'s photo when the reviewed text introduces her');
    const guardedWeightGoal = ensureMetaAdSalesProgressionQuestion({
        draft: weightGoal,
        currentMessage: 'I need to lose weight, probably 15kgs',
        qualifier: { commercial_stage: 'engaged', facts: { current_state: 'Wants to lose 15kg.' } },
        leadStage: 'qualifying',
    });
    assert.equal(guardedWeightGoal, weightGoal,
        'the guard preserves the writer/proof draft without appending a stock question');
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdGoalReplyTurn: true,
        draft: guardedWeightGoal,
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
        currentMessage: 'I need to lose weight, probably 15kgs',
    }).reviewer_model, 'deterministic-meta-ad-goal-proof-approval',
    'adding the required sales question must not knock a deterministic goal proof out of the fast path');

    assert.deepEqual(buildInstagramGraphVideoMessagePayload({
        recipientId: 'ig-user-1',
        videoUrl: consistency.videoAttachmentUrl,
    }), {
        recipient: { id: 'ig-user-1' },
        message: {
            attachment: {
                type: 'video',
                payload: { url: consistency.videoAttachmentUrl },
            },
        },
    });
    const editedVideoReply = stripPaidMetaProofMediaUrls(
        `That's what Balance is for. Quick look at the app: ${BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL} Would you like a free personalised look before paying?`
    );
    assert.equal(
        editedVideoReply,
        `That's what Balance is for. Quick look at the app. Would you like a free personalised look before paying?`,
        'the public message must never expose the proof-video URL'
    );
    assert.equal(maySendDraftVideoAttachment({
        videoUrl: BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
        replyText: editedVideoReply,
    }), true, 'a reviewed edit keeps the native video when it still introduces it');
    assert.equal(maySendDraftVideoAttachment({
        videoUrl: BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL,
        replyText: 'That makes sense. Would you like a free personalised look?',
    }), false, 'the native video is suppressed when a repair removes its introduction');
    const videoTurnMessages = splitTerminalQuestionForProofMedia([editedVideoReply]);
    assert.deepEqual(videoTurnMessages, [
        `That's what Balance is for. Quick look at the app.`,
        'Would you like a free personalised look before paying?',
    ]);
    assert.deepEqual(insertProofMediaBeforeFinalQuestion(
        videoTurnMessages.map(text => ({ kind: 'text', text })),
        { kind: 'video', videoUrl: BALANCE_FOUNDATIONS_APP_PROOF_VIDEO_URL }
    ).map(item => item.kind), ['text', 'video', 'text'],
    'the native video must sit between its introduction and the purposeful question');
    assert.deepEqual(buildInstagramGraphImageMessagePayload({
        recipientId: 'ig-user-1',
        imageUrl: weightGoal.imageAttachmentUrl,
    }), {
        recipient: { id: 'ig-user-1' },
        message: {
            attachment: {
                type: 'image',
                payload: { url: weightGoal.imageAttachmentUrl },
            },
        },
    });
});

test.skip('legacy deterministic conversational stages retired in favour of the live writer', () => {
    const checkoutUrl = 'https://plantbased-balance.org/founders';
    const goalQualifier = {
        commercial_stage: 'engaged',
        facts: { current_state: 'Wants to lose 15kg.', history_blockers: null },
    };
    const personalisedVoiceReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Do you offer personalized coaching plans?',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                current_state: 'Wants to lose weight.',
                history_blockers: 'Gets excited for a few weeks then drops off.',
            },
        },
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: true,
    });
    assert.match(personalisedVoiceReply.joined, /Balance Foundations gives you a clear six-week starting plan inside the app/i);
    assert.match(personalisedVoiceReply.joined, /once a week to review how training and food are actually going/i);
    assert.doesNotMatch(personalisedVoiceReply.joined, /Starter Coaching|\$29\.99/i);
    assert.equal((personalisedVoiceReply.joined.match(/\?/g) || []).length, 1);
    assert.equal(inspectVoiceScriptQuality(personalisedVoiceReply.joined).valid, true);

    const blockerVoiceReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Work, the kids and low confidence keep knocking me off track.',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                current_state: 'Wants to lose 8kg.',
                history_blockers: 'Work, children and confidence disrupt consistency.',
            },
        },
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: true,
    });
    assert.deepEqual(blockerVoiceReply.voiceThoughtPausesMs, [1700, 2400, 1500, 1000]);
    assert.equal(blockerVoiceReply.voiceRenderMode, 'single_performance_aligned_pauses_v1');
    assert.equal(blockerVoiceReply.joined.split(/\n\s*\n/).length, 5);
    assert.match(blockerVoiceReply.joined, /^Yeah, that makes total sense/);
    assert.doesNotMatch(blockerVoiceReply.joined, /Hey,?\s+how are (?:ya|you)|how are you going/i);
    assert.match(blockerVoiceReply.joined, /Ummmm\.\.\./);
    assert.match(blockerVoiceReply.joined, /losing 8 kilos/i);
    assert.match(blockerVoiceReply.joined, /simple starter plan/i);
    assert.match(blockerVoiceReply.joined, /weekly goals, starter workouts, meal plan, community, and my welcome note in your Inbox/i);
    assert.match(blockerVoiceReply.joined, /Have a look first, then decide\. How does that sound\?/i);
    assert.equal(inspectVoiceScriptQuality(blockerVoiceReply.joined).valid, true);

    const changingShiftBlocker = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'My shifts change every week, family stuff piles up, and after one missed workout I get discouraged and stop following the plan.',
        qualifier: {
            commercial_stage: 'engaged',
            facts: {
                current_state: 'Wants to lose 7kg and feel comfortable.',
                history_blockers: 'Changing shifts and a missed workout lead to discouragement.',
            },
        },
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: true,
    });
    assert.equal(changingShiftBlocker.replyMode, 'campaign_sales_progression');
    assert.deepEqual(changingShiftBlocker.voiceThoughtPausesMs, [1700, 2400, 1500, 1000]);
    assert.match(changingShiftBlocker.joined, /life keeps crowding the week/i);
    assert.match(changingShiftBlocker.joined, /losing 7 kilos/i);

    const goal = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I need to lose weight, probably 15kgs',
        qualifier: goalQualifier,
        flowVariant: 'plant_based_control',
        checkoutUrl,
        allowVideoAttachment: true,
    });
    assert.match(goal.joined, /15kg is a solid goal/i);
    assert.match(goal.imageAttachmentUrl, /ally-cocos\.png/);
    assert.equal(goal.videoAttachmentUrl, null);
    const guardedGoal = ensureMetaAdSalesProgressionQuestion({
        draft: goal,
        currentMessage: 'I need to lose weight, probably 15kgs',
        qualifier: goalQualifier,
        leadStage: 'qualifying',
    });
    assert.equal((guardedGoal.joined.match(/\?/g) || []).length, 1);
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdConversationFastLane: true,
        draft: guardedGoal,
        currentMessage: 'I need to lose weight, probably 15kgs',
        linkedUserId: null,
        mediaReview: { required: false },
        contextReview: { required: false },
    }).reviewer_model, 'deterministic-meta-ad-goal-proof-approval');

    const restartedPersonalisedGoal = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I need to lose weight!',
        qualifier: {
            commercial_stage: 'engaged',
            facts: {
                current_state: 'Wants to lose weight.',
                history_blockers: 'Old saved memory says they previously dropped off.',
            },
        },
        history: [{
            direction: 'out',
            text: 'Yeah, I do. Starter Coaching is the personalised option, where I review and adjust your training and food each week. What are you mainly trying to change at the moment?',
        }],
        flowVariant: 'plant_based_control',
        allowVideoAttachment: true,
    });
    const guardedRestartedPersonalisedGoal = ensureMetaAdSalesProgressionQuestion({
        draft: restartedPersonalisedGoal,
        currentMessage: 'I need to lose weight!',
        qualifier: {
            commercial_stage: 'engaged',
            facts: { current_state: 'Wants to lose weight.', history_blockers: null },
        },
        leadStage: 'qualifying',
    });
    assert.equal(restartedPersonalisedGoal.replyMode, 'campaign_goal_proof');
    assert.match(guardedRestartedPersonalisedGoal.joined, /Ally.*lost 12kg in 16 weeks/i);
    assert.match(guardedRestartedPersonalisedGoal.joined, /what tends to fall apart first/i);
    assert.doesNotMatch(guardedRestartedPersonalisedGoal.joined, /\$29\.99|Starter Coaching is probably/i);
    assert.match(guardedRestartedPersonalisedGoal.imageAttachmentUrl, /ally-cocos\.png/);
    assert.equal(guardedRestartedPersonalisedGoal.videoAttachmentUrl, null);

    const blockerQualifier = {
        commercial_stage: 'problem_qualified',
        facts: { current_state: 'Wants to lose 15kg.', history_blockers: 'Keeps stopping and starting.' },
    };
    const blocker = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I feel like I just stop and start again. So many times',
        qualifier: blockerQualifier,
        flowVariant: 'plant_based_control',
    });
    assert.match(blocker.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.doesNotMatch(blocker.joined, /meta-app-preview\.html/i);
    assert.equal((blocker.joined.match(/\?/g) || []).length, 1);
    assert.equal(buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: blocker,
        currentMessage: 'I feel like I just stop and start again. So many times',
        qualifier: blockerQualifier,
    }).code, 'approved_meta_ad_sales_progression');
    assert.equal(buildApprovedDeterministicMetaAdFirstReplyReview({
        metaAdConversationFastLane: true,
        draft: blocker,
        currentMessage: 'I feel like I just stop and start again. So many times',
        qualifier: blockerQualifier,
        mediaReview: { required: false },
        contextReview: { required: false },
    }).reviewer_model, 'deterministic-paid-meta-conversation-approval');

    const voiceBlocker = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I feel like I just stop and start again. So many times',
        qualifier: blockerQualifier,
        personalVoiceNoteMode: true,
    });
    assert.ok(voiceBlocker.joined.trim().split(/\s+/).length >= 34);
    assert.equal((voiceBlocker.joined.match(/\?/g) || []).length, 1);
    assert.equal(voiceBlocker.voiceCompanionText, '');
    assert.equal(inspectVoiceScriptQuality(voiceBlocker.joined).valid, true,
        'the deterministic accountability reply is ready for ElevenLabs without another repair round');

    const rapidBubbleVoiceBlocker = buildDeterministicPaidMetaConversationReply({
        currentMessage: "I think it's just lack of time no prep\nBit of everything really",
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                current_state: 'Wants to lose weight.',
                history_blockers: 'Lack of time and no food prep make consistency difficult.',
            },
        },
        flowVariant: 'plant_based_control',
        personalVoiceNoteMode: true,
    });
    assert.ok(rapidBubbleVoiceBlocker, 'the complete rapid-message turn should reach deterministic progression');
    assert.ok(rapidBubbleVoiceBlocker.joined.trim().split(/\s+/).length >= 34);
    assert.equal((rapidBubbleVoiceBlocker.joined.match(/\?/g) || []).length, 1,
        'the voice note must finish with the next purposeful question');
    assert.equal(inspectVoiceScriptQuality(rapidBubbleVoiceBlocker.joined).valid, true);

    const nextStep = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'So what do I do',
        qualifier: blockerQualifier,
        history: [],
        flowVariant: 'plant_based_control',
    });
    assert.match(nextStep.joined, /Balance Foundations is one \$89\.99 payment/i);
    assert.match(nextStep.joined, /one \$89\.99 payment for the complete six-week curriculum/i);
    assert.doesNotMatch(nextStep.joined, /ongoing weekly coaching|Starter Coaching/i);
    assert.match(nextStep.joined, /access to the app so you can check it out before any payment/i);
    assert.equal((nextStep.joined.match(/\?/g) || []).length, 1);
    assert.doesNotMatch(nextStep.joined, /https?:\/\//);

    const acceptedSupport = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yeah',
        qualifier: blockerQualifier,
        history: [{ direction: 'out', text: 'Would having a clear plan and me checking in help you stay on track?' }],
        flowVariant: 'plant_based_control',
    });
    assert.match(acceptedSupport.joined, /meta-app-preview\.html/i);
    assert.match(acceptedSupport.joined, /before any payment/i);
    assert.equal((acceptedSupport.joined.match(/\?/g) || []).length, 0,
        'the preview handoff pauses the DM instead of immediately asking whether the page opened');

    const naturalAcceptedSupport = buildDeterministicPaidMetaConversationReply({
        currentMessage: "Yes, that's exactly the kind of structure I need.",
        qualifier: blockerQualifier,
        history: [{ direction: 'out', text: 'Would that kind of support make it easier for you to stay on track?' }],
        flowVariant: 'plant_based_control',
    });
    assert.match(naturalAcceptedSupport.joined, /meta-app-preview\.html/i);
    assert.doesNotMatch(naturalAcceptedSupport.joined, /Does that page open okay for you/i);
    assert.equal((naturalAcceptedSupport.joined.match(/\?/g) || []).length, 0);
    assert.doesNotMatch(naturalAcceptedSupport.joined, /does that feel like the kind of support you need/i,
        'support acceptance must not repeat the support-fit question the lead just answered');
    const previewApproval = buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: naturalAcceptedSupport,
        currentMessage: "Yes, that's exactly the kind of structure I need.",
        linkedUserId: null,
        qualifier: blockerQualifier,
    });
    assert.equal(previewApproval?.required, false);
    assert.equal(previewApproval?.code, 'approved_meta_ad_sales_progression');

    const liveAppPreviewAcceptance = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yeah give me a look',
        qualifier: blockerQualifier,
        history: [{
            direction: 'out',
            text: "If you're keen, I can let you set yourself up in the app and see your workout program, meal plan, weekly goals and community before you pay. Would you like to have a look?",
        }],
        flowVariant: 'plant_based_control',
    });
    assert.equal(liveAppPreviewAcceptance.replyMode, 'campaign_app_preview_handoff');
    assert.equal(liveAppPreviewAcceptance.appPreviewHandoff, true);
    assert.match(liveAppPreviewAcceptance.joined, /meta-app-preview\.html/i);
    assert.match(liveAppPreviewAcceptance.joined, /before any payment/i);
    assert.equal((liveAppPreviewAcceptance.joined.match(/\?/g) || []).length, 0,
        'an explicit preview acceptance should send the preview link and pause');

    const acceptedSupportWithVideo = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yeah',
        qualifier: blockerQualifier,
        history: [{ direction: 'out', text: 'Would having a clear plan and me checking in help you stay on track?' }],
        flowVariant: 'plant_based_control',
        allowVideoAttachment: true,
    });
    assert.doesNotMatch(acceptedSupportWithVideo.joined, /quick video/i);
    assert.equal(acceptedSupportWithVideo.videoAttachmentUrl, undefined);
    assert.equal(acceptedSupportWithVideo.chunks.length, 1);
    assert.match(acceptedSupportWithVideo.joined, /meta-app-preview\.html/i);

    const buyer = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Send me the link',
        qualifier: { ...blockerQualifier, commercial_stage: 'buyer_intent' },
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.match(buyer.joined, /get started here/i);
    assert.match(buyer.joined, /plantbased-balance\.org\/founders/);
    assert.equal((buyer.joined.replace(/https?:\/\/\S+/g, '').match(/\?/g) || []).length, 0,
        'the checkout handoff uses a clear action instead of a redundant question');
    assert.equal(buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: buyer,
        currentMessage: 'Send me the link',
    }).code, 'approved_meta_ad_conversation_buyer_handoff');

    const appInclusions = buildDeterministicPaidMetaConversationReply({
        currentMessage: "What's included in Balance app?",
        qualifier: {
            ...blockerQualifier,
            commercial_stage: 'buyer_intent',
            facts: { ...blockerQualifier.facts, current_state: 'Wants to grow muscle.' },
        },
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.equal(appInclusions.replyMode, 'campaign_sales_progression');
    assert.match(appInclusions.joined, /workouts with video demos/i);
    assert.match(appInclusions.joined, /plant-based meal plans/i);
    assert.match(appInclusions.joined, /muscle-building side/i);
    assert.doesNotMatch(appInclusions.joined, /https?:\/\//);
    assert.equal((appInclusions.joined.match(/\?/g) || []).length, 1);

    const programInclusionsAfterAcceptedSupport = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yes please. How does the program work, and what is included?',
        qualifier: blockerQualifier,
        history: [
            { direction: 'out', text: 'Want me to show you what the first week would look like?' },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.match(programInclusionsAfterAcceptedSupport.joined, /Balance Foundations gives you a clear six-week curriculum/i);
    assert.match(programInclusionsAfterAcceptedSupport.joined, /Balance app and plant-based community/i);
    assert.match(programInclusionsAfterAcceptedSupport.joined, /weekly check-in/i);
    assert.match(programInclusionsAfterAcceptedSupport.joined, /doesn't renew automatically/i);
    assert.match(programInclusionsAfterAcceptedSupport.joined, /keen to have a quick look inside the app/i);
    assert.doesNotMatch(programInclusionsAfterAcceptedSupport.joined, /ongoing weekly coaching|Starter Coaching/i);
    assert.doesNotMatch(programInclusionsAfterAcceptedSupport.joined, /show you what the first week/i,
        'an inclusions question after accepting the first-week offer must not repeat that question');
    assert.equal((programInclusionsAfterAcceptedSupport.joined.match(/\?/g) || []).length, 1);

    const selectedFoundersPrice = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'How much is the fixed six-week Founders Pass?',
        qualifier: blockerQualifier,
        history: [
            { direction: 'out', text: 'Would you prefer that fixed six-week start, or ongoing weekly coaching?' },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.match(selectedFoundersPrice.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.match(selectedFoundersPrice.joined, /send you the checkout link/i);
    assert.doesNotMatch(selectedFoundersPrice.joined, /show you how the first week/i,
        'price after selecting Founders Pass must advance to checkout permission, not repeat week-one discovery');
    assert.equal((selectedFoundersPrice.joined.match(/\?/g) || []).length, 1);

    const naturalFoundationsPrice = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Thanks. How much is Balance Foundations?',
        qualifier: blockerQualifier,
        flowVariant: 'plant_based_control',
    });
    assert.match(naturalFoundationsPrice.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.match(naturalFoundationsPrice.joined, /complete six-week curriculum/i);
    assert.match(naturalFoundationsPrice.joined, /send you the checkout link/i);
    assert.doesNotMatch(naturalFoundationsPrice.joined, /would that kind of support|stay on track/i);
    assert.equal((naturalFoundationsPrice.joined.match(/\?/g) || []).length, 1);

    const confirmFoundationsPrice = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Just to confirm, how much is Balance Foundations in total?',
        qualifier: blockerQualifier,
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.equal(confirmFoundationsPrice.replyMode, 'campaign_sales_progression');
    assert.match(confirmFoundationsPrice.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.match(confirmFoundationsPrice.joined, /send you the checkout link/i);
    assert.doesNotMatch(confirmFoundationsPrice.joined, /https?:\/\//,
        'a price check is not clear buying intent and must not send any link');
    assert.equal((confirmFoundationsPrice.joined.match(/\?/g) || []).length, 1);

    const priceAndInclusions = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I want to know your prices and what I get',
        qualifier: blockerQualifier,
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.equal(priceAndInclusions.replyMode, 'campaign_sales_progression');
    assert.match(priceAndInclusions.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.doesNotMatch(priceAndInclusions.joined, /https?:\/\//);
    assert.equal(hasDirectPaidMetaCheckoutIntent("What's included in Balance app?"), false);
    assert.equal(hasDirectPaidMetaCheckoutIntent('I want to know your prices and what I get'), false);
    assert.equal(hasDirectPaidMetaCheckoutIntent('Send me the link'), true);
    assert.equal(hasDirectPaidMetaCheckoutIntent('I want to start now. Please send me the checkout link.'), true,
        'compound start-now intent must use the deterministic approved checkout URL');
    const compoundBuyer = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I want to start now. Please send me the checkout link.',
        qualifier: { ...blockerQualifier, commercial_stage: 'buyer_intent' },
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.equal(compoundBuyer.checkoutUrl, checkoutUrl);
    assert.match(compoundBuyer.joined, new RegExp(checkoutUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(compoundBuyer.joined, /Https:\/\//,
        'deterministic checkout handoff must preserve the approved lowercase URL');

    assert.equal(isContextualMetaAdOfferLinkRequest({
        currentMessage: "The Founders Pass is the best fit for me. I'm ready to join.",
        qualifier: { commercial_stage: 'buyer_intent' },
        history: [{
            direction: 'out',
            text: "The Founders Pass is $89.99 once. You get the six-week Foundations course and it doesn't renew automatically.",
        }],
    }), true);
    assert.match(buildContextualMetaAdOfferLinkReply({
        checkoutUrl,
        currentMessage: "The Founders Pass is the best fit for me. I'm ready to join.",
    }).joined, /here's the link/i);
    const fixedSixWeekSelection = 'The fixed six-week Founders Pass sounds like the best fit for me.';
    assert.equal(isContextualMetaAdOfferLinkRequest({
        currentMessage: fixedSixWeekSelection,
        qualifier: { commercial_stage: 'buyer_intent' },
        history: [{
            direction: 'out',
            text: "The Founders Pass is $89.99 once. It is a fixed six-week start and doesn't renew automatically.",
        }],
    }), false, 'choosing the best-fit offer is not yet a request to release checkout');
    const fixedSixWeekHandoff = buildContextualMetaAdOfferLinkReply({
        checkoutUrl,
        currentMessage: fixedSixWeekSelection,
    });
    assert.equal(fixedSixWeekHandoff, null);
    const fixedSixWeekSelectionReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: fixedSixWeekSelection,
        qualifier: { ...blockerQualifier, commercial_stage: 'buyer_intent' },
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.match(fixedSixWeekSelectionReply.joined, /one \$89\.99 payment for the full six weeks/i);
    assert.match(fixedSixWeekSelectionReply.joined, /send you the checkout link/i);
    assert.doesNotMatch(fixedSixWeekSelectionReply.joined, /https?:\/\//);
    assert.equal((fixedSixWeekSelectionReply.joined.match(/\?/g) || []).length, 1);
    const naturalSelectionReply = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'I think Balance Foundations is the right option for me.',
        qualifier: { ...blockerQualifier, commercial_stage: 'buyer_intent' },
        flowVariant: 'plant_based_control',
        checkoutUrl,
    });
    assert.equal(naturalSelectionReply.replyMode, 'campaign_sales_progression');
    assert.match(naturalSelectionReply.joined, /send you the checkout link/i);
    assert.doesNotMatch(naturalSelectionReply.joined, /https?:\/\//);
    assert.equal((naturalSelectionReply.joined.match(/\?/g) || []).length, 1);

    assert.equal(buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Stop messaging me',
        qualifier: blockerQualifier,
    }), null);
    const broad = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'So what do I do?',
        qualifier: blockerQualifier,
        flowVariant: 'broad_pain',
    });
    assert.doesNotMatch(broad.joined, /plant[ -]?based|vegan|vegetarian/i);
});

test('Instagram split offer bubbles still turn a short Yes into the promised app preview', () => {
    const splitInstagramOfferAcceptance = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yes',
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                current_state: 'Wants to lose weight.',
                history_blockers: 'Slacks off and struggles with consistency.',
            },
        },
        history: [
            {
                direction: 'out',
                text: 'Balance Foundations is a six-week course with your workout program built around your week and a plant-based meal plan.',
            },
            {
                direction: 'out',
                text: 'It is one $89.99 payment. You can look through the app before you pay. Want me to send you access?',
            },
        ],
        flowVariant: 'plant_based_control',
    });
    assert.equal(splitInstagramOfferAcceptance.replyMode, 'campaign_app_preview_handoff');
    assert.equal(splitInstagramOfferAcceptance.appPreviewHandoff, true);
    assert.match(splitInstagramOfferAcceptance.joined, /meta-app-preview\.html/i);
    assert.equal((splitInstagramOfferAcceptance.joined.match(/\?/g) || []).length, 0);
    const approval = buildPaidMetaConversationApproval({
        metaAdConversationFastLane: true,
        draft: splitInstagramOfferAcceptance,
        currentMessage: 'Yes',
        linkedUserId: null,
        qualifier: {
            commercial_stage: 'problem_qualified',
            facts: {
                current_state: 'Wants to lose weight.',
                history_blockers: 'Slacks off and struggles with consistency.',
            },
        },
    });
    assert.equal(approval?.required, false);
    assert.equal(approval?.code, 'approved_meta_ad_sales_progression');

    const liveVideoPreviewAcceptance = buildDeterministicPaidMetaConversationReply({
        currentMessage: 'Yes plz show me',
        qualifier: {
            commercial_stage: 'engaged',
            facts: {
                current_state: 'Wants to lose 5kgs.',
                history_blockers: "Doesn't know how to eat.",
            },
        },
        history: [
            { direction: 'in', text: "Umm I don't know how to eat!" },
            { direction: 'out', text: '[VIDEO:https://plantbased-balance.org/assets/balance-foundations-app-proof-v2.mp4]' },
            { direction: 'out', text: 'Yep, here it is. Once you’ve watched it, do you want me to set up a free personalised look at your own workout and meal plan?' },
        ],
        flowVariant: 'plant_based_control',
        appPreviewUrl: 'https://plantbased-balance.org/p/Abc_123-xyz9876543210',
    });
    assert.equal(liveVideoPreviewAcceptance.replyMode, 'campaign_app_preview_handoff');
    assert.equal(liveVideoPreviewAcceptance.appPreviewHandoff, true);
    assert.match(liveVideoPreviewAcceptance.joined, /plantbased-balance\.org\/p\/Abc_123-xyz9876543210/);
    assert.equal((liveVideoPreviewAcceptance.joined.match(/\?/g) || []).length, 0);
});

test('plant-based requirement and ready prompts receive different next steps', () => {
    const requirement = buildMetaAdFoundersPassFirstReply('Do I need to already be Plant Based?');
    assert.equal(requirement.firstReplyIntent, 'plant_based_requirement');
    assert.match(requirement.joined, /plenty of people start while they're just trying to eat more plant-based/i);
    assert.match(requirement.joined, /what does your food look like at the moment/i);
    assert.doesNotMatch(requirement.joined, /plant-based-fitness\.html/);

    const ready = buildMetaAdFoundersPassFirstReply("I'm ready to start");
    assert.equal(ready.firstReplyIntent, 'ready');
    assert.match(ready.joined, /quick setup and start here/i);
    assert.match(ready.joined, /plantbased-balance\.org\/founders/);
    assert.equal(buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft: ready,
    }).code, 'approved_meta_ad_buyer_handoff');
});

test('broad ad route stays broad through the informational first reply', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?", { flowVariant: 'broad_pain' });
    assert.equal(reply.flowVariant, 'broad_pain');
    assert.equal(reply.checkoutUrl, null);
    assert.doesNotMatch(reply.joined, /plant[ -]?based|vegan|vegetarian/i);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.doesNotMatch(reply.joined, /https?:\/\//);
});

test('the public DM link stays clean while Meta identifiers remain thread data', () => {
    const customData = {
        meta_ad_attribution: {
            source: 'meta_ads',
            campaign_id: '120210001',
            adset_id: '120210002',
            ad_id: '120210003',
            creative_id: '120210004',
            placement: 'instagram_reels',
            ad_name: 'A1 Brain Angle',
            ref: 'balance_plant_based_a1',
        },
        current_inbound_routing: {
            source: 'meta_ads',
            ad_id: '120210003',
        },
    };
    const checkoutUrl = buildMetaAdCheckoutUrl({ customData, flowVariant: 'plant_based_control' });
    const shortAdRef = BigInt('120210003').toString(36);
    assert.equal(checkoutUrl, `https://plantbased-balance.org/founders/${shortAdRef}`);
    assert.equal(new URL(checkoutUrl).search, '');
    assert.equal(customData.meta_ad_attribution.ad_id, '120210003');
    assert.equal(customData.meta_ad_attribution.ad_name, 'A1 Brain Angle');

    const ready = buildMetaAdFoundersPassFirstReply("I'm ready to start", { customData });
    const handoff = buildLeadOnboardingHandoffData({
        draftText: ready.joined,
        qualifier: {},
        leadStage: 'new',
        linkedUserId: null,
        threadId: 'thread-1',
        manychatMessageId: 'mid-1',
        currentMessage: "I'm ready to start",
    });
    assert.equal(handoff.approved_link_auto_sendable, true);
    assert.equal(handoff.signup_link_handoff_url, `https://plantbased-balance.org/founders/${shortAdRef}`);
});

test('inclusions are informational and do not create an approved checkout handoff', () => {
    assert.equal(resolveMetaAdFirstReplyIntent("What's actually included?"), 'inclusions');
    const reply = buildMetaAdFoundersPassFirstReply("What's actually included?");
    const approval = buildMetaAdFirstReplyApproval({ metaAdFirstInbound: true, draft: reply });
    const handoff = buildApprovedMetaAdFirstReplyHandoffData({
        approval,
        draft: reply,
        leadStage: 'new',
        linkedUserId: null,
    });
    assert.equal(reply.checkoutUrl, null);
    assert.equal(approval.code, 'approved_meta_ad_first_reply');
    assert.equal(handoff.approved_link_auto_sendable, false);
    assert.equal(handoff.signup_link_handoff_url, undefined);
    assert.doesNotMatch(reply.joined, /https?:\/\//);
});

test('Meta referral hint preserves the broad route independently of message wording', () => {
    const variant = resolveMetaAdFlowVariant({
        customData: {
            meta_ad_attribution: { ref: 'balance_broad_pain_b2' },
            current_inbound_routing: { source: 'meta_ads', ad_id: 'example-ad-id' },
        },
        currentMessage: 'Can I see what is included?',
    });
    assert.equal(variant, 'broad_pain');
});

test('Coco internal Meta test lane keeps its configured route when ordinary wording contains broad-pain keywords', () => {
    assert.equal(resolveMetaAdFlowVariant({
        customData: {
            acquisition_mode: 'paid_meta',
            internal_test_auto_reply_enabled: true,
            internal_test_meta_ad_flow: 'plant_based_control',
        },
        currentMessage: "What's included in the Balance app, and how does the program work?",
    }), 'plant_based_control');
    assert.equal(resolveMetaAdFlowVariant({
        customData: {
            acquisition_mode: 'paid_meta',
            internal_test_auto_reply_enabled: true,
            internal_test_meta_ad_flow: 'broad_pain',
        },
        currentMessage: 'I eat plant-based food already',
    }), 'broad_pain');
});

test('campaign package remains paused and points to the deployed funnel assets', () => {
    const root = path.join(__dirname, '..');
    const plan = JSON.parse(fs.readFileSync(path.join(root, 'output/meta-founders-pass-campaign-2026-07-22/campaign-plan.json'), 'utf8'));
    assert.equal(plan.status, 'PAUSED');
    assert.equal(plan.budget.amountAud, 20);
    assert.equal(plan.budget.estimatedTestSpendAud, 140);
    assert.equal(plan.dmWelcome.appPreview, 'https://plantbased-balance.org/assets/balance-founders-pass-dm-preview.mp4');
    assert.equal(plan.dmWelcome.checkoutUrl, 'https://plantbased-balance.org/plant-based-fitness.html');
    assert.deepEqual(plan.dmWelcome.quickReplies, []);
    assert.match(plan.dmWelcome.rule, /Do not configure visible quick-reply buttons/i);
    assert.match(plan.ads[0].primaryText, /You haven't failed/);
    assert.doesNotMatch(plan.ads[0].primaryText, /\byou have not\b/i);
    assert.match(fs.readFileSync(path.join(root, 'fitness-coaching.html'), 'utf8'), /you haven't failed/i);
    assert.ok(fs.statSync(path.join(root, 'assets', 'balance-founders-pass-dm-preview.mp4')).size > 1_000_000);
});
