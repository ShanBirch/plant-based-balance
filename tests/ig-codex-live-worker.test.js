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
    assert.match(productionOriginSource, /DEFAULT_POLL_MS = 750/);
    assert.match(productionOriginSource, /DEFAULT_COALESCE_MS = 1200/);
    assert.match(productionOriginSource, /DEFAULT_INBOUND_QUIET_MS = 1200/);
    assert.match(productionOriginSource, /DEFAULT_BATCH_MAX_WAIT_MS = 5000/);
    assert.match(productionOriginSource, /DEFAULT_TURN_TIMEOUT_MS = 20 \* 1000/);
    assert.match(productionOriginSource, /DEFAULT_HTTP_TIMEOUT_MS = 10000/);
    assert.match(productionOriginSource, /DEFAULT_APP_SERVER_REQUEST_TIMEOUT_MS = 15000/);
    assert.match(productionOriginSource, /AbortSignal\.timeout\(timeoutMs\)/);
    assert.match(productionOriginSource, /pending alert poll failed; retrying/);
    assert.match(productionOriginSource, /stalled_draft_generation_pending/);
    assert.match(
        productionOriginSource,
        /alert = await waitForSettledDraft\([\s\S]*?const runId[\s\S]*?claimThread/,
        'the production worker settles and reloads the full inbound batch before claiming the turn',
    );

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
    assert.match(signedPreviewUrl, /^https:\/\/future-balance\.netlify\.app\/p\/[A-Za-z0-9_-]+$/);
    const previewToken = signedPreviewUrl.split('/').pop();
    assert.strictEqual(verifyMetaAppPreviewRef(previewToken, {
        nowMs: previewNow,
        env: { META_APP_PREVIEW_REF_SECRET: previewSecret },
    }).threadId, previewThreadId, 'the worker signs the same compact preview reference as the public preview route');
    const broadSignedPreviewUrl = worker.buildSignedMetaAppPreviewUrl(previewThreadId, {
        secret: previewSecret,
        nowMs: previewNow,
        flowVariant: 'broad_pain',
    });
    assert.match(broadSignedPreviewUrl, /^https:\/\/future-balance\.netlify\.app\/p\/[A-Za-z0-9_-]+$/);
    assert.strictEqual(verifyMetaAppPreviewRef(broadSignedPreviewUrl.split('/').pop(), {
        nowMs: previewNow,
        env: { META_APP_PREVIEW_REF_SECRET: previewSecret },
    }).threadId, previewThreadId, 'the broad host uses the same signed thread reference');
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
    assert.strictEqual(worker.shouldStartFreshEpisode(alert, {
        resetAfterPreviewDelivery: true,
        lastAlertId: 'prior-alert',
    }), true, 'a verified preview handoff starts a fresh Codex conversation on the next test message');
    assert.strictEqual(worker.shouldStartFreshEpisode(alert, {
        resetAfterPreviewDelivery: true,
        lastAlertId: alert.id,
    }), false, 'the same alert cannot reset its conversation twice');

    const previewDeliveryAlert = {
        ...alert,
        client_name: 'goldcoast_ai_solutions',
        data: {
            ...alert.data,
            ig_username: 'goldcoast_ai_solutions',
            ig_thread_id: '4baea56e-eab4-4887-a732-39b14e983d44',
            paid_meta_app_preview_handoff: true,
            paid_meta_app_preview_url: signedPreviewUrl,
        },
    };
    assert.strictEqual(worker.shouldResetGoldCoastAiConversationAfterDelivery({
        alert: previewDeliveryAlert,
        finalAlert: previewDeliveryAlert,
        canonicalOutbounds: [{ text: `Here you go: ${signedPreviewUrl}` }],
    }), true);
    assert.strictEqual(worker.shouldResetGoldCoastAiConversationAfterDelivery({
        alert: { ...previewDeliveryAlert, data: { ...previewDeliveryAlert.data, ig_username: 'ordinary_lead' } },
        finalAlert: { ...previewDeliveryAlert, data: { ...previewDeliveryAlert.data, ig_username: 'ordinary_lead' } },
        canonicalOutbounds: [{ text: `Here you go: ${signedPreviewUrl}` }],
    }), false, 'the live worker reset is scoped to Gold Coast AI Solutions');

    const videoAlert = {
        ...alert,
        data: {
            ...alert.data,
            draft_video_attachment_url: 'https://plantbased-balance.org/assets/balance-foundations-app-proof-v5.mp4',
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
    let settleClock = Date.parse('2026-08-14T12:00:10Z');
    let alertReads = 0;
    const reloadedBatchAlert = {
        ...settledAlert,
        data: {
            ...settledAlert.data,
            draft_text: 'Yep, it includes both. And yes, you can train at home. What result are you aiming for?',
            drafted_at: '2026-08-14T12:00:09Z',
            message_preview: 'Can I train at home?',
        },
    };
    const latestSettledAlert = await worker.waitForSettledDraft({
        supabase: {
            deliveryAlertById: async () => (++alertReads === 1 ? settledAlert : reloadedBatchAlert),
            threadById: async () => ({ last_inbound_at: '2026-08-14T12:00:08Z' }),
        },
        alertId: settledAlert.id,
        threadId: 'ig-thread-1',
        quietMs: 1200,
        maxWaitMs: 2000,
        pollMs: 500,
        now: () => settleClock,
        sleep: async ms => { settleClock += ms; },
    });
    assert.strictEqual(latestSettledAlert, reloadedBatchAlert,
        'the settling gate reloads a newer draft that covers a late second or third inbound');
    assert.strictEqual(alertReads, 2);
    const fallbackPatches = [];
    let fallbackRan = false;
    await worker.runDirectDraftFallbackAfterCodexFailure({
        alert: settledAlert,
        action: { id: 'action-fallback' },
        error: new Error('Codex turn timed out'),
        supabase: {
            mergeAlertData: async (_alertId, patch) => { fallbackPatches.push(patch); },
        },
        state: { alerts: {} },
        statePath: '/tmp/not-written-by-injected-runner',
        logger: () => {},
        directDraftRunner: async () => { fallbackRan = true; },
    });
    assert.strictEqual(fallbackRan, true);
    assert.strictEqual(fallbackPatches[0].delivery_rescue_required, true);
    assert.strictEqual(fallbackPatches[0].codex_live_chat_required, false);
    assert.strictEqual(fallbackPatches[0].codex_live_chat_status, 'sending_approved_draft_after_codex_failure');
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
        flowVariant: 'plant_based_control',
    });
    assert.doesNotMatch(prompt, /\$balance-lead-client-dm-manager/);
    assert.doesNotMatch(prompt, /Read CODEX\.md, CLAUDE\.md/);
    assert.match(prompt, /isolated from the normal Balance AI coach/);
    assert.match(prompt, /5 to 12 seconds/);
    assert.match(prompt, /no more than two discovery questions/i);
    assert.match(prompt, /Answer every distinct message, question, or useful detail/);
    assert.match(prompt, /never silently answer only the first one/i);
    assert.match(prompt, /two to three brief back-to-back bubbles/);
    assert.match(prompt, /same synchronous delivery/);
    assert.match(prompt, /Ignore older test episodes/);
    assert.match(prompt, /desired change.*next six weeks[\s\S]*real-life blocker/i);
    assert.match(prompt, /meal-plan support fitted to dietary preferences/i);
    assert.match(prompt, /approved time-limited app proof video/);
    assert.match(prompt, /URL is transport-only/);
    assert.match(prompt, /never paste it into public reply or draft text/);
    assert.match(prompt, /same synchronous delivery/i);
    assert.match(prompt, /codex_live_worker controller claim/);
    assert.match(prompt, /replyTextUtf8Base64 and draftTextUtf8Base64/);
    assert.match(prompt, /outbound_text_encoding_corruption/);
    assert.match(prompt, /free personalised app preview before payment/i);
    assert.match(prompt, /send the signed preview immediately/i);
    assert.match(prompt, /Never ask for their first name, last name, email address, phone number/i);
    assert.match(prompt, new RegExp(signedPreviewUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(prompt, /Exact approved Founders Pass checkout URL: https:\/\/future-balance\.netlify\.app\/fitness/);
    assert.match(prompt, /send that exact URL now and do not search for, regenerate, shorten, or substitute it/i);
    assert.match(prompt, /Never complete or cancel the controller action unless the required Instagram payload has been sent/i);
    assert.match(prompt, /one AUD 149 payment/);
    assert.match(prompt, /Frozen campaign variant: broad_pain/i);
    assert.doesNotMatch(prompt, /plant[ -]?based meal plan|plant[ -]?based connection|currently plant[ -]?based or vegan/i);
    assert.doesNotMatch(prompt, /before making a payment\. Keen\?/);
    assert.match(prompt, /Do not browse, research, edit code/);
    assert.match(prompt, /plain ASCII punctuation and no emoji/);
    assert.match(prompt, /background conversation state open/);
    assert.match(prompt, /LIVE_CHAT_STATE: open/);
    assert.match(prompt, /alert-1/);
    assert.match(prompt, /action-1/);
    assert.match(prompt, /claim-1/);

    const broadPrompt = worker.buildLivePrompt({
        alert: {
            ...alert,
            data: {
                ...alert.data,
                meta_ad_flow_variant: 'broad_pain',
                offer_flow_variant: 'broad_pain',
                meta_ad_checkout_url: 'https://future-balance.netlify.app/fitness',
            },
        },
        action: {
            id: 'action-broad',
            action_version: 1,
            claim_token: 'claim-broad',
            source_message_id: 'message-broad',
            thread_id: 'ig-thread-broad',
        },
        codexThreadId: 'codex-thread-broad',
        appPreviewUrl: broadSignedPreviewUrl,
        checkoutUrl: 'https://future-balance.netlify.app/fitness',
        flowVariant: 'broad_pain',
    });
    assert.match(broadPrompt, /no more than two discovery questions/i);
    assert.match(broadPrompt, /desired change.*next six weeks[\s\S]*real-life blocker/i);
    assert.match(broadPrompt, /meal-plan support fitted to dietary preferences/i);
    assert.match(broadPrompt, /week 1, Why change feels hard/i);
    assert.match(broadPrompt, /week 4, Take the fight out of food/i);
    assert.match(broadPrompt, /week 6, Build your sustainable way forward/i);
    assert.match(broadPrompt, /Do not dump all six weeks into an ordinary pitch/i);
    assert.match(broadPrompt, /complete outline when they ask about the curriculum or week-by-week course/i);
    assert.match(broadPrompt, /one AUD 149 payment for the full six weeks/i);
    assert.match(broadPrompt, /future-balance\.netlify\.app\/p\//i);
    assert.match(broadPrompt, /future-balance\.netlify\.app\/fitness/i);
    assert.match(broadPrompt, /Frozen campaign variant: broad_pain/i);
    assert.doesNotMatch(broadPrompt, /plant[ -]?based meal plan|plant[ -]?based connection|currently plant[ -]?based or vegan/i);

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
