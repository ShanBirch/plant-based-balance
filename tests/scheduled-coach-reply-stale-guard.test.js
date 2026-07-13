const assert = require('assert');

const originalFetch = global.fetch;
const worker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

async function run() {
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
