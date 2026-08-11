const assert = require('assert');

const worker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

(async () => {
    const alert = { id: 'alert-1', data: { ig_thread_id: 'thread-1' } };
    const newerMessage = {
        id: 'native-outbound-1',
        direction: 'out',
        created_at: '2026-08-11T02:43:12.150Z',
    };
    let cancelledWith = null;

    const blocked = await worker.cancelIfNewerInstagramConversationMessage(alert, {
        lookup: async receivedAlert => {
            assert.strictEqual(receivedAlert, alert);
            return newerMessage;
        },
        cancel: async (receivedAlert, receivedMessage) => {
            assert.strictEqual(receivedAlert, alert);
            cancelledWith = receivedMessage;
        },
    });

    assert.strictEqual(blocked, newerMessage);
    assert.strictEqual(cancelledWith, newerMessage);

    let cancelCalled = false;
    const clear = await worker.cancelIfNewerInstagramConversationMessage(alert, {
        lookup: async () => null,
        cancel: async () => { cancelCalled = true; },
    });

    assert.strictEqual(clear, null);
    assert.strictEqual(cancelCalled, false);
    console.log('scheduled-coach-reply-worker race tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
