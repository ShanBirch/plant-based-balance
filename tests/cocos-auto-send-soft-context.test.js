const assert = require('assert');

const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
const clientContext = require('../netlify/functions/_lib/client-context');
const scheduledWorker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

const softContextReview = {
    required: true,
    reasons: [
        'first_captured_reply_with_hidden_context',
        'reference_heavy_reply_without_tracked_context',
        'draft_review_timeout',
    ],
    latest_text: 'Yooo',
};
const timeoutReview = {
    verdict: 'warn',
    confidence: 0,
    summary: 'AI draft review did not finish before auto-send scheduling.',
    issues: ['review_timeout'],
    notification_required: true,
    notification_reason: 'review_timeout',
    context_loss_suspected: false,
};
const harmlessDraft = {
    joined: 'afternoon! yooo back at you! what are you up to today?',
};

const bypass = instantDraft.getCocosAutoContextBypass({
    cocosAutoSendLane: true,
    contextReview: softContextReview,
    draft: harmlessDraft,
    draftReview: timeoutReview,
    currentMessage: 'Yooo',
});

assert.ok(bypass?.allowed, 'Cocos should bypass a soft first-text context timeout');
assert.strictEqual(
    instantDraft.getAutoDmHoldReason({
        mediaReview: { required: false },
        contextReview: softContextReview,
        onboardingPhase: { inOnboarding: false },
        draft: harmlessDraft,
        draftReview: timeoutReview,
        challengeOfferWarning: { required: false },
        currentMessage: 'Yooo',
        qualifier: {},
        leadStage: 'new',
        linkedUserId: null,
        cocosContextBypass: bypass,
    }),
    null
);

assert.strictEqual(
    instantDraft.getCocosAutoContextBypass({
        cocosAutoSendLane: true,
        contextReview: softContextReview,
        draft: { joined: 'sweet, here is the challenge link' },
        draftReview: timeoutReview,
        currentMessage: 'Yooo',
    }),
    null,
    'challenge/link language must not bypass review'
);

const trackedSmallTalkBypass = instantDraft.getCocosAutoContextBypass({
    cocosAutoSendLane: true,
    contextReview: {
        required: true,
        reasons: ['draft_review_timeout'],
        latest_text: "Bro I'm just chilling wby?",
        context_dependent: false,
        tracked_outbound_context: true,
    },
    draft: { joined: 'nice one bro, chilling is good\nnot too bad here, coffee and computer chaos mostly' },
    draftReview: timeoutReview,
    currentMessage: "Bro I'm just chilling wby?",
});

assert.strictEqual(
    trackedSmallTalkBypass?.reason,
    'soft_tracked_small_talk',
    'Cocos should bypass review-timeout-only holds once outbound context is tracked'
);

assert.deepStrictEqual(
    scheduledWorker.buildAutoSendReviewHold({
        alert_type: 'ig_incoming_dm',
        data: {
            channel: 'instagram',
            scheduled_via: 'auto_send',
            bot_account: 'cocos_pt_studio',
            auto_send_default_reason: 'cocos_auto_lane',
            context_review: softContextReview,
            draft_review: timeoutReview,
            auto_send_context_bypass: bypass,
        },
    }),
    null,
    'scheduled worker should honor the Cocos soft context bypass'
);

assert.deepStrictEqual(
    scheduledWorker.buildAutoSendReviewHold({
        alert_type: 'ig_incoming_dm',
        data: {
            channel: 'instagram',
            scheduled_via: 'auto_send',
            bot_account: 'cocos_pt_studio',
            auto_send_default_reason: 'cocos_auto_lane',
            context_review: {
                required: true,
                reasons: ['draft_review_timeout'],
            },
            draft_review: timeoutReview,
            auto_send_context_bypass: trackedSmallTalkBypass,
        },
    }),
    null,
    'scheduled worker should honor tracked small-talk review-timeout bypass'
);

