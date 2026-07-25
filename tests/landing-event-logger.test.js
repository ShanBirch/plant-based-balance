const assert = require('node:assert/strict');
const test = require('node:test');

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
