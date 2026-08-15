const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
    const workerPath = path.resolve(__dirname, '../scripts/ig-codex-live-worker.mjs');
    const worker = await import(pathToFileURL(workerPath).href);
    const { isCodexLivePaidMetaThread } = require('../netlify/functions/ig-instant-draft')._test;
    const { cleanOwner } = require('../netlify/functions/_lib/ig-next-action-queue');

    assert.strictEqual(cleanOwner('codex_live_worker'), 'codex_live_worker');

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
    assert.match(prompt, /loose conversational path, not a scripted checklist/);
    assert.match(prompt, /plant-based connection/);
    assert.match(prompt, /currently plant-based or vegan, or looking to go plant-based or vegan/i);
    assert.match(prompt, /how long and why when those facts are missing/i);
    assert.match(prompt, /ask the missing connection detail before goals/i);
    assert.match(prompt, /genuinely matched client proof when safe/);
    assert.match(prompt, /Ally for weight loss/);
    assert.match(prompt, /Gen for strength\/confidence/);
    assert.match(prompt, /Dani for body recomposition/);
    assert.match(prompt, /Bec\/Kirsty for shared accountability/);
    assert.match(prompt, /approved transformation photos all feature women/i);
    assert.match(prompt, /known to be a man/i);
    assert.match(prompt, /food uncertainty/);
    assert.match(prompt, /Do not open with the generic line/);
    assert.match(prompt, /native app video/);
    assert.match(prompt, /63-second evergreen app video/);
    assert.match(prompt, /URL is transport-only/);
    assert.match(prompt, /never paste it into public reply or draft text/);
    assert.match(prompt, /same synchronous delivery/i);
    assert.match(prompt, /end the same video turn with one setup question/i);
    assert.match(prompt, /codex_live_worker controller claim/);
    assert.match(prompt, /replyTextUtf8Base64 and draftTextUtf8Base64/);
    assert.match(prompt, /outbound_text_encoding_corruption/);
    assert.match(prompt, /free personalised look inside the app/);
    assert.match(prompt, /Do not copy their wording/);
    assert.match(prompt, /one AUD 89\.99 payment/);
    assert.doesNotMatch(prompt, /before making a payment\. Keen\?/);
    assert.match(prompt, /Do not browse, research, edit code/);
    assert.match(prompt, /background conversation state open/);
    assert.match(prompt, /LIVE_CHAT_STATE: open/);
    assert.match(prompt, /alert-1/);
    assert.match(prompt, /action-1/);
    assert.match(prompt, /claim-1/);

    const installer = fs.readFileSync(path.resolve(__dirname, '../scripts/install-ig-codex-live-worker.ps1'), 'utf8');
    assert.match(installer, /\$watchdogTrigger\s*=\s*New-ScheduledTaskTrigger/);
    assert.match(installer, /-RepetitionInterval \(New-TimeSpan -Minutes 1\)/);
    assert.match(installer, /-AllowStartIfOnBatteries/);
    assert.match(installer, /-DontStopIfGoingOnBatteries/);
    assert.match(installer, /-Trigger \$triggers/);
    assert.doesNotMatch(installer, /--open-chat/);

    console.log('ig Codex live worker tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
