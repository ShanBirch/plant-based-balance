const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    buildMetaAdCheckoutUrl,
    buildMetaAdFoundersPassFirstReply,
    buildMetaAdGoalProofReply,
    isMetaAdGoalReplyTurn,
    buildMetaAdFirstReplyApproval,
    buildApprovedMetaAdFirstReplyHandoffData,
    buildApprovedDeterministicMetaAdFirstReplyReview,
    filterMetaAdCardAttachmentHistory,
    buildLeadOnboardingHandoffData,
    resolveMetaAdFirstReplyIntent,
    resolveMetaAdFlowVariant,
    shouldUseDeterministicMetaAdFirstReply,
    getMetaAdSensitiveHoldReason,
    hasImmediateMetaDispatchFailure,
} = require('../netlify/functions/ig-instant-draft')._test;
const { buildInstagramGraphVideoMessagePayload } = require('../netlify/functions/send-ig-reply')._test;

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

test('deterministic first reply is narrow and leaves sensitive, opt-out, and unrelated ad messages to normal review', () => {
    for (const message of [
        'What is the Founders Pass?',
        "What's actually included?",
        'Do I need to already be Plant Based?',
        "I'm In - save me a spot!",
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
    assert.match(readyHandoff.signup_link_handoff_url, /plant-based-fitness\.html/);
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
    assert.equal(reply.model, 'deterministic_meta_ad_founders_pass_v3');
    assert.equal(reply.firstReplyIntent, 'inclusions');
    assert.equal(reply.chunks.length, 1);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.joined, /AU\$99 once/);
    assert.match(reply.joined, /six weeks of one-to-one in-app support with me for questions, direction and accountability/i);
    assert.match(reply.joined, /lifetime access to the core app and plant-based community/i);
    assert.match(reply.joined, /weekly plan reviews and adjustments are separate/i);
    assert.match(reply.joined, /plant-based-fitness\.html/);
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

test('the reply after the goal is tailored and carries a native video attachment', () => {
    const history = [{
        direction: 'out',
        text: "Hey, yeah of course. Before I send you a heap of generic info, what's the main thing you're trying to change with your fitness right now?",
    }];
    assert.equal(isMetaAdGoalReplyTurn(history), true);
    assert.equal(isMetaAdGoalReplyTurn([{ direction: 'out', text: 'How was your week?' }]), false);

    const consistency = buildMetaAdGoalProofReply('I need accountability because I always fall off');
    assert.match(consistency.joined, /keeping the week on track once life gets busy/i);
    assert.match(consistency.joined, /here's a quick video showing you how it works inside Balance/i);
    assert.doesNotMatch(consistency.joined, /\b\d+[- ]second\b/i);
    assert.match(consistency.videoAttachmentUrl, /balance-founders-pass-dm-preview\.mp4/);
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
});

test('plant-based requirement and ready prompts receive different next steps', () => {
    const requirement = buildMetaAdFoundersPassFirstReply('Do I need to already be Plant Based?');
    assert.equal(requirement.firstReplyIntent, 'plant_based_requirement');
    assert.match(requirement.joined, /don't need to already be fully plant-based/i);
    assert.doesNotMatch(requirement.joined, /plant-based-fitness\.html/);

    const ready = buildMetaAdFoundersPassFirstReply("I'm ready to start");
    assert.equal(ready.firstReplyIntent, 'ready');
    assert.match(ready.joined, /quick setup and start here/i);
    assert.match(ready.joined, /plant-based-fitness\.html/);
    assert.equal(buildMetaAdFirstReplyApproval({
        metaAdFirstInbound: true,
        draft: ready,
    }).code, 'approved_meta_ad_buyer_handoff');
});

test('broad ad route stays broad through the first DM and link handoff', () => {
    const reply = buildMetaAdFoundersPassFirstReply("What's included?", { flowVariant: 'broad_pain' });
    assert.equal(reply.flowVariant, 'broad_pain');
    assert.doesNotMatch(reply.joined, /plant[ -]?based|vegan|vegetarian/i);
    assert.doesNotMatch(reply.joined, /balance-founders-pass-dm-preview\.mp4/);
    assert.match(reply.joined, /future-balance\.netlify\.app\/fitness-coaching\.html/);
});

test('stored Meta identifiers survive the DM link and approved handoff gate', () => {
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
    const parsed = new URL(checkoutUrl);
    assert.equal(parsed.searchParams.get('campaign_id'), '120210001');
    assert.equal(parsed.searchParams.get('adset_id'), '120210002');
    assert.equal(parsed.searchParams.get('ad_id'), '120210003');
    assert.equal(parsed.searchParams.get('creative_id'), '120210004');
    assert.equal(parsed.searchParams.get('placement'), 'instagram_reels');
    assert.equal(parsed.searchParams.get('meta_ad_name'), 'A1 Brain Angle');
    assert.equal(parsed.searchParams.get('meta_ref'), 'balance_plant_based_a1');

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
    assert.match(handoff.signup_link_handoff_url, /ad_id=120210003/);
});

test('details count as buyer intent for the approved attributed link', () => {
    assert.equal(resolveMetaAdFirstReplyIntent("What's actually included?"), 'inclusions');
    const reply = buildMetaAdFoundersPassFirstReply("What's actually included?");
    const handoff = buildLeadOnboardingHandoffData({
        draftText: reply.joined,
        qualifier: {},
        leadStage: 'new',
        linkedUserId: null,
        currentMessage: "What's actually included?",
    });
    assert.equal(handoff.approved_link_auto_sendable, true);
    assert.equal(handoff.client_manager_review_required, undefined);
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
