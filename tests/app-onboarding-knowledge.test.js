const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildAppNavigationGuideBlock,
} = require('../netlify/functions/_lib/client-context');

test('DM drafting knowledge covers the paid handoff and real onboarding stages', () => {
    const guide = buildAppNavigationGuideBlock();

    assert.match(guide, /plant-based-fitness\.html/);
    assert.match(guide, /login\.html\?action=signup/);
    assert.match(guide, /three realistic weekly anchors/i);
    assert.match(guide, /main thing that knocks them off track/i);
    assert.match(guide, /real competing priorities such as work\/kids\/study\/caring/i);
    assert.match(guide, /intentionally easy starter-session length/i);
    assert.match(guide, /payment page, account creation\/login, conversational intake/i);
    assert.match(guide, /training setup, nutrition setup, profile\/character, Weekly Goals/i);
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

    for (const tab of ['Home:', 'Nutrition:', 'Movement:', 'Learn:', 'Calendar:', 'Feed:']) {
        assert.ok(guide.includes(tab), `missing ${tab} app guidance`);
    }
    assert.match(guide, /check live account, payment, onboarding, app data/i);
    assert.match(guide, /instead of guessing/i);
});

test('DM drafting knowledge knows all active packages and routes personalised coaching by fit', () => {
    const guide = buildAppNavigationGuideBlock();

    assert.match(guide, /App \+ Community, AU\$19\.99\/month/i);
    assert.match(guide, /Starter Coaching, AU\$29\.99\/week/i);
    assert.match(guide, /Coaching \+ Calls, AU\$99\.99\/week/i);
    assert.match(guide, /personalised, individual, one-to-one or weekly plan adjustment usually fits Starter Coaching/i);
    assert.match(guide, /regular calls, deeper live support.+fits Coaching \+ Calls/i);
    assert.match(guide, /coaching\.html/);
    assert.match(guide, /Do not dump all four packages/i);
});
