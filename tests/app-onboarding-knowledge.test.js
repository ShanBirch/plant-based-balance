const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAppNavigationGuideBlock,
} = require('../netlify/functions/_lib/client-context');

test('DM drafting knowledge covers the paid handoff and real onboarding stages', () => {
    const guide = buildAppNavigationGuideBlock();

    assert.match(guide, /plantbased-balance\.org\/founders/);
    assert.match(guide, /login\.html\?action=signup/);
    assert.match(guide, /meta-app-preview\.html/);
    assert.match(guide, /guided walkthrough/i);
    assert.match(guide, /personalised setup/i);
    assert.match(guide, /AU\$19\.99\/month/);
    assert.match(guide, /Stripe Checkout/);
    assert.match(guide, /AUD \$149 once/);
    assert.match(guide, /usual blocker/i);
    assert.match(guide, /realistic weekly capacity/i);
    assert.match(guide, /Balance infers the six-week direction, starter duration, split, learning focus, and first three Weekly Goals/i);
    assert.match(guide, /payment page, account creation\/login, comeback intake/i);
    assert.match(guide, /optional cycle setup, training recommendation, calendar preview, assigned-goals summary/i);
});

test('DM drafting knowledge explains the brain angle without taking control away', () => {
    const guide = buildAppNavigationGuideBlock();

    assert.match(guide, /brain gets better at predicting and automating what it repeatedly sees the person do/i);
    assert.match(guide, /minimum action so light it can still happen on a messy day/i);
    assert.match(guide, /let the person make the final decision/i);
    assert.match(guide, /progress one variable at a time/i);
    assert.match(guide, /Never diagnose them/i);
    assert.match(guide, /what does a normal week actually have to fit around/i);
});

test('DM drafting knowledge maps every primary app tab and avoids invented fixes', () => {
    const guide = buildAppNavigationGuideBlock();

    for (const tab of ['Home:', 'Nutrition:', 'Movement:', 'Course:', 'Calendar:', 'Feed:']) {
        assert.ok(guide.includes(tab), `missing ${tab} app guidance`);
    }
    assert.match(guide, /check live account, payment, onboarding, app data/i);
    assert.match(guide, /instead of guessing/i);
});

test('DM drafting knowledge knows all active packages and routes personalised coaching by fit', () => {
    const guide = buildAppNavigationGuideBlock();

    assert.match(guide, /App \+ Community, AU\$19\.99\/month/i);
    assert.match(guide, /Online Coaching.+AU\$29\.99.+AU\$49\.99.+AU\$74\.99/i);
    assert.match(guide, /Coaching \+ Calls, AU\$99\.99\/week/i);
    assert.match(guide, /personalised, individual, one-to-one or weekly plan adjustment usually fits Online Coaching/i);
    assert.match(guide, /regular calls, deeper live support.+fits Coaching \+ Calls/i);
    assert.match(guide, /coaching\.html/);
    assert.match(guide, /Balance Learn, one AU\$149 payment.+fixed six-week course/i);
    assert.match(guide, /does not auto-renew/i);
    assert.match(guide, /Do not dump every package/i);
});
