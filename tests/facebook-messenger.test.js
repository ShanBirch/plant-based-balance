const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const messenger = require('../netlify/functions/_lib/facebook-messenger');
const webhook = require('../netlify/functions/facebook-webhook');
const now = Date.parse('2026-09-14T05:00:00Z');
const env = { FACEBOOK_PAGE_ID: '123' };
const inbound = (extra = {}) => ({ sender: { id: '456' }, recipient: { id: '123' },
    timestamp: now, message: { mid: 'm1', text: 'BALANCE' }, ...extra });
const payload = events => ({ object: 'page', entry: [{ id: '123', messaging: events }] });

test('only configured Page messages establish a Page-scoped recipient', () => {
    const events = messenger.normalizeMessengerEvents(payload([inbound()]), ['123'], now);
    assert.equal(events.length, 1);
    assert.equal(events[0].messageId, 'fb_graph:123:m1');
    assert.equal(events[0].ad, null);
    assert.equal(messenger.normalizeMessengerEvents(payload([inbound()]), ['789'], now).length, 0);
    assert.equal(messenger.normalizeMessengerEvents({ ...payload([inbound()]), object: 'instagram' }, ['123'], now).length, 0);
    assert.equal(messenger.normalizeMessengerEvents(payload([inbound({ recipient: { id: '789' } })]), ['123'], now).length, 0);
    const thread = { channel: 'messenger', subscriber_id: 'fb_graph:123:456', custom_data: { facebook_messenger: { page_id: '123', psid: '456' } } };
    assert.deepEqual(messenger.resolveMessengerRoute(thread, env), { pageId: '123', recipientId: '456' });
    for (const subscriber_id of ['456', 'ig_graph:456', 'fb_graph:789:456']) {
        assert.equal(messenger.resolveMessengerRoute({ ...thread, subscriber_id }, env), null);
    }
    assert.equal(messenger.resolveMessengerRoute({ ...thread, channel: 'instagram' }, env), null);
});

test('ad referrals persist across later ordinary messages and user ref strings do not fake attribution', () => {
    const [ad] = messenger.normalizeMessengerEvents(payload([inbound({ referral: { source: 'ADS', ad_id: '999', ref: 'campaign' } })]), ['123'], now);
    let data = messenger.mergeMessengerData({ manual_hold: true }, ad);
    assert.equal(data.meta_ad_attribution.ad_id, '999');
    const [ordinary] = messenger.normalizeMessengerEvents(payload([inbound({ message: { mid: 'm2', text: 'Thanks' } })]), ['123'], now);
    data = messenger.mergeMessengerData(data, ordinary);
    assert.equal(data.meta_ad_attribution.ad_id, '999');
    assert.equal(data.manual_hold, true);
    const latest = messenger.mergeMessengerData(data, { ...ordinary, at: new Date(now + 1000).toISOString(), messageId: 'fb_graph:123:m3' });
    assert.deepEqual(messenger.mergeMessengerData(latest, ad).current_inbound_routing, latest.current_inbound_routing,
        'late webhook retries must not replace newer conversation routing');
    const [fake] = messenger.normalizeMessengerEvents(payload([inbound({ referral: { source: 'SHORTLINK', ref: 'source=ADS&ad_id=999' } })]), ['123'], now);
    assert.equal(fake.ad, null);
    const [referralOnly] = messenger.normalizeMessengerEvents(payload([inbound({ message: undefined, referral: { source: 'ADS', ad_id: '999' } })]), ['123'], now);
    assert.equal(referralOnly.attributionOnly, true);
});

