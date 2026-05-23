const assert = require('assert');

const instantDraft = require('../netlify/functions/ig-instant-draft')._test;
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

console.log('cocos auto-send soft-context tests passed');
