const assert = require('assert');

const originalFetch = global.fetch;
const worker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

async function run() {
    assert.deepStrictEqual(
        await worker.buildCurrentClientNeedsYouHold({
            id: 'current-client-alert',
            client_id: 'client-current',
            data: { scheduled_via: 'auto_send' },
        }),
        {
            code: 'linked_client_requires_shannon_approval',
            label: 'current client reply needs Shannon approval',
            linked_user_id: 'client-current',
        },
        'scheduled worker must hold current clients before transport'
    );
    assert.strictEqual(
        await worker.buildCurrentClientNeedsYouHold({
            client_id: 'client-current',
            data: { scheduled_via: 'admin_dashboard' },
        }),
        null,
        'scheduled worker must allow replies Shannon explicitly scheduled'
    );

    const alert = {
        id: 'scheduled-alert',
        created_at: '2026-07-13T02:25:29.604Z',
        data: {
            channel: 'instagram',
            ig_thread_id: 'thread-andy',
        },
    };

    global.fetch = async (url) => {
        assert.match(String(url), /thread_id=eq\.thread-andy/);
        assert.match(String(url), /created_at=gt\.2026-07-13T02%3A25%3A29\.604Z/);
        return {
            ok: true,
            text: async () => JSON.stringify([{
                id: 'newer-inbound',
                text: 'How is the goldie?',
                created_at: '2026-07-13T02:25:31.799Z',
                alert_id: 'goldie-alert',
            }]),
        };
    };
    const newer = await worker.getNewerInstagramInbound(alert);
    assert.strictEqual(newer.id, 'newer-inbound');

    const messengerAlert = {
        ...alert,
        data: { channel: 'messenger', ig_thread_id: 'thread-messenger' },
    };
    global.fetch = async (url) => {
        assert.match(String(url), /thread_id=eq\.thread-messenger/);
        return {
            ok: true,
            text: async () => JSON.stringify([{ id: 'newer-messenger-inbound' }]),
        };
    };
    assert.strictEqual((await worker.getNewerInstagramInbound(messengerAlert)).id, 'newer-messenger-inbound');

    global.fetch = async () => ({ ok: true, text: async () => '[]' });
    assert.strictEqual(await worker.getNewerInstagramInbound(alert), null);
    assert.strictEqual(await worker.getNewerInstagramInbound({ data: { channel: 'instagram' } }), null);

    global.fetch = originalFetch;
    console.log('scheduled coach reply stale guard tests passed');
}

run().catch((error) => {
    global.fetch = originalFetch;
    console.error(error);
    process.exit(1);
});
