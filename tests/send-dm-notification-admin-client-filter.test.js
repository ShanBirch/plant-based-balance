const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'netlify', 'functions', 'send-dm-notification.js');
const code = fs.readFileSync(file, 'utf8');

const moduleSandbox = { exports: {} };
const sandbox = {
    module: moduleSandbox,
    exports: moduleSandbox.exports,
    require(id) {
        if (id === 'web-push') return { setVapidDetails() {}, sendNotification() {} };
        if (id === 'crypto') return require('crypto');
        if (id === './_lib/client-context') return { normalizeCoachDraftText: value => String(value || '') };
        if (id === './_lib/firebase-service-account') return { loadFirebaseServiceAccount: async () => null };
        return require(id);
    },
    console: { log() {}, warn() {}, error() {} },
    process: { env: {} },
    Buffer,
};
sandbox.global = sandbox;

vm.runInNewContext(code, sandbox, { filename: file });

const { isAllowedAdminPhonePush } = sandbox.module.exports.__test;

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'coach_draft_ready',
        alert: { alert_type: 'incoming_dm', client_id: 'client-1', data: {} },
        payload: { messageText: 'draft ready' },
    }),
    true
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'coach_draft_ready',
        alert: {
            alert_type: 'ig_incoming_dm',
            client_id: null,
            data: { channel: 'instagram', ig_thread_id: 'thread-1', lead_stage: 'qualifying', lifecycle: { stage: 'lead' } },
        },
        payload: { sourceChannel: 'instagram', clientId: 'subscriber-1', messageText: 'draft ready' },
    }),
    false
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'coach_draft_ready',
        alert: {
            alert_type: 'ig_incoming_dm',
            client_id: 'client-2',
            data: { channel: 'instagram', ig_thread_id: 'thread-2', lifecycle: { stage: 'trial' } },
        },
        payload: { sourceChannel: 'instagram', clientId: 'client-2', messageText: 'draft ready' },
    }),
    true
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'dm_context_check',
        alert: {
            alert_type: 'ig_incoming_dm',
            client_id: null,
            data: { channel: 'instagram', ig_thread_id: 'thread-3', lead_stage: 'new' },
        },
        payload: { channelLabel: 'Balance IG', messageText: 'check source DM' },
    }),
    false
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'dm_context_check',
        alert: {
            alert_type: 'ig_incoming_dm',
            client_id: 'client-3',
            data: { channel: 'instagram', ig_thread_id: 'thread-4', lifecycle: { stage: 'paying' } },
        },
        payload: { channelLabel: 'Balance IG', messageText: 'check source DM' },
    }),
    true
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'dm_message',
        alert: null,
        payload: { clientId: 'client-4', senderName: 'Client', messageText: 'hey' },
    }),
    true
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'dm_message',
        alert: null,
        payload: { sourceChannel: 'instagram', clientId: 'subscriber-2', senderName: 'Lead', messageText: 'hey' },
    }),
    false
);

assert.strictEqual(
    isAllowedAdminPhonePush({
        type: 'dm_message',
        alert: null,
        payload: { sourceChannel: 'instagram', lifecycleStage: 'paying', clientId: 'client-5', senderName: 'Client', messageText: 'hey' },
    }),
    true
);
