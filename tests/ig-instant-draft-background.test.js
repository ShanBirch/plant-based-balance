const test = require('node:test');
const assert = require('node:assert/strict');

const { resolvePaidMetaInboundSettleDelayMs } = require('../netlify/functions/ig-instant-draft-background')._test;

test('paid Meta messages get a short settling window for multi-bubble replies', () => {
    assert.equal(resolvePaidMetaInboundSettleDelayMs({
        customData: { meta_ad_attribution: { source: 'meta_ads' } },
    }), 10000);
    assert.equal(resolvePaidMetaInboundSettleDelayMs({
        customData: { internal_test_auto_reply_enabled: true },
    }), 10000);
    assert.equal(resolvePaidMetaInboundSettleDelayMs({
        customData: { meta_ad_attribution: { source: 'meta_ads' } },
        paidMetaLiveChat: true,
    }), 1500, 'an established paid-ad chat keeps only a brief rapid-bubble window');
    assert.equal(resolvePaidMetaInboundSettleDelayMs({ customData: {} }), 0);
});
