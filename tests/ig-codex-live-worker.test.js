const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
    const workerPath = path.resolve(__dirname, '../scripts/ig-codex-live-worker.mjs');
    const worker = await import(pathToFileURL(workerPath).href);
    const { isCodexLivePaidMetaThread } = require('../netlify/functions/ig-instant-draft')._test;

    assert.strictEqual(isCodexLivePaidMetaThread({
        linkedUserId: null,
        customData: { codex_live_chat_enabled: true },
        acquisitionMode: 'paid_meta',
    }), true);
    assert.strictEqual(isCodexLivePaidMetaThread({
        linkedUserId: 'client-1',
        customData: { codex_live_chat_enabled: true },
        acquisitionMode: 'paid_meta',
    }), false);
    assert.strictEqual(isCodexLivePaidMetaThread({
        linkedUserId: null,
        customData: { codex_live_chat_enabled: false },
        acquisitionMode: 'paid_meta',
    }), false);
    assert.strictEqual(isCodexLivePaidMetaThread({
        linkedUserId: null,
        customData: { codex_live_chat_enabled: true },
        acquisitionMode: 'organic_inbound',
    }), false);

    const now = Date.parse('2026-08-14T12:00:10Z');
    const alert = {
        id: 'alert-1',
        status: 'pending',
        created_at: '2026-08-14T12:00:00Z',
        client_name: 'test_lead',
        data: {
            codex_live_chat_required: true,
            ig_thread_id: 'ig-thread-1',
            ig_username: 'test_lead',
            message_preview: 'How does it work?',
        },
    };
    assert.strictEqual(worker.shouldHandleAlert(alert, now, 2500), true);
    assert.strictEqual(worker.shouldHandleAlert({ ...alert, status: 'sent' }, now, 2500), false);
    assert.strictEqual(worker.shouldHandleAlert({ ...alert, data: { ...alert.data, codex_live_chat_required: false } }, now, 2500), false);

    assert.strictEqual(worker.isPaidMetaTestReset('What is the Founders Pass?'), true);
    assert.strictEqual(worker.isPaidMetaTestReset("What's the founders pass"), true);
    assert.strictEqual(worker.isPaidMetaTestReset('what is founders pass?'), false);
    assert.strictEqual(worker.shouldStartFreshEpisode({ ...alert, data: { ...alert.data, message_preview: 'What is the Founders Pass?' } }, null), true);
    assert.strictEqual(worker.shouldStartFreshEpisode({ ...alert, data: { ...alert.data, message_preview: 'What is the Founders Pass?' } }, { resetAlertId: 'alert-1' }), false);
    assert.strictEqual(worker.shouldStartFreshEpisode(alert, { resetAlertId: null }), false);

    const prompt = worker.buildLivePrompt({
        alert,
        action: {
            id: 'action-1',
            action_version: 3,
            claim_token: 'claim-1',
            source_message_id: 'message-1',
            thread_id: 'ig-thread-1',
        },
        codexThreadId: 'codex-thread-1',
    });
    assert.doesNotMatch(prompt, /\$balance-lead-client-dm-manager/);
    assert.doesNotMatch(prompt, /Read CODEX\.md, CLAUDE\.md/);
    assert.match(prompt, /isolated from the normal Balance AI coach/);
    assert.match(prompt, /15 to 30 seconds/);
    assert.match(prompt, /exactly one purposeful question/);
    assert.match(prompt, /positive acknowledgements are not closers/);
    assert.match(prompt, /Ignore older test episodes/);
    assert.match(prompt, /one AUD 89\.99 payment/);
    assert.match(prompt, /before making a payment\. Keen\?/);
    assert.match(prompt, /Do not browse, research, edit code/);
    assert.match(prompt, /LIVE_CHAT_STATE: open/);
    assert.match(prompt, /alert-1/);
    assert.match(prompt, /action-1/);
    assert.match(prompt, /claim-1/);

    console.log('ig Codex live worker tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
