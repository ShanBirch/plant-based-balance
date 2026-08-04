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
    buildApprovedDeterministicMetaAdFirstReplyReview,
    ensureMetaAdSalesProgressionQuestion,
    buildDeterministicPaidMetaConversationReply,
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
    resolveInternalTestConversationResetAt,
    buildInternalTestQualifierThread,
} = require('../netlify/functions/ig-instant-draft')._test;
const {
    buildInstagramGraphVideoMessagePayload,
    buildInstagramGraphImageMessagePayload,
} = require('../netlify/functions/send-ig-reply')._test;
const { inspectVoiceScriptQuality } = require('../netlify/functions/_lib/elevenlabs-voice-message');

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
    assert.match(draft.joined, /what's the main thing you're trying to change with your fitness right now/i);
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

test('paid Meta blocker quotes the six-week payment and app access follows positive intent', () => {
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
    assert.match(blockerReply.joined, /access to the app.*before any payment/i);
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
    assert.equal((previewReply.joined.match(/\?/g) || []).length, 1);
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
    assert.match(previewHandoff.signup_link_handoff_url, /meta-app-preview\.html$/);

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
    assert.match(voiceReply.joined, /^Hey, how are ya\.\n\nYeah, so that makes total sense/i);
    assert.doesNotMatch(voiceReply.joined, /how are you going/i);
    assert.match(voiceReply.joined, /work and the kids can wreck the best intentions/i);
    assert.match(voiceReply.joined, /losing 10 kilos and feeling fitter/i);
    assert.match(voiceReply.joined, /one eighty-nine ninety-nine payment for the full six weeks/i);
    assert.match(voiceReply.joined, /set yourself up in the app.*your program, your meal plan, and the community/is);
    assert.match(voiceReply.joined, /once you've seen it, we can take payment\. How does that sound\?/i);
    assert.match(voiceReply.joined, /Ummmm\.\.\./i);
    assert.match(voiceReply.joined, /ya know/i);
    assert.doesNotMatch(voiceReply.joined, /https?:\/\//);
    assert.equal(voiceReply.voiceCompanionText, '');
    assert.equal((voiceReply.joined.match(/\?/g) || []).length, 1);
    assert.deepStrictEqual(voiceReply.voiceThoughtPausesMs, [1900, 1500, 1450, 1350, 1550, 1600, 1500]);
    assert.equal(inspectVoiceScriptQuality(voiceReply.joined).valid, true);

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
        },
    };
    const isolated = buildInternalTestQualifierThread(thread);
    assert.equal(isolated.qualifier, null);
    assert.equal(isolated.custom_data.relationship_memory_compaction, undefined);
    assert.equal(thread.qualifier.stage, 'won');
    assert.match(thread.custom_data.relationship_memory_compaction.summary, /older test episode/i);
});

test('paid Meta voice progression reflects different real blocker categories', () => {
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
        assert.match(reply.joined, /one eighty-nine ninety-nine payment for the full six weeks/i);
        assert.equal(reply.voiceCompanionText, '');
        assert.equal((reply.joined.match(/\?/g) || []).length, 1);
    }
});