test('postbacks dedupe, media is retained, and echoes cannot trigger an inbound reply', () => {
    const postback = inbound({ message: undefined, postback: { title: 'Tell me more', payload: 'BALANCE' } });
    const [first, duplicate] = messenger.normalizeMessengerEvents(payload([postback, postback]), ['123'], now);
    assert.equal(first.messageId, duplicate.messageId);
    assert.equal(first.text, 'Tell me more');
    const [echo] = messenger.normalizeMessengerEvents(payload([inbound({ sender: { id: '123' }, recipient: { id: '456' },
        message: { mid: 'out1', text: 'Hello', is_echo: true }, referral: { source: 'ADS' } })]), ['123'], now);
    assert.equal(echo.direction, 'out');
    assert.equal(echo.ad, null);
    const [media] = messenger.normalizeMessengerEvents(payload([inbound({ message: { mid: 'media1', attachments: [{ type: 'image', payload: { url: 'https://example.com/photo.jpg' } }] } })]), ['123'], now);
    assert.equal(media.text, '[PHOTO:https://example.com/photo.jpg]');
});

test('webhook signature requires the exact bytes and a configured secret', () => {
    const body = Buffer.from(JSON.stringify(payload([inbound()])));
    const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(body).digest('hex');
    assert.equal(messenger.verifyMessengerSignature(body, signature, 'test-secret'), true);
    assert.equal(messenger.verifyMessengerSignature(Buffer.concat([body, Buffer.from(' ')]), signature, 'test-secret'), false);
    assert.equal(messenger.verifyMessengerSignature(body, signature, ''), false);
    assert.equal(messenger.verifyMessengerSignature(body, 'sha256=oops', 'test-secret'), false);
});

test('text, native preview button and video use Facebook directly with standard RESPONSE messaging', async () => {
    const calls = [];
    const fetchImpl = async (url, options) => { calls.push({ url, ...options }); return { ok: true, json: async () => ({ recipient_id: '456', message_id: 'sent1' }) }; };
    const args = { route: { pageId: '123', recipientId: '456' }, token: 'test-token', lastInboundAt: new Date(now).toISOString(), now, fetchImpl, env };
    for (const item of [{ kind: 'text', text: 'Hello' }, { kind: 'link_button', displayText: 'Your preview', url: 'https://plantbased-balance.org/p/signed', title: 'View preview' }, { kind: 'video', videoUrl: 'https://example.com/video.mp4' }]) {
        assert.equal((await messenger.sendMessengerItem({ ...args, item })).message_id, 'sent1');
    }
    for (const call of calls) {
        assert.equal(call.url, 'https://graph.facebook.com/v25.0/123/messages');
        const body = JSON.parse(call.body);
        assert.equal(body.messaging_type, 'RESPONSE');
        assert.deepEqual(body.recipient, { id: '456' });
        assert.equal(body.tag, undefined);
    }
    assert.equal(JSON.parse(calls[1].body).message.attachment.payload.buttons[0].url, 'https://plantbased-balance.org/p/signed');
    assert.equal(JSON.parse(calls[2].body).message.attachment.type, 'video');
    await assert.rejects(messenger.sendMessengerItem({ ...args, item: { kind: 'text', text: 'Hello' }, lastInboundAt: new Date(now - 86400000).toISOString() }), /24-hour/);
    assert.equal(calls.length, 3, 'closed-window send never reaches Meta');
    assert.equal(messenger.isMessengerWindowOpen(new Date(now + 1000).toISOString(), now), false);
    await assert.rejects(messenger.sendMessengerItem({ ...args, item: { kind: 'text', text: 'Hello' }, fetchImpl: async () => ({ ok: true, json: async () => ({ error: { code: 200 } }) }) }), /failed/);
});

