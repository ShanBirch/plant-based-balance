const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('landing event logger preserves experiment attribution and funnel metadata', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const originalFetch = global.fetch;
    let request;
    global.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true, status: 201, text: async () => '' };
    };

    try {
        delete require.cache[require.resolve('../netlify/functions/log-lp-event.js')];
        const { handler } = require('../netlify/functions/log-lp-event.js');
        const response = await handler({
            httpMethod: 'POST',
            body: JSON.stringify({
                event_id: 'event-test-1',
                event_type: 'checkout_started',
                session_id: 'session-test-1',
                visitor_id: 'visitor-test-1',
                landing_page: 'fitness-coaching',
                page_variant: 'broad_pain',
                page_url: 'https://plantbased-balance.org/fitness-coaching.html?utm_content=b1',
                utm_source: 'instagram',
                utm_medium: 'paid_social',
                utm_campaign: 'founders_pass_test',
                utm_content: 'b1-stop-starting-over',
                fbclid: 'test-click-id',
                metadata: { ad_id: '123', plan: 'founders-pass' },
            }),
        });

        assert.equal(response.statusCode, 200);
        assert.match(request.url, /\/rest\/v1\/lp_events$/);
        const rows = JSON.parse(request.options.body);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].page_variant, 'broad_pain');
        assert.equal(rows[0].utm_content, 'b1-stop-starting-over');
        assert.equal(rows[0].metadata.ad_id, '123');
    } finally {
        global.fetch = originalFetch;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
});

test('browser analytics captures exact Meta identifiers without throwing', async () => {
    const makeStorage = () => {
        const values = new Map();
        return {
            getItem: key => values.get(key) || null,
            setItem: (key, value) => values.set(key, String(value)),
        };
    };
    const requests = [];
    const window = {
        location: {
            search: '?utm_source=instagram&utm_medium=dm&campaign_id=campaign-1&adset_id=adset-2&ad_id=ad-3&creative_id=creative-4&placement=instagram_reels&meta_ad_name=A1+Brain+Angle&meta_ref=balance_a1',
            href: 'https://plantbased-balance.org/plant-based-fitness.html?ad_id=ad-3',
            pathname: '/plant-based-fitness.html',
        },
        crypto: { randomUUID: () => 'fixed-id' },
        innerWidth: 390,
        innerHeight: 844,
        scrollY: 0,
        addEventListener: () => {},
    };
    const document = {
        readyState: 'loading',
        title: 'Balance Founders Pass',
        referrer: '',
        visibilityState: 'visible',
        body: { dataset: { landingVariant: 'plant_based_control', landingPage: 'plant-based-fitness' } },
        documentElement: { dataset: {}, scrollHeight: 1200 },
        querySelector: () => ({}),
        addEventListener: () => {},
        head: { appendChild: () => {} },
    };
    const context = {
        window,
        document,
        localStorage: makeStorage(),
        sessionStorage: makeStorage(),
        navigator: { userAgent: 'test-agent', sendBeacon: () => true },
        URLSearchParams,
        Blob,
        Date,
        Math,
        JSON,
        fetch: async (url, options) => {
            requests.push({ url, options });
            return { ok: true };
        },
        crypto: window.crypto,
        setTimeout,
        clearTimeout,
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'analytics.js'), 'utf8'),
        context,
        { filename: 'analytics.js' }
    );

    const attribution = window.getAttributionData();
    assert.equal(attribution.campaign_id, 'campaign-1');
    assert.equal(attribution.adset_id, 'adset-2');
    assert.equal(attribution.ad_id, 'ad-3');
    assert.equal(attribution.creative_id, 'creative-4');
    assert.equal(attribution.meta_ad_name, 'A1 Brain Angle');
    assert.equal(attribution.meta_ref, 'balance_a1');

    window.trackBalanceEvent('checkout_click', { target: 'founders-pass' });
    await Promise.resolve();
    const payload = JSON.parse(requests.at(-1).options.body);
    assert.equal(payload.metadata.creative_id, 'creative-4');
    assert.equal(payload.metadata.meta_ref, 'balance_a1');
    assert.equal(payload.metadata.target, 'founders-pass');
});

test('coach welcome analytics persist exact events without scheduling payment follow-ups', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (url, options) => {
        requests.push({url, options});
        return {ok:true,status:201,text:async()=>''};
    };
    try {
        delete require.cache[require.resolve('../netlify/functions/log-lp-event.js')];
        const {handler}=require('../netlify/functions/log-lp-event.js');
        for(const event_type of ['coach_welcome_viewed','coach_welcome_dismissed','coach_welcome_call_clicked']) {
            await handler({httpMethod:'POST',body:JSON.stringify({event_type,event_id:event_type,session_id:'session-test',visitor_id:'visitor-test',landing_page:'meta-app-preview',metadata:{variant:'onboarding_coach_message_v1'}})});
        }
        assert.equal(requests.length,3);
        for(const request of requests) {
            assert.match(request.url,/\/rest\/v1\/lp_events$/);
            const [row]=JSON.parse(request.options.body);
            assert.equal(row.metadata.variant,'onboarding_coach_message_v1');
            assert.ok(row.event_type.startsWith('coach_welcome_'));
        }
    } finally {global.fetch=originalFetch;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
});
