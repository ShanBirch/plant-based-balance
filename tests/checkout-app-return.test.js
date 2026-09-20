const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const pricingUrl = moduleUrl(read('lib/learn-course-pricing.js'));
const guardUrl = moduleUrl(read('netlify/edge-functions/lib/checkout-guard.js').replace('../../../lib/learn-course-pricing.js', pricingUrl));
const checkoutUrl = moduleUrl(read('netlify/edge-functions/create-checkout-session.js').replace('./lib/checkout-guard.js', guardUrl));

test('Stripe back returns app checkouts to the new branded app handoff, including cached app clients', async () => {
    const { default: handler } = await import(checkoutUrl);
    const originalFetch = global.fetch, originalNetlify = global.Netlify;
    const calls = [];
    global.Netlify = { env: { get: () => 'test-only' } };
    global.fetch = async (_url, options) => {
        calls.push(options.body);
        return { ok: true, json: async () => ({ id: 'cs_test_return', url: 'https://checkout.stripe.com/test' }) };
    };
    const compliance = { accepted: { terms: true, privacy: true, client_agreement: true, refund_policy: true } };
    try {
        for (const [origin, nativeApp, userAgent, appReturn] of [
            ['https://plantbased-balance.org', true, 'Android', true],
            ['https://plantbased-balance.org', undefined, 'FitGotchi-Native', true],
            ['https://balanceneurosciencefitness.com', true, 'iPhone', true],
            ['https://balanceneurosciencefitness.com', false, 'Chrome', false],
            ['https://plantbased-balance.org', false, 'Chrome', false],
        ]) {
            const response = await handler(new Request(origin + '/.netlify/functions/create-checkout-session', {
                method: 'POST', headers: { origin, 'user-agent': userAgent, 'content-type': 'application/json' },
                body: JSON.stringify({ priceId: 'balance_meta_foundations_pass', checkoutSource: 'meta_ad_trial',
                    pageVariant: 'facebook_5m_foundations_v3', nativeApp, compliance })
            }));
            assert.equal(response.status, 200);
            assert.equal(calls.at(-1).get('cancel_url'), appReturn
                ? 'https://balanceneurosciencefitness.com/checkout-return.html' : origin + '/dashboard.html');
            assert.equal(calls.at(-1).get('line_items[0][price_data][unit_amount]'), '14900');
            assert.equal(calls.at(-1).get('mode'), 'payment');
        }
        const { assertSameSiteCheckoutRequest } = await import(guardUrl);
        assert.throws(() => assertSameSiteCheckoutRequest(new Request('https://balanceneurosciencefitness.com', {
            headers: { origin: 'https://balanceneurosciencefitness.com.attacker.test' }
        })), /only available from Balance/);
    } finally { global.fetch = originalFetch; global.Netlify = originalNetlify; }
});

test('handoff launches the registered app and keeps a safe explicit retry without consuming query redirects', () => {
    for (const agent of ['Android Chrome', 'iPhone Safari', 'Desktop Chrome']) {
        const button = { href: 'com.fitgotchi.app://checkout-return' }, launches = [];
        vm.runInNewContext(read('lib/checkout-return.js'), {
            document: { getElementById: () => button }, navigator: { userAgent: agent },
            window: { location: { search: '?redirect=https://attacker.test&payment_status=paid', replace: url => launches.push(url) } }
        });
        assert.deepEqual(launches, agent.startsWith('Desktop') ? [] : ['com.fitgotchi.app://checkout-return']);
        assert.equal(button.href, agent.startsWith('Android')
            ? 'intent://checkout-return#Intent;scheme=com.fitgotchi.app;package=com.fitgotchi.app;end'
            : 'com.fitgotchi.app://checkout-return');
    }
    assert.match(read('android/app/src/main/AndroidManifest.xml'), /android:scheme="com.fitgotchi.app"/);
    assert.match(read('ios/App/App/Info.plist'), /<string>com.fitgotchi.app<\/string>/);
    assert.doesNotMatch(read('checkout-return.html'), /plantbased-balance/);
});