function database() {
    let thread = null;
    let alertRow = null;
    const messages = new Map();
    let dispatches = 0;
    let failDispatch = false;
    const query = async (path, options = {}) => {
        if (path.startsWith('app_private_secrets?select=value&key=eq.messenger_review_proof_')) return [];
        if (path.startsWith('users?')) return [{ id: 'coach' }];
        if (path.startsWith('ig_threads')) {
            // Production uniqueness is the subscriber/channel pair.
            if (options.method === 'POST') assert.equal(path, 'ig_threads?on_conflict=subscriber_id,channel');
            if (!options.method) assert.ok(path.includes('&channel=eq.messenger'));
            if (options.method === 'POST') thread ||= { id: 'thread', updated_at: 'version1', ...options.body };
            if (options.method === 'PATCH') thread = { ...thread, ...options.body, updated_at: `version${dispatches + 2}` };
            return thread ? [thread] : [];
        }
        if (path.startsWith('ig_messages')) {
            if (!options.method) return [{ id: 'message' }];
            const message = options.body;
            if (messages.has(message.manychat_message_id)) throw Object.assign(new Error('duplicate'), { sqlstate: '23505' });
            messages.set(message.manychat_message_id, message);
            return [{ id: 'message', ...message }];
        }
        if (path.startsWith('coach_alerts?')) return alertRow ? [alertRow] : [];
        if (path.startsWith('ig_next_actions?')) return [];
        if (path === 'rpc/upsert_ig_next_action') return [{ id: 'action' }];
        throw new Error('Unexpected query: ' + path);
    };
    return { messages, get thread() { return thread; }, get alertRow() { return alertRow; }, get dispatches() { return dispatches; },
        set failDispatch(value) { failDispatch = value; },
        dependencies: { query, alert: async row => { alertRow ||= { id: 'alert', ...row }; return { alertId: 'alert' }; },
            fetchImpl: async (url, options) => { assert.ok(url.endsWith('/ig-instant-draft-background')); dispatches++; if (failDispatch) return { ok: false }; const body = JSON.parse(options.body); assert.equal(body.channel, 'messenger'); assert.equal(body.customData.meta_ad_attribution.ad_id, '999'); alertRow.data.draft_text = 'Reviewed reply'; alertRow.data.draft_error = null; return { ok: true }; } } };
}

test('intake persists attribution, one message and one alert; duplicate or echo never sends another reply', async () => {
    const db = database();
    const events = messenger.normalizeMessengerEvents(payload([inbound({ referral: { source: 'ADS', ad_id: '999' } })]), ['123'], now);
    await webhook._test.processEvents(events, db.dependencies);
    await webhook._test.processEvents(events, db.dependencies);
    assert.equal(db.messages.size, 1);
    assert.equal(db.dispatches, 1);
    assert.equal(db.thread.custom_data.acquisition_mode, 'paid_meta');
    assert.equal(db.thread.auto_send_enabled, false, 'paid pipeline applies its existing gates; no blanket opt-in');
    const echo = { ...events[0], ad: null, direction: 'out', messageId: 'fb_graph:123:out1' };
    await webhook._test.processEvents([echo], db.dependencies);
    assert.equal(db.messages.size, 2);
    assert.equal(db.dispatches, 1);
});

test('failed draft handoff can retry the stored inbound without losing it or duplicating it', async () => {
    const db = database();
    const events = messenger.normalizeMessengerEvents(payload([inbound({ referral: { source: 'ADS', ad_id: '999' } })]), ['123'], now);
    db.failDispatch = true;
    await assert.rejects(webhook._test.processEvents(events, db.dependencies), /dispatch failed/);
    assert.equal(db.messages.size, 1);
    assert.equal(db.alertRow.data.draft_error, 'draft_generation_pending');
    db.failDispatch = false;
    await webhook._test.processEvents(events, db.dependencies);
    assert.equal(db.messages.size, 1);
    assert.equal(db.dispatches, 2);
});

test('review pairing messages are persisted but never sent to the sales draft pipeline', async () => {
    const db = database();
    const events = messenger.normalizeMessengerEvents(payload([inbound({message:{mid:'pair1',text:'BALANCE REVIEW '+ 'a'.repeat(32)}})]), ['123'], now);
    await webhook._test.processEvents(events, db.dependencies);
    assert.equal(db.messages.size, 1);
    assert.equal(db.dispatches, 0);
    assert.equal(db.alertRow, null);
});
