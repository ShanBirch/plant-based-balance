const assert = require('assert');
const { handler, _test } = require('../netlify/functions/chat-audio-proxy');

const validUrl = 'https://f005.backblazeb2.com/file/plantbasedbalancestories/chats/client-id/checkin.mp3';

assert.strictEqual(_test.resolveAllowedAudioUrl(validUrl), validUrl);
assert.strictEqual(_test.resolveAllowedAudioUrl('http://f005.backblazeb2.com/file/plantbasedbalancestories/chats/a.mp3'), null);
assert.strictEqual(_test.resolveAllowedAudioUrl('https://example.com/file/plantbasedbalancestories/chats/a.mp3'), null);
assert.strictEqual(_test.resolveAllowedAudioUrl('https://f005.backblazeb2.com/file/plantbasedbalancestories/private/a.mp3'), null);
assert.strictEqual(_test.resolveAllowedAudioUrl('https://f005.backblazeb2.com/file/plantbasedbalancestories/chats/a.html'), null);
assert.strictEqual(_test.boundedRange('bytes=0-'), 'bytes=0-1048575');
assert.strictEqual(_test.boundedRange('bytes=100-199'), 'bytes=100-199');
assert.strictEqual(_test.boundedRange('bytes=100-9999999'), 'bytes=100-1048675');
assert.strictEqual(_test.boundedRange(''), 'bytes=0-1048575');

(async () => {
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
        const result = await handler({
            httpMethod: 'GET',
            queryStringParameters: { url: validUrl },
            headers: { range: 'bytes=0-10' },
        });
        assert.strictEqual(result.statusCode, 206);
        assert.strictEqual(result.isBase64Encoded, true);
        assert.strictEqual(Buffer.from(result.body, 'base64').toString(), 'audio-bytes');
        assert.strictEqual(result.headers['content-type'], 'audio/mpeg');
        assert.strictEqual(result.headers['content-range'], 'bytes 0-10/100');
        assert.strictEqual(receivedRequest.options.headers.Range, 'bytes=0-10');

        const rejected = await handler({
            httpMethod: 'GET',
            queryStringParameters: { url: 'https://example.com/audio.mp3' },
            headers: {},
        });
        assert.strictEqual(rejected.statusCode, 400);
    } finally {
        global.fetch = originalFetch;
    }

    console.log('chat audio proxy tests passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
