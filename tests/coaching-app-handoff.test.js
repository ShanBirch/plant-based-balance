const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCoachingAppHandoff, IOS_STORE_URL, ANDROID_STORE_URL } = require('../netlify/functions/_lib/coaching-app-handoff');
const invitationUrl = 'https://balanceneurosciencefitness.com/free-starter.html?invite=private-test-token';

test('unknown phone gets both actual stores and a separately explained exact activation link', () => {
    const text = buildCoachingAppHandoff({ invitationUrl });
    assert.ok(text.includes(IOS_STORE_URL) && text.includes(ANDROID_STORE_URL));
    assert.ok(text.endsWith(invitationUrl));
    assert.match(text, /same account/);
    assert.ok(text.length <= 500);
});
test('known phone gets the matching store without losing activation', () => {
    for (const [phonePlatform, yes, no] of [['ios', IOS_STORE_URL, ANDROID_STORE_URL], ['android', ANDROID_STORE_URL, IOS_STORE_URL]]) {
        const text = buildCoachingAppHandoff({ invitationUrl, phonePlatform });
        assert.ok(text.includes(yes) && !text.includes(no));
        assert.ok(text.endsWith(invitationUrl));
    }
});
test('unverified invitation destinations and oversized handoffs fail before preparation', () => {
    for (const url of ['http://plantbased-balance.org/invite', 'https://example.com/invite', 'https://plantbased-balance.org.evil.invalid/invite']) {
        assert.throws(() => buildCoachingAppHandoff({ invitationUrl: url }));
    }
    assert.throws(() => buildCoachingAppHandoff({ invitationUrl: invitationUrl + 'a'.repeat(500) }), /limit/);
});
