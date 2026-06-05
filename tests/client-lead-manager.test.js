const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clientContext = require('../netlify/functions/_lib/client-context');
const manager = require('../netlify/functions/client-lead-manager')._test;

function makeAlert(overrides = {}) {
    return {
        id: 'alert-1',
        status: 'pending',
        alert_type: 'ig_incoming_dm',
        client_id: null,
        client_name: 'Lead',
        description: '"hey"',
        suggested_message: 'hey, how are you going?',
        data: {
            channel: 'instagram',
            message_preview: 'hey',
        },
        ...overrides,
        data: {
            channel: 'instagram',
            message_preview: 'hey',
            ...(overrides.data || {}),
        },
    };
}

assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Shane' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Fra' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'francesca_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Miranda' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'miranda_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Monica' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'monica_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Frank' }), false);

const shane = manager.classifyNeedsYou(makeAlert({ client_name: 'Shane' }));
assert.strictEqual(shane.shouldRoute, true);
assert.ok(shane.reasons.includes('always_needs_you_person'));
assert.match(shane.label, /Miranda/);
assert.match(shane.label, /Monica/);

const miranda = manager.classifyNeedsYou(makeAlert({ client_name: 'Miranda' }));
assert.strictEqual(miranda.shouldRoute, true);
assert.ok(miranda.reasons.includes('always_needs_you_person'));

const monica = manager.classifyNeedsYou(makeAlert({ client_name: 'Monica' }));
assert.strictEqual(monica.shouldRoute, true);
assert.ok(monica.reasons.includes('always_needs_you_person'));

const media = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[PHOTO:https://example.com/photo.jpg]',
        image_url_count: 1,
    },
}));
assert.strictEqual(media.shouldRoute, true);
assert.ok(media.reasons.includes('media_review_required'));

const aiSuspicion = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'is this AI?',
    },
}));
assert.strictEqual(aiSuspicion.shouldRoute, true);
assert.ok(aiSuspicion.reasons.includes('ai_suspicion_or_authenticity_question'));

const contextLoss = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry i dont understand what you mean',
        draft_review: {
            context_loss_suspected: true,
        },
    },
}));
assert.strictEqual(contextLoss.shouldRoute, true);
assert.ok(contextLoss.reasons.includes('client_does_not_understand_context'));
assert.ok(contextLoss.reasons.includes('draft_review_context_loss'));

const nonSequiturReview = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'yeah just the link would be good',
        draft_review: {
            verdict: 'warn',
            confidence: 0.64,
            summary: 'Draft slows down instead of answering the latest link request.',
            notification_reason: 'ignored_latest_message',
            context_loss_suspected: false,
        },
    },
}));
assert.strictEqual(nonSequiturReview.shouldRoute, true);
assert.ok(nonSequiturReview.reasons.includes('draft_review_manual_check'));

const passReview = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'thanks mate, that sounds good',
        last_outbound_message: 'sweet, start with the simple version today',
        draft_review: {
            verdict: 'pass',
            confidence: 0.9,
            summary: 'Draft matches the available context.',
            notification_reason: 'none',
            context_loss_suspected: false,
        },
    },
}));
assert.strictEqual(passReview.shouldRoute, false);

const normal = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'thanks mate, that sounds good',
        last_outbound_message: 'sweet, start with the simple version today',
    },
}));
assert.strictEqual(normal.shouldRoute, false);

const reviewContext = manager.buildDraftReviewContextBlocks(makeAlert({
    suggested_message: 'nice, want me to send the link?',
    data: {
        message_preview: 'yeah send me the link',
        draft_evidence: {
            current_message: 'yeah send me the link',
            prior_unanswered: [{ text: 'how do i start?' }],
            recent_timeline: 'Lead: how do i start?\nShannon: i can send the link',
            learning_reel_context: 'Most recent sent reel: Plant-based cooking: "The BEST cucumber salad" by Pick Up Limes.',
        },
    },
}));
assert.ok(reviewContext.includes('Just-arrived message from Lead'));
assert.ok(reviewContext.includes('Prior unanswered messages'));
assert.ok(reviewContext.includes('Recent sent learning reel context'));
assert.strictEqual(manager.shouldRunDraftReview(makeAlert({
    suggested_message: 'hey',
    data: { message_preview: 'hey' },
})), true);
assert.strictEqual(manager.shouldRunDraftReview(makeAlert({
    suggested_message: 'hey',
    data: { draft_review: { verdict: 'pass', reviewed_at: '2026-06-02T00:00:00.000Z' } },
})), false);

const stamped = manager.buildNeedsYouData(makeAlert({ client_name: 'Fra' }), shane);
assert.strictEqual(stamped.operator_queue, 'needs_you');
assert.strictEqual(stamped.needs_you_required, true);
assert.strictEqual(stamped.codex_review.source, 'balance-lead-client-manager');
assert.strictEqual(stamped.codex_review.queue, 'needs_you');

const instantDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/instant-coach-draft.js'), 'utf8');
assert.ok(
    instantDraftSource.includes('!permanentNeedsYouClient && !mediaReview.required'),
    'in-app client DM auto-send should be blocked for permanent Needs You clients'
);

const igDraftSource = fs.readFileSync(path.join(__dirname, '../netlify/functions/ig-instant-draft.js'), 'utf8');
assert.ok(
    igDraftSource.includes("code: 'always_needs_you_person'") && igDraftSource.includes("label: 'permanent Needs You client'"),
    'IG auto-send should be held for permanent Needs You clients'
);

console.log('client-lead-manager tests passed');