const latePassingReview = {
    verdict: 'pass',
    confidence: 1,
    notification_required: false,
    notification_reason: 'none',
    context_loss_suspected: false,
};
const lateReviewClearedData = clientContext.mergeLateDraftReviewData({
    auto_send_review_hold: {
        code: 'context_review',
        label: 'tracked DM context may be incomplete',
    },
    context_review: {
        required: true,
        reasons: ['draft_review_timeout'],
    },
    media_review: null,
}, latePassingReview, {
    required: false,
    reasons: [],
    label: '',
});
assert.strictEqual(
    lateReviewClearedData.auto_send_review_hold,
    null,
    'late passing draft review should clear stale context auto-send holds'
);
assert.strictEqual(lateReviewClearedData.context_review, null);
assert.strictEqual(lateReviewClearedData.auto_send_review_hold_cleared_reason, 'late_draft_review_passed');

const lateReviewStillHeldData = clientContext.mergeLateDraftReviewData({
    auto_send_review_hold: {
        code: 'context_review',
        label: 'tracked DM context may be incomplete',
    },
    media_review: {
        required: true,
        label: 'video',
    },
}, latePassingReview, {
    required: false,
    reasons: [],
    label: '',
});
assert.strictEqual(
    lateReviewStillHeldData.auto_send_review_hold?.code,
    'context_review',
    'late review must not clear context holds when media still needs Shannon'
);

const blockedHold = scheduledWorker.buildAutoSendReviewHold({
        alert_type: 'ig_incoming_dm',
        data: {
            channel: 'instagram',
            scheduled_via: 'auto_send',
            bot_account: 'cocos_pt_studio',
            context_review: softContextReview,
            draft_review: {
                ...timeoutReview,
                verdict: 'block',
                notification_required: true,
            },
            auto_send_context_bypass: bypass,
        },
    });
assert.ok(blockedHold, 'blocked draft reviews still stop auto-send');

const repairIssues = instantDraft.collectCocosAutoRepairIssues({
    draft: { joined: 'what does a normal day look like for you?' },
    draftReview: {
        verdict: 'warn',
        confidence: 0.6,
        summary: 'Usable but too generic for the latest message.',
        issues: ['asks a stock discovery question'],
        suggested_fix: 'Reply to the latest detail directly.',
        notification_required: true,
        notification_reason: 'lead_quality',
        context_loss_suspected: false,
    },
    challengeOfferWarning: null,
    currentMessage: 'haha yeah it was a big weekend',
    qualifier: {},
    leadStage: 'new',
    linkedUserId: null,
});

assert.ok(repairIssues.some(issue => /Reviewer summary/.test(issue)), 'review issues should feed the Coco repair prompt');
assert.ok(repairIssues.some(issue => /stock discovery/i.test(issue)), 'stock questions should feed the Coco repair prompt');
assert.strictEqual(
    instantDraft.shouldAttemptCocosDraftRepair({
        cocosAutoSendLane: true,
        mediaReview: { required: false },
        baseContextReview: { required: false },
        draft: { joined: 'what does a normal day look like for you?' },
        repairIssues,
    }),
    true,
    'Coco auto lane should repair review-caught but repairable drafts before holding'
);
assert.strictEqual(
    instantDraft.shouldAttemptCocosDraftRepair({
        cocosAutoSendLane: true,
        mediaReview: { required: true },
        baseContextReview: { required: false },
        draft: { joined: 'what does a normal day look like for you?' },
        repairIssues,
    }),
    false,
    'media review still needs Shannon instead of automatic repair'
);
assert.strictEqual(
    instantDraft.reviewLooksLikePureContextGap({
        verdict: 'block',
        summary: 'tracked DM context may be incomplete',
        notification_reason: 'context_loss',
        context_loss_suspected: false,
    }),
    true,
    'missing source context should not be treated as an auto-repair problem'
);

console.log('cocos auto-send soft-context tests passed');
