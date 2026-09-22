const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('analytics.js', 'utf8');

function browser({ search = '', referrer = '', blocked = false, previous = null, beacon = true } = {}) {
    const values = new Map(previous ? [['balance_first_touch', JSON.stringify(previous)], ['balance_last_touch', JSON.stringify(previous)]] : []);
    const storage = { getItem(k) { if (blocked) throw Error('blocked'); return values.get(k) || null; }, setItem(k,v) { if (blocked) throw Error('blocked'); values.set(k,v); } };
    const events = [], handlers = {}, appended = [];
    let serial = 0;
    const document = {
        currentScript: { dataset: { firstPartyOnly: 'true' } },
        readyState: 'complete', title: 'Balance', referrer, cookie: '', visibilityState: 'visible',
        body: { dataset: { landingPage: 'bio' } }, documentElement: { dataset: {}, scrollHeight: 3000 },
        addEventListener(name, handler, capture) { handlers[name] = { handler, capture }; },
        querySelector: () => null, createElement: () => ({}), head: { appendChild: x => appended.push(x) }
    };
    const window = { location: { search, href: 'https://balanceneurosciencefitness.com/bio' + search, pathname: '/bio' },
        crypto: { randomUUID: () => 'id-' + ++serial }, innerWidth: 390, innerHeight: 844, scrollY: 0,
        addEventListener(name, handler) { handlers[name] = { handler }; }
    };
    const context = { window, document, localStorage: storage, sessionStorage: storage, URL, URLSearchParams, Blob,
        navigator: { userAgent: 'Chrome Android', sendBeacon(url, body) { if (beacon) events.push(body.text().then(JSON.parse)); return beacon; } },
        crypto: window.crypto, fetch: async (url, opts) => { events.push(Promise.resolve(JSON.parse(opts.body))); return { ok: true }; }
    };
    vm.runInNewContext(source, context);
    function click(href, extra = {}) {
        const link = { id: 'download', dataset: { track: 'cta_click', ...extra }, classList: { contains: () => false },
            innerText: 'Download Balance', getAttribute: k => k === 'href' ? href : null };
        handlers.click.handler({ target: { closest: () => link } });
    }
    return { window, context, events, handlers, appended, click };
}

test('new public pages record visits and captured store handoffs without loading ad/GA scripts', async () => {
    const b = browser({ search: '?utm_source=ig&utm_medium=social&analytics_test=1' });
    b.click('https://apps.apple.com/app/id6761238161');
    b.click(null, { trackHref: 'https://play.google.com/store/apps/details?id=com.fitgotchi.app' });
    const events = await Promise.all(b.events);
    assert.deepEqual(events.map(e => e.event_type), ['page_view', 'cta_click', 'app_download_click', 'cta_click', 'app_download_click']);
    assert.deepEqual(events.filter(e => e.event_type === 'app_download_click').map(e => e.metadata.platform), ['ios', 'android']);
    assert.ok(events.every(e => e.metadata.test_mode && e.utm_source === 'ig'));
    assert.equal(b.handlers.click.capture, true);
    assert.equal(b.appended.length, 0);
    vm.runInNewContext(source, b.context);
    assert.equal(b.events.length, 5, 'a duplicate script does not double count');
});

test('blocked storage and rejected beacons do not lose clicks or break navigation', async () => {
    const b = browser({ blocked: true, beacon: false });
    b.click('https://play.google.com/store/apps/details?id=com.fitgotchi.app');
    const events = await Promise.all(b.events);
    assert.equal(events.length, 3);
    assert.ok(events.every(e => e.visitor_id === events[0].visitor_id && e.session_id === events[0].session_id));
});

test('organic arrival does not inherit an old paid campaign and referrers are not labelled paid', async () => {
    const old = { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'old', ad_id: 'old-ad' };
    const b = browser({ search: '?utm_source=ig&utm_medium=social', previous: old });
    const event = (await Promise.all(b.events))[0];
    assert.equal(event.utm_campaign, null);
    assert.equal(event.metadata.ad_id, undefined);
    assert.equal(b.window.getAttributionData().first_touch.utm_campaign, 'old');
    const ref = browser({ referrer: 'https://l.instagram.com/' });
    const visit = (await Promise.all(ref.events))[0];
    assert.equal(visit.utm_source, 'instagram');
    assert.equal(visit.utm_medium, 'referral');
});

test('public entry routes load the shared tracker once', () => {
    for (const name of ['bio','balance','coaching','journey','clients','book','index']) {
        const html = fs.readFileSync(name + '.html', 'utf8');
        assert.equal((html.match(/src="\/analytics\.js\?v=public-funnel-20260922"/g) || []).length, 1, name);
        assert.match(html, /data-first-party-only="true"/);
    }
});

test('server accepts download events and does not report a failed write as success', async () => {
    const originalFetch = global.fetch;
    const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test';
    delete require.cache[require.resolve('../netlify/functions/log-lp-event')];
    const { handler } = require('../netlify/functions/log-lp-event');
    const event = { httpMethod: 'POST', body: JSON.stringify({ event_type: 'app_download_click', landing_page: 'bio', session_id: 'test', metadata: { platform: 'ios', test_mode: true } }) };
    try {
        let rows;
        global.fetch = async (url, opts) => { rows = JSON.parse(opts.body); return { ok: true, text: async () => '' }; };
        assert.equal((await handler(event)).statusCode, 200);
        assert.equal(rows[0].event_type, 'app_download_click');
        global.fetch = async () => ({ ok: false, status: 503, text: async () => 'unavailable' });
        assert.equal((await handler(event)).statusCode, 503);
    } finally {
        global.fetch = originalFetch;
        if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    }
});
