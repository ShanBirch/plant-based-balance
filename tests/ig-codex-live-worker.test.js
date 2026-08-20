const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
    const workerPath = path.resolve(__dirname, '../scripts/ig-codex-live-worker.mjs');
    const worker = await import(pathToFileURL(workerPath).href);
    const { isCodexLivePaidMetaThread } = require('../netlify/functions/ig-instant-draft')._test;
    const { cleanOwner } = require('../netlify/functions/_lib/ig-next-action-queue');
    const { verifyMetaAppPreviewRef } = require('../netlify/functions/_lib/meta-app-preview-ref');

    const productionOriginSource = fs.readFileSync(workerPath, 'utf8');
    assert.match(productionOriginSource, /https:\/\/main--future-balance\.netlify\.app/);
    assert.doesNotMatch(productionOriginSource, /BALANCE_SITE_URL \|\| 'https:\/\/plantbased-balance\.org'/);
    assert.match(productionOriginSource, /DEFAULT_INBOUND_QUIET_MS = 2500/);
    assert.match(productionOriginSource, /DEFAULT_BATCH_MAX_WAIT_MS = 9000/);
    assert.match(productionOriginSource, /DEFAULT_HTTP_TIMEOUT_MS = 10000/);
    assert.match(productionOriginSource, /DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 15000/);
    assert.match(productionOriginSource, /AbortSignal\.timeout\(timeoutMs\)/);
    assert.match(productionOriginSource, /pending alert poll failed; retrying/);
    assert.match(productionOriginSource, /stalled_draft_generation_pending/);

    assert.strictEqual(worker.parseArgs([]).useAppServer, true, 'live conversation mode is the worker default');
    assert.strictEqual(worker.parseArgs(['--direct-draft']).useAppServer, false, 'direct draft requires an explicit diagnostic flag');
    assert.strictEqual(worker.parseArgs(['--direct-draft', '--codex-turn']).useAppServer, true, 'the explicit production flag wins when it appears last');

    const previewThreadId = '4baea56e-eab4-4887-a732-39b14e983d44';
    const previewNow = Date.parse('2026-08-20T04:00:00Z');
    const previewSecret = 'test-preview-secret';
    const signedPreviewUrl = worker.buildSignedMetaAppPreviewUrl(previewThreadId, {
        secret: previewSecret,
        nowMs: previewNow,
    });
    assert.match(signedPreviewUrl, /^https:\/\/plantbased-balance\.org\/p\/[A-Za-z0-9_-]+$/);
    const previewToken = signedPreviewUrl.split('/').pop();
    assert.strictEqual(verifyMetaAppPreviewRef(previewToken, {
        nowMs: previewNow,
        env: { META_APP_PREVIEW_REF_SECRET: previewSecret },
    }).threadId, previewThreadId, 'the worker signs the same compact preview reference as the public preview route');
    assert.strictEqual(worker.buildSignedMetaAppPreviewUrl('not-a-thread', { secret: previewSecret }), '');
    assert.strictEqual(worker.shouldRetryFailedAlert(null, previewNow), true);
    assert.strictEqual(worker.shouldRetryFailedAlert({ status: 'failed', failedAt: '2026-08-20T03:59:50Z' }, previewNow, 30000), false);
    assert.strictEqual(worker.shouldRetryFailedAlert({ status: 'failed', failedAt: '2026-08-20T03:59:20Z' }, previewNow, 30000), true);

    const claimedAction = {
        id: 'action-1', action_version: 3, source_message_id: 'message-1',
        claim_token: 'claim-1',
    };
    const currentClaim = {
        ...claimedAction, status: 'claimed', owner: 'codex_live_worker', claim_owner: 'codex_live_worker',
    };
    assert.strictEqual(worker.isLiveClaimCurrent({
        claimedAction,
        currentAction: currentClaim,
        currentAlert: { status: 'pending' },
        canonicalOutbounds: [],
    }), true);
    assert.strictEqual(worker.isLiveClaimCurrent({
        claimedAction,
        currentAction: { ...currentClaim, action_version: 4 },
        currentAlert: { status: 'pending' },
        canonicalOutbounds: [],
    }), false, 'a superseded controller version cannot start a Codex turn');
    assert.strictEqual(worker.isLiveClaimCurrent({
        claimedAction,
        currentAction: currentClaim,
        currentAlert: { status: 'sent' },
        canonicalOutbounds: [{ id: 'already-sent' }],
    }), false, 'canonical delivery makes the slow local wake stale');

    const rpc = new worker.JsonRpcAppServer({ binary: '', workspace: '', logger: () => {} });
    rpc.child = { stdin: { writable: true, write: (_payload, callback) => { if (callback) callback(); } } };
    await assert.rejects(
        rpc.request('thread/start', {}, { timeoutMs: 5 }),
        error => error?.code === 'APP_SERVER_REQUEST_TIMEOUT',
        'an unresponsive app-server request must fail fast',
    );

    assert.strictEqual(cleanOwner('codex_live_worker'), 'codex_live_worker');

    assert.strictEqual(isCodexLivePaidMetaThread({
        linkedUserId: null,
        customData: {},
        acquisitionMode: 'paid_meta',
    }), true, 'verified paid Meta threads use the dedicated worker by default');
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
    assert.strictEqual(worker.shouldHandleAlert({
        ...alert,
        data: { ...alert.data, codex_live_chat_required: false, ig_thread_id: '4baea56e-eab4-4887-a732-39b14e983d44', draft_error: 'draft_generation_pending' },
    }, now, 2500), true);
    assert.strictEqual(worker.shouldHandleAlert({
        ...alert,
        data: { ...alert.data, codex_live_chat_required: false, ig_username: 'ordinary_lead', draft_error: 'draft_generation_pending' },
    }, now, 2500), false);
    assert.strictEqual(worker.isRecoverableBareDraftAlert({
        ...alert,
        data: { ...alert.data, ig_thread_id: '4baea56e-eab4-4887-a732-39b14e983d44', draft_error: 'draft_generation_pending' },
    }), true);
    assert.strictEqual(worker.isRecoverableBareDraftAlert({
        ...alert,
        data: { ...alert.data, ig_thread_id: 'ordinary-thread', draft_error: 'draft_generation_pending' },
    }), false);

    assert.strictEqual(worker.isPaidMetaTestReset('What is the Founders Pass?'), true);
    assert.strictEqual(worker.isPaidMetaTestReset("What's the founders pass"), true);
    assert.strictEqual(worker.isPaidMetaTestReset('what is founders pass?'), false);
    assert.strictEqual(worker.shouldStartFreshEpisode({ ...alert, data: { ...alert.data, message_preview: 'What is the Founders Pass?' } }, null), true);
    assert.strictEqual(worker.shouldStartFreshEpisode({ ...alert, data: { ...alert.data, message_preview: 'What is the Founders Pass?' } }, { resetAlertId: 'alert-1' }), false);
    assert.strictEqual(worker.shouldStartFreshEpisode(alert, { resetAlertId: null }), false);

    const videoAlert = {
        ...alert,
        data: {
            ...alert.data,
            draft_video_attachment_url: 'https://plantbased-balance.org/assets/balance-foundations-app-proof-v4.mp4',
        },
    };
    const canonicalOutbounds = [{ id: 'outbound-1', text: 'Yep, here it is again. Can you see it now?' }];
    assert.strictEqual(worker.requiresVerifiedVideoDelivery(videoAlert), true);
    assert.strictEqual(worker.hasVerifiedAlertDelivery({
        alert: videoAlert,
        canonicalOutbounds,
        finalAlert: { data: { delivery_payload_kind: 'text' } },
    }), false, 'text-only delivery cannot complete a native-video retry');
    assert.strictEqual(worker.hasVerifiedAlertDelivery({
        alert: videoAlert,
        canonicalOutbounds,
        finalAlert: { data: { delivery_payload_kind: 'video' } },
    }), true);

    const settledAlert = {
        ...alert,
        data: {
            ...alert.data,
            draft_text: 'Yep, 15 kilos is a clear goal. What has been getting in the way?',
            drafted_at: '2026-08-14T12:00:04Z',
        },
    };
    assert.strictEqual(worker.isSettledDraft(
        settledAlert,
        { last_inbound_at: '2026-08-14T12:00:03Z' },
        Date.parse('2026-08-14T12:00:10Z'),
        6500,
    ), true);
    assert.strictEqual(worker.isSettledDraft(
        settledAlert,
        { last_inbound_at: '2026-08-14T12:00:08Z' },
        Date.parse('2026-08-14T12:00:10Z'),
        6500,
    ), false, 'a late second message resets the quiet window and requires a newer draft');
    assert.strictEqual(worker.hasVerifiedAlertDelivery({
        alert,
        canonicalOutbounds,
        finalAlert: { data: { delivery_payload_kind: 'text' } },
    }), true);

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
        appPreviewUrl: signedPreviewUrl,
        checkoutUrl: 'https://plantbased-balance.org/founders',
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
    assert.match(prompt, /signed personal app-preview link immediately/i);
    assert.match(prompt, /Never ask for their first name, last name, email address, phone number/i);
    assert.match(prompt, new RegExp(signedPreviewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(prompt, /Exact approved Founders Pass checkout URL: https:\/\/plantbased-balance\.org\/founders/);
    assert.match(prompt, /send that exact URL now and do not search for, regenerate, shorten, or substitute it/i);
    assert.match(prompt, /Never complete or cancel the controller action unless the required Instagram payload has been sent/i);
    assert.match(prompt, /Do not copy their wording/);
    assert.match(prompt, /one AUD 89\.99 payment/);
    assert.doesNotMatch(prompt, /before making a payment\. Keen\?/);
    assert.match(prompt, /Do not browse, research, edit code/);
    assert.match(prompt, /plain ASCII punctuation and no emoji/);
    assert.match(prompt, /background conversation state open/);
    assert.match(prompt, /LIVE_CHAT_STATE: open/);
    assert.match(prompt, /alert-1/);
    assert.match(prompt, /action-1/);
    assert.match(prompt, /claim-1/);

    const installer = fs.readFileSync(path.resolve(__dirname, '../scripts/install-ig-codex-live-worker.ps1'), 'utf8');
    const workerSource = fs.readFileSync(workerPath, 'utf8');
    assert.match(workerSource, /async recoverPendingNoSendAction\(threadId, alertId\)/);
    assert.match(workerSource, /recovered pending no-send action/);
    assert.match(workerSource, /route_paid_meta_live_codex_action/);
    assert.match(workerSource, /process\.env\.SUPABASE_URL = supabaseCredentials\.url/);
    assert.match(installer, /\$watchdogTrigger\s*=\s*New-ScheduledTaskTrigger/);
    assert.match(installer, /-RepetitionInterval \(New-TimeSpan -Minutes 1\)/);
    assert.match(installer, /-AllowStartIfOnBatteries/);
    assert.match(installer, /-DontStopIfGoingOnBatteries/);
    assert.match(installer, /-Trigger \$triggers/);
    assert.match(installer, /--codex-turn --workspace/);
    assert.doesNotMatch(installer, /--direct-draft/);
    assert.doesNotMatch(installer, /--open-chat/);

    console.log('ig Codex live worker tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
