function resolveAllowedAudioUrl(rawUrl) {
    try {
        const url = new URL(String(rawUrl || ''));
        const pathname = decodeURIComponent(url.pathname);
        const extension = pathname.slice(pathname.lastIndexOf('.')).toLowerCase();
        if (url.protocol !== 'https:') return null;
        if (url.hostname !== 'f005.backblazeb2.com') return null;
        if (!pathname.startsWith('/file/plantbasedbalancestories/chats/')) return null;
        if (!['.mp3', '.m4a', '.wav'].includes(extension)) return null;
        url.hash = '';
        return url.toString();
    } catch {
        return null;
    }
}

function boundedRange(rawRange) {
    const maxRangeBytes = 1024 * 1024;
    const value = String(rawRange || '').trim();
    const match = value.match(/^bytes=(\d+)-(\d*)$/i);
    if (!match) return `bytes=0-${maxRangeBytes - 1}`;
    const start = Number(match[1]);
    const requestedEnd = match[2] ? Number(match[2]) : start + maxRangeBytes - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
        return `bytes=0-${maxRangeBytes - 1}`;
    }
    return `bytes=${start}-${Math.min(requestedEnd, start + maxRangeBytes - 1)}`;
}

function proxyResponseHeaders(upstream) {
    const headers = new Headers({
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
    });
    for (const name of ['accept-ranges', 'content-length', 'content-range', 'content-type', 'etag', 'last-modified']) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }
    return headers;
}

export default async (req) => {
    const method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        return new Response('Method not allowed', { status: 405 });
    }

    const requestUrl = new URL(req.url);
    const audioUrl = resolveAllowedAudioUrl(requestUrl.searchParams.get('url'));
    if (!audioUrl) return new Response('Invalid audio URL', { status: 400 });

    const requestHeaders = new Headers();
    if (method === 'GET') requestHeaders.set('Range', boundedRange(req.headers.get('range')));

    let upstream;
    try {
        upstream = await fetch(audioUrl, { method, headers: requestHeaders, redirect: 'follow' });
    } catch {
        return new Response('Audio unavailable', { status: 502 });
    }

    if (!upstream.ok && upstream.status !== 206) {
        const status = upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
        return new Response('Audio unavailable', { status, headers: proxyResponseHeaders(upstream) });
    }

    return new Response(method === 'HEAD' ? null : upstream.body, {
        status: upstream.status,
        headers: proxyResponseHeaders(upstream),
    });
};

export const config = { path: '/api/chat-audio' };
export { resolveAllowedAudioUrl, boundedRange, proxyResponseHeaders };
