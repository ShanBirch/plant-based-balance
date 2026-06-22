const assert = require('assert');

const growth = require('../netlify/functions/_lib/growth-outcomes');

const uuid = '11111111-1111-4111-8111-111111111111';

(async () => {
    const payload = growth.buildGrowthOutcomePayload({
        eventType: 'subscription_started',
        sourceSystem: 'stripe_webhook',
        primaryId: 'sub_123',
        email: ' TEST@Example.COM ',
        fromUsername: '@Lead User ',
        botAccount: ' shan_n_sunny ',
        contentItemId: uuid,
        rawPayload: { note: '  paid  ' },
    });

    assert.strictEqual(payload.event_key, 'stripe_webhook:subscription_started:sub_123');
    assert.strictEqual(payload.event_family, 'revenue');
    assert.strictEqual(payload.score, 100);
    assert.strictEqual(payload.email, 'test@example.com');
    assert.strictEqual(payload.email_key, 'test@example.com');
    assert.strictEqual(payload.from_username, 'leaduser');
    assert.strictEqual(payload.content_item_id, uuid);
    assert.strictEqual(payload.raw_payload.note, 'paid');

    const response = growth.buildGrowthOutcomePayload({
        eventType: 'client_message_response_sent',
        primaryId: 'nudge-1',
    });
    assert.strictEqual(response.event_family, 'engagement');
    assert.strictEqual(response.score, 1);

    const explicit = growth.buildGrowthOutcomePayload({
        eventType: 'post_comment_keyword_matched',
        sourceSystem: 'meta_ig_comment_automation',
        eventKey: 'manual:key',
        score: 0,
    });
    assert.strictEqual(explicit.event_key, 'manual:key');
    assert.strictEqual(explicit.score, 0);
    assert.strictEqual(explicit.score_breakdown.default_score, 4);

    const calls = [];
    const recorded = await growth.recordGrowthOutcome({
        eventType: 'email_captured',
        sourceSystem: 'science_resource_lead',
        primaryId: 'lead@example.com',
    }, async (path, options) => {
        calls.push({ path, options });
        return [{ id: 'event-1', ...options.body[0] }];
    });
    assert.strictEqual(calls[0].path, 'growth_outcome_events?on_conflict=event_key');
    assert.strictEqual(calls[0].options.method, 'POST');
    assert.strictEqual(recorded.id, 'event-1');
    assert.strictEqual(recorded.event_type, 'email_captured');

    const missing = await growth.recordGrowthOutcome({
        eventType: 'email_captured',
        primaryId: 'missing',
    }, async () => {
        throw new Error('PGRST205 Could not find the table growth_outcome_events');
    });
    assert.strictEqual(missing, null);

    const sentRows = growth.buildStoryCommentImportRows({
        dedupe_key: 'story-dedupe-1',
        bot_account: 'shan_n_sunny',
        ig_username: '@Fit Lead',
        send_status: 'sent',
        story_id: 'story-1',
        run_id: 'run-1',
        created_at: '2026-06-22T00:00:00.000Z',
        raw_comment: 'Nice session',
        balance_bridge_result: { safety_reason: 'passed' },
    });
    assert.strictEqual(sentRows.outreach.event_key, 'story_comment_outreach:story-dedupe-1');
    assert.strictEqual(sentRows.outreach.ig_username, 'fitlead');
    assert.strictEqual(sentRows.outcome.event_type, 'story_comment_sent');
    assert.strictEqual(sentRows.outcome.score, 2);
    assert.strictEqual(sentRows.outcome.source_system, 'story_comment_probe');
    assert.strictEqual(sentRows.outcome.story_comment_run_id, 'run-1');

    const draftRows = growth.buildStoryCommentImportRows({
        dedupe_key: 'story-dedupe-2',
        send_status: 'draft_only',
        username_after_analysis: 'draft_user',
    });
    assert.strictEqual(draftRows.outcome.event_type, 'story_comment_draft_only');
    assert.strictEqual(draftRows.outcome.score, 0);

    console.log('growth outcome tests passed');
})();
