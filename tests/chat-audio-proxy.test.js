const assert = require('assert');
const validUrl = 'https://f005.backblazeb2.com/file/plantbasedbalancestories/chats/client-id/checkin.mp3';

(async () => {
    const proxy = await import('../netlify/functions/chat-audio-proxy.mts');
    assert.strictEqual(proxy.resolveAllowedAudioUrl(validUrl), validUrl);
    assert.strictEqual(proxy.resolveAllowedAudioUrl('http://f005.backblazeb2.com/file/plantbasedbalancestories/chats/a.mp3'), null);
    assert.strictEqual(proxy.resolveAllowedAudioUrl('https://example.com/file/plantbasedbalancestories/chats/a.mp3'), null);
    assert.strictEqual(proxy.resolveAllowedAudioUrl('https://f005.backblazeb2.com/file/plantbasedbalancestories/private/a.mp3'), null);
    assert.strictEqual(proxy.resolveAllowedAudioUrl('https://f005.backblazeb2.com/file/plantbasedbalancestories/chats/a.html'), null);
    assert.strictEqual(proxy.boundedRange('bytes=0-'), 'bytes=0-1048575');
    assert.strictEqual(proxy.boundedRange('bytes=100-199'), 'bytes=100-199');
    assert.strictEqual(proxy.boundedRange('bytes=100-9999999'), 'bytes=100-1048675');
    assert.strictEqual(proxy.boundedRange(''), 'bytes=0-1048575');

    const originalFetch = global.fetch;
    let receivedRequest;
    global.fetch = async (url, options) => {
        receivedRequest = { url, options };
        return new Response(Buffer.from('audio-bytes'), {
            status: 206,
            headers: {
                'accept-ranges': 'bytes',
                'content-range': 'bytes 0-10/100',
                'content-length': '11',
                'content-type': 'audio/mpeg',
            },
        });
    };

    try {
        const result = await proxy.default(new Request(`https://plantbased-balance.org/api/chat-audio?url=${encodeURIComponent(validUrl)}`, {
            headers: { range: 'bytes=0-10' },
        }));
        assert.strictEqual(result.status, 206);
        assert.strictEqual(await result.text(), 'audio-bytes');
        assert.strictEqual(result.headers.get('content-type'), 'audio/mpeg');
        assert.strictEqual(result.headers.get('content-range'), 'bytes 0-10/100');
        assert.strictEqual(receivedRequest.options.headers.get('Range'), 'bytes=0-10');

        const rejected = await proxy.default(new Request('https://plantbased-balance.org/api/chat-audio?url=https%3A%2F%2Fexample.com%2Faudio.mp3'));
        assert.strictEqual(rejected.status, 400);
    } finally {
        global.fetch = originalFetch;
    }

    console.log('chat audio proxy tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
