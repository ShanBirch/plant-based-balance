const {
    insertCoachAlert,
    supabaseQuery: defaultSupabaseQuery,
} = require('./client-context');
const { extractStoryReplyText } = require('./meta-ig-context');

const ROUTED_OUTCOMES = new Set([
    'browser_dispatch_queued',
    'browser_dispatch_already_active',
]);

function cleanText(value = '', maxLength = 2000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isInboundStoryReplyMessage({ direction = '', message = {}, contextText = '' } = {}) {
    if (String(direction || '').toLowerCase() !== 'in') return false;
    const story = message?.reply_to?.story;
    return !!(
        (story && typeof story === 'object' && (story.id || story.url || story.media_url))
        || /\[IG_STORY_REPLY_CONTEXT\]/i.test(String(contextText || ''))
    );
}

function storyReplyReference({ message = {}, contextText = '' } = {}) {
    const story = message?.reply_to?.story && typeof message.reply_to.story === 'object'
        ? message.reply_to.story
        : {};
    return {
        storyId: cleanText(story.id, 180) || null,
        storyUrl: cleanText(story.url || story.media_url, 1200) || null,
        contextText: String(contextText || '').trim().slice(0, 6000) || null,
    };
}

function buildStoryReplyAlertData({
    thread = {},
    sourceMessageId = null,
    graphMessageId = null,
    storyId = null,
    storyUrl = null,
    storyContext = null,
} = {}) {
    const graph = thread.custom_data?.instagram_graph && typeof thread.custom_data.instagram_graph === 'object'
        ? thread.custom_data.instagram_graph
        : {};
    const linkedClient = !!thread.linked_user_id;
    return {
        channel: 'instagram',
        delivery_channel: 'instagram_native_inbox',
        subscriber_id: thread.subscriber_id || null,
        ig_thread_id: thread.id || null,
        ig_username: thread.ig_username || null,
        profile_name: thread.profile_name || null,
        lead_stage: thread.lead_stage || 'new',
        linked_user_id: thread.linked_user_id || null,
        manychat_message_id: graphMessageId || null,
        source_message_id: sourceMessageId || null,
        operator_queue: 'browser_dispatcher',
        browser_story_reply_required: true,
        browser_dispatch_required: true,
        browser_dispatch_reason: 'inbound_story_reply_native_context',
        browser_send_allowed: !linkedClient,
        needs_shannon_approval: linkedClient,
        native_story_context_required: true,
        story_id: storyId || null,
        story_url: storyUrl || null,
        story_context: storyContext || null,
        draft_messages: [],
        draft_text: '',
        draft_model: 'browser_native_context',
        draft_error: null,
        ig_graph_recipient_id: graph.ig_graph_user_id || null,
        ig_graph_account_id: graph.ig_account_id || graph.account_id || graph.owner_id || null,
        instagram_graph: Object.keys(graph).length ? graph : null,
        alert_shell_created_at: new Date().toISOString(),
        alert_shell_source: 'instagram_story_reply_browser_route',
    };
}

async function routeInboundStoryReplyToBrowser({
    thread,
    messageText = '',
    sourceMessageId,
    graphMessageId = null,
    storyId = null,
    storyUrl = null,
    storyContext = null,
    query = defaultSupabaseQuery,
    createAlert = insertCoachAlert,
} = {}) {
    if (!thread?.id || !sourceMessageId) {
        throw new Error('Story reply browser routing requires a thread and source message');
    }

    const leadName = cleanText(thread.profile_name || thread.ig_username || 'Instagram lead', 160);
    const replyText = extractStoryReplyText(messageText) || cleanText(messageText, 400);
    const alertData = buildStoryReplyAlertData({
        thread,
        sourceMessageId,
        graphMessageId,
        storyId,
        storyUrl,
        storyContext,
    });
    const alert = await createAlert({
        client_id: thread.linked_user_id || null,
        client_name: leadName,
        coach_id: thread.coach_id || null,
        alert_type: 'ig_incoming_dm',
        priority: 'high',
        title: `${leadName} replied to your Instagram Story`,
        description: `"${cleanText(replyText || 'Story reply', 200)}"`,
        suggested_message: null,
        status: 'pending',
        data: alertData,
    }, `ig_incoming_story_reply:${sourceMessageId}`);

    const alertId = alert?.alertId || alert?.id || alert?.[0]?.id || null;
    let liveAlertData = alertData;
    if (alertId) {
        const currentAlerts = await query(
            `coach_alerts?select=id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        const currentAlert = Array.isArray(currentAlerts) ? currentAlerts[0] : null;
        liveAlertData = {
            ...(currentAlert?.data && typeof currentAlert.data === 'object' ? currentAlert.data : {}),
            ...alertData,
        };
        if (['pending', 'scheduled'].includes(String(currentAlert?.status || 'pending'))) {
            await query(
                `coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=in.(pending,scheduled)`,
                {
                    method: 'PATCH',
                    body: {
                        status: 'pending',
                        suggested_message: null,
                        scheduled_for: null,
                        scheduled_reply_text: null,
                        scheduled_at: null,
                        data: liveAlertData,
                    },
                    prefer: 'return=minimal',
                }
            );
        }
    }
    const routed = await query('rpc/route_story_reply_inbound_to_browser_dispatcher', {
        method: 'POST',
        body: {
            p_thread_id: thread.id,
            p_source_message_id: sourceMessageId,
            p_source_alert_id: alertId,
            p_story_id: storyId,
            p_story_url: storyUrl,
            p_story_context: storyContext,
        },
    });
    const routeResult = Array.isArray(routed) ? routed[0] : routed;
    const outcome = String(routeResult?.outcome || '');

    if (alertId && !ROUTED_OUTCOMES.has(outcome)) {
        const holdPreserved = /hold|manual|suppression|needs_you|blocked/i.test(outcome);
        await query(`coach_alerts?id=eq.${encodeURIComponent(alertId)}&status=eq.pending`, {
            method: 'PATCH',
            body: {
                data: {
                    ...liveAlertData,
                    operator_queue: holdPreserved ? 'needs_you' : 'browser_dispatcher',
                    browser_dispatch_route_outcome: outcome || 'route_failed',
                    browser_dispatch_required: !holdPreserved,
                    needs_shannon_approval: holdPreserved || liveAlertData.needs_shannon_approval,
                },
            },
            prefer: 'return=minimal',
        });
    }

    return {
        alertId,
        routed: ROUTED_OUTCOMES.has(outcome),
        outcome: outcome || 'route_failed',
        actionId: routeResult?.action_id || null,
        routeResult: routeResult || null,
    };
}

module.exports = {
    ROUTED_OUTCOMES,
    buildStoryReplyAlertData,
    isInboundStoryReplyMessage,
    routeInboundStoryReplyToBrowser,
    storyReplyReference,
};
