const crypto = require('crypto');

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const numericId = value => /^\d+$/.test(String(value || '')) ? String(value) : '';

function configuredPageIds(env = process.env) {
    return String(env.FACEBOOK_PAGE_IDS || env.FACEBOOK_PAGE_ID || '').split(',').map(v => numericId(v.trim())).filter(Boolean);
}

function resolveMessengerRoute(thread, env = process.env) {
    if (thread?.channel !== 'messenger') return null;
    const graph = object(thread.custom_data?.facebook_messenger);
    const pageId = numericId(graph.page_id);
    const recipientId = numericId(graph.psid);
    // Identity comes only from the canonical, Page-scoped thread. Never use an
    // Instagram ID or an old ManyChat subscriber as a Messenger recipient.
    if (!pageId || !recipientId || !configuredPageIds(env).includes(pageId)
        || thread.subscriber_id !== `fb_graph:${pageId}:${recipientId}`) return null;
    return { pageId, recipientId };
}

function isMessengerWindowOpen(lastInboundAt, now = Date.now()) {
    const timestamp = Date.parse(lastInboundAt || '');
    return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < 24 * 60 * 60 * 1000;
}

function verifyMessengerSignature(body, signature, secret) {
    if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature || '')) return false;
    const expected = crypto.createHmac('sha256', secret).update(body).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

function normalizeMessengerEvents(payload, pageIds, now = Date.now()) {
    if (payload?.object !== 'page') return [];
    const result = [];
    for (const entry of payload.entry || []) {
        const pageId = numericId(entry.id);
        if (!pageIds.includes(pageId)) continue;
        for (const event of entry.messaging || []) {
            const echo = event.message?.is_echo === true;
            const owner = numericId(echo ? event.sender?.id : event.recipient?.id);
            const psid = numericId(echo ? event.recipient?.id : event.sender?.id);
            if (owner !== pageId || !psid || psid === pageId) continue;
            const timestamp = Number(event.timestamp);
            if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now + 60000) continue;
            const at = new Date(Math.min(timestamp, now)).toISOString();
            const referral = object(event.referral || event.postback?.referral || event.message?.referral);
            // User-supplied ref/query strings do not establish paid attribution.
            const ad = !echo && referral.source === 'ADS' ? {
                source: 'meta_ads', platform_source: 'ADS', platform: 'facebook',
                ad_id: numericId(referral.ad_id) || null,
                ref: String(referral.ref || '').slice(0, 500),
            } : null;
            const message = object(event.message);
            const parts = [];
            const text = message.text || event.postback?.title;
            if (text) parts.push(String(text));
            for (const attachment of message.attachments || []) {
                const marker = { image: 'PHOTO', video: 'VIDEO', audio: 'AUDIO', file: 'FILE' }[attachment.type];
                const url = String(attachment.payload?.url || '');
                if (marker && /^https:\/\//.test(url) && !/[\s\[\]]/.test(url)) parts.push(`[${marker}:${url}]`);
            }
            if (!parts.length && message.sticker_id) parts.push('[sticker]');
            // A postback may lack a mid. Scope its stable hash to Page, sender,
            // timestamp and payload so retries dedupe without merging later taps.
            const mid = message.mid || event.postback?.mid || (event.postback
                ? crypto.createHash('sha256').update(JSON.stringify([pageId, psid, timestamp, event.postback])).digest('hex') : '');
            if ((!mid || !parts.length) && !ad) continue;
            result.push({ pageId, psid, at, ad, direction: echo ? 'out' : 'in',
                messageId: mid ? `fb_graph:${pageId}:${mid}` : null,
                text: parts.join('\n'), attributionOnly: !mid || !parts.length });
        }
    }
    return result;
}

function mergeMessengerData(prior, event) {
    const result = { ...object(prior), delivery_channel: 'facebook_messenger',
        facebook_messenger: { ...object(prior?.facebook_messenger), page_id: event.pageId, psid: event.psid, source: 'facebook_messenger' } };
    const lastRoutingAt = Date.parse(prior?.current_inbound_routing?.received_at || '');
    if (event.direction === 'in' && Number.isFinite(lastRoutingAt) && Date.parse(event.at) < lastRoutingAt) return result;
    const previous = object(prior?.meta_ad_attribution);
    const pendingAge = Date.parse(event.at) - Date.parse(previous.last_referral_at || '');
    const pending = event.direction === 'in' && previous.awaiting_message === true && pendingAge >= 0 && pendingAge <= 30 * 60 * 1000;
    const effectiveAd = event.ad || (pending ? previous : null);
    if (effectiveAd) {
        result.meta_ad_attribution = { ...previous, ...effectiveAd,
            first_referral_at: previous.first_referral_at || event.at,
            last_referral_at: event.ad ? event.at : previous.last_referral_at,
            last_message_id: event.messageId || previous.last_message_id || null,
            awaiting_message: event.attributionOnly };
        result.latest_paid_acquisition = 'meta_ads';
        result.acquisition_source = 'meta_ads';
    }
    if (event.direction === 'in' && !event.attributionOnly) result.current_inbound_routing = {
        source: effectiveAd ? 'meta_ads' : 'facebook_messenger', message_id: event.messageId,
        received_at: event.at, ad_id: effectiveAd?.ad_id || null,
    };
    return result;
}

async function getMessengerToken(pageId, query, env = process.env) {
    if (!configuredPageIds(env).includes(pageId)) return '';
    const scoped = env[`FACEBOOK_PAGE_ACCESS_TOKEN_${pageId}`];
    if (scoped) return scoped;
    if (env.FACEBOOK_PAGE_ID === pageId && env.FACEBOOK_PAGE_ACCESS_TOKEN) return env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const rows = await query(`app_private_secrets?select=value&key=eq.facebook_page_access_token_${pageId}&limit=1`);
    return String(rows?.[0]?.value || '');
}

function buildMessengerMessage(item) {
    if (item.kind === 'link_button') {
        return { attachment: { type: 'template', payload: { template_type: 'button',
            text: item.displayText || 'Your Balance preview is ready',
            buttons: [{ type: 'web_url', url: item.url, title: item.title || 'View preview' }] } } };
    }
    if (item.kind === 'video' || item.kind === 'image') {
        return { attachment: { type: item.kind, payload: { url: item.videoUrl || item.imageUrl, is_reusable: true } } };
    }
    if (item.kind !== 'text') throw new Error('Unsupported Messenger attachment');
    return { text: item.text };
}

async function sendMessengerItem({ route, item, token, lastInboundAt, fetchImpl = fetch, now = Date.now(), env = process.env }) {
    if (!configuredPageIds(env).includes(route?.pageId) || !numericId(route?.recipientId) || !token) throw new Error('Messenger connection is not configured');
    if (!isMessengerWindowOpen(lastInboundAt, now)) throw new Error('Messenger 24-hour reply window is closed');
    const response = await fetchImpl(`https://graph.facebook.com/${env.FACEBOOK_GRAPH_API_VERSION || 'v25.0'}/${route.pageId}/messages`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: route.recipientId }, messaging_type: 'RESPONSE', message: buildMessengerMessage(item) }),
    });
    const data = await response.json();
    if (!response.ok || data.error || !data.message_id) throw new Error(`Messenger send failed (${data.error?.code || response.status})`);
    return data;
}

module.exports = { configuredPageIds, resolveMessengerRoute, isMessengerWindowOpen,
    verifyMessengerSignature, normalizeMessengerEvents, mergeMessengerData, getMessengerToken,
    buildMessengerMessage, sendMessengerItem };
