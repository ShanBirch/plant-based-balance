const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    buildStoryReplyAlertData,
    isInboundStoryReplyMessage,
    routeInboundStoryReplyToBrowser,
    storyReplyReference,
} = require('../netlify/functions/_lib/ig-story-reply-browser-routing');
const metaWebhook = require('../netlify/functions/meta-ig-webhook')._test;
const manager = require('../netlify/functions/client-lead-manager')._test;

const graphMessage = {
    mid: 'ig-mid-story-1',
    reply_to: {
        story: {
            id: 'story-123',
            url: 'https://lookaside.fbsbx.com/story.jpg',
        },
    },
    text: 'this is such a good idea',
};

assert.strictEqual(isInboundStoryReplyMessage({
    direction: 'in',
    message: graphMessage,
}), true);
assert.strictEqual(isInboundStoryReplyMessage({
    direction: 'out',
    message: graphMessage,
}), false);
assert.strictEqual(isInboundStoryReplyMessage({
    direction: 'in',
    message: { text: 'ordinary DM' },
    contextText: '[IG_STORY_REPLY_CONTEXT]\nTheir reply: "nice"',
}), true);
assert.strictEqual(isInboundStoryReplyMessage({
    direction: 'in',
    message: { text: 'ordinary DM' },
}), false);

assert.deepStrictEqual(storyReplyReference({ message: graphMessage }), {
    storyId: 'story-123',
    storyUrl: 'https://lookaside.fbsbx.com/story.jpg',
    contextText: null,
});

const leadAlertData = buildStoryReplyAlertData({
    thread: {
        id: 'thread-1',
        subscriber_id: 'ig_graph:owner:lead',
        ig_username: 'story_lead',
        lead_stage: 'new',
        linked_user_id: null,
        custom_data: {},
    },
    sourceMessageId: 'message-1',
    graphMessageId: 'ig_graph:owner:ig-mid-story-1',
    storyId: 'story-123',
});
assert.strictEqual(leadAlertData.operator_queue, 'browser_dispatcher');
assert.strictEqual(leadAlertData.browser_story_reply_required, true);
assert.strictEqual(leadAlertData.native_story_context_required, true);
assert.strictEqual(leadAlertData.browser_send_allowed, true);
assert.strictEqual(leadAlertData.needs_shannon_approval, false);

const clientAlertData = buildStoryReplyAlertData({
    thread: {
        id: 'thread-client',
        linked_user_id: 'user-1',
        custom_data: {},
    },
    sourceMessageId: 'message-client',
});
assert.strictEqual(clientAlertData.browser_send_allowed, false);
assert.strictEqual(clientAlertData.needs_shannon_approval, true);

assert.strictEqual(metaWebhook.shouldAutoDraftEvent({
    type: 'story_reply',
}, {
    autoDraftStoryReplies: true,
}), false);
assert.strictEqual(metaWebhook.shouldAutoDraftEvent({
    type: 'message',
}, {
    autoDraftMessages: true,
}), true);

assert.strictEqual(manager.shouldAutoScheduleCleanLeadCloudFallback({
    id: 'alert-story',
    status: 'pending',
    alert_type: 'ig_incoming_dm',
    client_id: null,
    suggested_message: 'generic reply',
    data: {
        channel: 'instagram',
        ig_thread_id: 'thread-1',
        browser_story_reply_required: true,
        draft_review: { passed: true, issues: [] },
    },
}, {
    shouldRoute: false,
}), false);

const migration = fs.readFileSync(path.join(
    __dirname,
    '../supabase/migrations/20260728033006_route_story_reply_inbounds_to_browser_dispatcher.sql'
), 'utf8');
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.route_story_reply_inbound_to_browser_dispatcher/i);
assert.match(migration, /owner = 'browser_dispatcher'[\s\S]+action_type = 'reply_inbound'/i);
assert.match(migration, /browser_send_allowed', NOT v_linked_client/i);
assert.match(migration, /v_action\.status IN \('needs_you', 'blocked'\)/i);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.route_story_reply_inbound_to_browser_dispatcher[\s\S]+FROM PUBLIC, anon, authenticated/i);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.route_story_reply_inbound_to_browser_dispatcher[\s\S]+TO service_role/i);

(async () => {
    const calls = [];
    const routeResult = await routeInboundStoryReplyToBrowser({
        thread: {
            id: 'thread-1',
            coach_id: 'coach-1',
            subscriber_id: 'ig_graph:owner:lead',
            ig_username: 'story_lead',
            profile_name: 'Story Lead',
            lead_stage: 'new',
            linked_user_id: null,
            custom_data: {},
        },
        messageText: '[IG_STORY_REPLY_CONTEXT]\nTheir reply: "this is such a good idea"',
        sourceMessageId: 'message-1',
        graphMessageId: 'ig_graph:owner:ig-mid-story-1',
        storyId: 'story-123',
        storyUrl: 'https://lookaside.fbsbx.com/story.jpg',
        storyContext: 'Story summary: a low-pressure way to handle a rough week',
        createAlert: async (payload, idempotencyKey) => {
            calls.push({ kind: 'alert', payload, idempotencyKey });
            return { alertId: 'alert-1', deduped: false };
        },
        query: async (path, options) => {
            calls.push({ kind: 'query', path, options });
            if (path.startsWith('coach_alerts?select=')) {
                return [{
                    id: 'alert-1',
                    status: 'pending',
                    data: { existing_marker: true },
                }];
            }
            if (path.startsWith('coach_alerts?id=')) return [];
            return {
                outcome: 'browser_dispatch_queued',
                action_id: 'action-1',
            };
        },
    });

    assert.strictEqual(routeResult.routed, true);
    assert.strictEqual(routeResult.alertId, 'alert-1');
    assert.strictEqual(routeResult.actionId, 'action-1');
    assert.strictEqual(calls[0].idempotencyKey, 'ig_incoming_story_reply:message-1');
    assert.strictEqual(calls[0].payload.suggested_message, null);
    const routeCall = calls.find(call => call.path === 'rpc/route_story_reply_inbound_to_browser_dispatcher');
    const alertPatch = calls.find(call => call.path?.startsWith('coach_alerts?id='));
    assert.strictEqual(alertPatch.options.body.suggested_message, null);
    assert.strictEqual(alertPatch.options.body.data.existing_marker, true);
    assert.strictEqual(routeCall.options.body.p_source_message_id, 'message-1');

    console.log('ig story reply browser routing tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
