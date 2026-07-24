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
    assert.match(guide, /payment page, account creation\/login, conversational intake/i);
    assert.match(guide, /training setup, nutrition setup, profile\/character, Weekly Goals/i);
});

test('DM drafting knowledge maps every primary app tab and avoids invented fixes', () => {
    const guide = buildAppNavigationGuideBlock();

    for (const tab of ['Home:', 'Nutrition:', 'Movement:', 'Learn:', 'Calendar:', 'Feed:']) {
        assert.ok(guide.includes(tab), `missing ${tab} app guidance`);
    }
    assert.match(guide, /check live account, payment, onboarding, app data/i);
    assert.match(guide, /instead of guessing/i);
});
