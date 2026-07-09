const assert = require('assert');

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const alert = {
    id: 'alert-1',
    alert_type: 'general_idea',
    client_id: null,
    client_name: 'Tahlia Brooks',
    coach_id: '00a6605e-8edb-4917-85ba-24a23f179059',
    status: 'pending',
    data: {
        source: 'tahlia-social-worker',
        subtype: 'tahlia_social_approval',
        operator_queue: 'needs_you',
        needs_shannon_approval: true,
        social_action: 'feed_comment',
        draft_text: 'solid effort',
        proposed_actions: [{
            id: 'action-1',
            type: 'publish_tahlia_feed_comment',
            status: 'pending',
            preview: 'solid effort',
            payload: {
                user_id: 'tahlia-1',
                story_id: 'story-1',
                comment_text: 'solid effort',
            },
        }],
    },
};

function response(body, status = 200) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => text,
        json: async () => JSON.parse(text || '{}'),
    };
}

(async () => {
    let patchedBody = null;
    let publicWriteCount = 0;
    global.fetch = async (url, options = {}) => {
        const target = String(url);
        if (target.includes('/rest/v1/coach_alerts?select=')) return response([alert]);
        if (target.endsWith('/auth/v1/user')) {
            const token = String(options.headers?.Authorization || '');
            if (token === 'Bearer coach-token') return response({ id: '00a6605e-8edb-4917-85ba-24a23f179059' });
            if (token === 'Bearer member-token') return response({ id: 'member-1' });
            return response({ error: 'unauthorized' }, 401);
        }
        if (target.includes('/rest/v1/coach_alerts?id=eq.alert-1') && options.method === 'PATCH') {
            patchedBody = JSON.parse(options.body);
            return response([]);
        }
        if (target.includes('/rest/v1/stories') || target.includes('/rest/v1/feed_comments')) {
            publicWriteCount += 1;
            return response([]);
        }
        throw new Error(`Unexpected fetch: ${options.method || 'GET'} ${target}`);
    };

    const handler = require('../netlify/functions/perform-coach-action').handler;
    const saved = await handler({
        httpMethod: 'POST',
        headers: { Authorization: 'Bearer coach-token' },
        body: JSON.stringify({
            alertId: 'alert-1',
            actionId: 'action-1',
            editedText: 'front squat day is no joke',
            originalText: 'solid effort',
            source: 'balance_feed_tahlia_approval',
            saveOnly: true,
        }),
    });
    const savedPayload = JSON.parse(saved.body);
    assert.strictEqual(saved.statusCode, 200);
    assert.strictEqual(savedPayload.saved, true);
    assert.strictEqual(patchedBody.data.draft_text, 'front squat day is no joke');
    assert.strictEqual(patchedBody.data.original_draft_text, 'solid effort');
    assert.strictEqual(patchedBody.data.proposed_actions[0].payload.comment_text, 'front squat day is no joke');
    assert.strictEqual(patchedBody.data.tahlia_social_edit_history.length, 1);
    assert.strictEqual(patchedBody.data.tahlia_social_learning_pending, true);
    assert.strictEqual(publicWriteCount, 0, 'saving an edit must not publish a story or comment');

    patchedBody = null;
    const forbidden = await handler({
        httpMethod: 'POST',
        headers: { Authorization: 'Bearer member-token' },
        body: JSON.stringify({
            alertId: 'alert-1',
            actionId: 'action-1',
            editedText: 'member edit',
            saveOnly: true,
        }),
    });
    assert.strictEqual(forbidden.statusCode, 403);
    assert.strictEqual(patchedBody, null);
    assert.strictEqual(publicWriteCount, 0);

    const unauthenticated = await handler({
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ alertId: 'alert-1', actionId: 'action-1' }),
    });
    assert.strictEqual(unauthenticated.statusCode, 401);
    assert.strictEqual(publicWriteCount, 0);

    console.log('tahlia-feed-edit-handler tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
