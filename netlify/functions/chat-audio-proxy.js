const ALLOWED_HOST = 'f005.backblazeb2.com';
const ALLOWED_PATH_PREFIX = '/file/plantbasedbalancestories/chats/';
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav']);
const MAX_RANGE_BYTES = 1024 * 1024;

function response(statusCode, body = '', headers = {}, isBase64Encoded = false) {
    return {
        statusCode,
        headers: {
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            ...headers,
        },
        body,
        isBase64Encoded,
    };
}

function boundedRange(rawRange) {
    const value = String(rawRange || '').trim();
    const match = value.match(/^bytes=(\d+)-(\d*)$/i);
    if (!match) return `bytes=0-${MAX_RANGE_BYTES - 1}`;
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : start + MAX_RANGE_BYTES - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
        return `bytes=0-${MAX_RANGE_BYTES - 1}`;
    }
    return `bytes=${start}-${Math.min(requestedEnd, start + MAX_RANGE_BYTES - 1)}`;
}

function resolveAllowedAudioUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || ''));
        const pathname = decodeURIComponent(url.pathname);
        const extension = pathname.slice(pathname.lastIndexOf('.')).toLowerCase();
        if (url.protocol !== 'https:') return null;
        if (url.hostname !== ALLOWED_HOST) return null;
        if (!pathname.startsWith(ALLOWED_PATH_PREFIX)) return null;
        if (!ALLOWED_EXTENSIONS.has(extension)) return null;
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function copyUpstreamHeaders(upstream) {
    const headers = {};
    for (const name of ['accept-ranges', 'content-length', 'content-range', 'content-type', 'etag', 'last-modified']) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
    }
    headers['content-disposition'] = 'inline';
    return headers;
}

exports.handler = async (event = {}) => {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return response(405, 'Method not allowed');

    const audioUrl = resolveAllowedAudioUrl(event.queryStringParameters?.url);
    if (!audioUrl) return response(400, 'Invalid audio URL');

    const requestHeaders = {};
    if (method === 'GET') {
        requestHeaders.Range = boundedRange(event.headers?.range || event.headers?.Range);
    }

    let upstream;
    try {
        upstream = await fetch(audioUrl, { method, headers: requestHeaders, redirect: 'follow' });
    } catch {
        return response(502, 'Audio unavailable');
    }

    const headers = copyUpstreamHeaders(upstream);
    if (!upstream.ok && upstream.status !== 206) {
        return response(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, 'Audio unavailable', headers);
    }
    if (method === 'HEAD') return response(upstream.status, '', headers);

    const body = Buffer.from(await upstream.arrayBuffer()).toString('base64');
    return response(upstream.status, body, headers, true);
};

module.exports._test = { resolveAllowedAudioUrl, copyUpstreamHeaders, boundedRange };