test('paid Meta question-fatigue reply apologises and leaves space without another question', () => {
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
    assert.equal(getMetaAdSensitiveHoldReason({ alertData: metaAlert, currentMessage: 'I am pregnant and injured' }).code, 'safety_or_medical');
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
    assert.match(reply.joined, /Balance Foundations is a six-week curriculum inside the app/i);
    assert.match(reply.joined, /training, plant-based food support and the community/i);
    assert.match(reply.joined, /main thing you're trying to change/i);
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

        assert.equal(reply.joined, 'Yeah, I do. Balance Foundations gives you a clear six-week curriculum inside the app, plus a weekly check-in where I review and adjust your training and food. What are you mainly trying to change at the moment?');
        assert.doesNotMatch(reply.joined, /Starter Coaching|\$29\.99/i);
        assert.equal(reply.checkoutUrl, null);
        assert.equal(reply.videoAttachmentUrl, undefined);
        assert.equal(approval.code, 'approved_meta_ad_first_reply');
        assert.equal(handoff.approved_link_auto_sendable, false);
        assert.equal(handoff.signup_link_handoff_url, undefined);
        assert.equal(isMetaAdGoalReplyTurn([{ direction: 'out', text: reply.joined }]), true);
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
    assert.match(reply.joined, /main thing you're trying to change/i);
    assert.doesNotMatch(reply.joined, /plant-based-fitness\.html/);
    assert.doesNotMatch(reply.joined, /vegan fitness community/i);
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
    assert.equal(appliedWeightGoal.model, 'deterministic_meta_ad_goal_proof_v1');
    assert.match(appliedWeightGoal.joined, /10kg is a solid goal/i);
    assert.match(appliedWeightGoal.imageAttachmentUrl, /ally-cocos\.png/);
    assert.equal(appliedWeightGoal.timeline, 'preserved live timeline');
    const guardedWeightGoal = ensureMetaAdSalesProgressionQuestion({
        draft: weightGoal,
        currentMessage: 'I need to lose weight, probably 15kgs',
        qualifier: { commercial_stage: 'engaged', facts: { current_state: 'Wants to lose 15kg.' } },
        leadStage: 'qualifying',
    });
    assert.match(guardedWeightGoal.model, /\+meta_ad_sales_question_v1$/);
    assert.equal(guardedWeightGoal.chunks.length, 2,
        'the proof image must sit between the client result and the next question');
    assert.match(guardedWeightGoal.chunks[1], /what tends to fall apart first/i);
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

test('paid Meta conversation stages stay deterministic, purposeful, and immediately reviewable', () => {
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
    assert.match(personalisedVoiceReply.joined, /Balance Foundations gives you a clear six-week curriculum inside the app/i);
    assert.match(personalisedVoiceReply.joined, /review and adjust your training and food/i);
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
    assert.deepEqual(blockerVoiceReply.voiceThoughtPausesMs, [1900, 1500, 1450, 1350, 1550, 1600, 1500]);
    assert.equal(blockerVoiceReply.joined.split(/\n\s*\n/).length, 8);
    assert.match(blockerVoiceReply.joined, /^Hey, how are ya\.\n\n/);
    assert.doesNotMatch(blockerVoiceReply.joined, /how are you going/i);
    assert.match(blockerVoiceReply.joined, /Ummmm\.\.\./);
    assert.match(blockerVoiceReply.joined, /losing 8 kilos/i);
    assert.match(blockerVoiceReply.joined, /It's, it's about giving you a clear plan/i);
    assert.match(blockerVoiceReply.joined, /ya know/i);
    assert.match(blockerVoiceReply.joined, /your program, your meal plan, and the community/i);
    assert.match(blockerVoiceReply.joined, /once you've seen it, we can take payment\. How does that sound\?/i);
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
    assert.deepEqual(changingShiftBlocker.voiceThoughtPausesMs, [1900, 1500, 1450, 1350, 1550, 1600, 1500]);
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
    assert.equal((acceptedSupport.joined.match(/\?/g) || []).length, 1);

    const naturalAcceptedSupport = buildDeterministicPaidMetaConversationReply({
        currentMessage: "Yes, that's exactly the kind of structure I need.",
        qualifier: blockerQualifier,
        history: [{ direction: 'out', text: 'Would that kind of support make it easier for you to stay on track?' }],
        flowVariant: 'plant_based_control',
    });
    assert.match(naturalAcceptedSupport.joined, /meta-app-preview\.html/i);
    assert.match(naturalAcceptedSupport.joined, /Does that page open okay for you/i);
    assert.equal((naturalAcceptedSupport.joined.match(/\?/g) || []).length, 1);
    assert.doesNotMatch(naturalAcceptedSupport.joined, /does that feel like the kind of support you need/i,
        'support acceptance must not repeat the support-fit question the lead just answered');

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
    }), true);
    const fixedSixWeekHandoff = buildContextualMetaAdOfferLinkReply({
        checkoutUrl,
        currentMessage: fixedSixWeekSelection,
    });
    assert.match(fixedSixWeekHandoff.joined, /here's the link/i);
    assert.match(fixedSixWeekHandoff.joined, new RegExp(checkoutUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

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
