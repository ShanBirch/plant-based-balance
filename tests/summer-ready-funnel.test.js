const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../netlify/functions/_lib/plant-based-challenge-dm');
const thread = {created_at:'2026-08-01T00:00:00Z',custom_data:{bot_account:'shan_n_sunny',meta_ad_attribution:{ad_id:'120255351900560119',campaign_id:'120255351900570119'}}};

test('the actual Summer Ready ad and campaign route free-written enquiries and continuing replies', () => {
    for (const currentMessage of ['BALANCE', 'How does it work?', 'I want to get stronger', 'Yes please']) {
        assert.equal(policy.resolveChallengeLeadRoute({thread,currentMessage}),true);
        assert.equal(policy.resolveChallengeLeadRoute({thread:{...thread,linked_user_id:'member'},currentMessage}),false);
    }
    const otherAd={...thread,custom_data:{bot_account:'shan_n_sunny',meta_ad_attribution:{ad_id:'old-ad'}}};
    assert.equal(policy.resolveChallengeLeadRoute({thread:otherAd,currentMessage:'BALANCE'}),false);
    assert.equal(policy.resolveChallengeLeadRoute({thread:otherAd,currentMessage:'BALANCE, I would like details about the 10-week Summer Ready Shred starting 5 October.'}),true);
    assert.equal(policy.resolveChallengeLeadRoute({thread:{...thread,custom_data:{bot_account:'shan_n_sunny',current_inbound_routing:{campaign_id:'120255351900570119',ad_id:'another-creative'}}},currentMessage:'How does it work?'}),true);
});

test('the included six-week course cannot divert a challenge enquiry to legacy checkout', () => {
    const currentMessage='Is the six-week Balance Learn course included in the challenge?';
    assert.equal(policy.resolveChallengeLeadRoute({thread,currentMessage}),true);
    assert.equal(policy.resolveChallengeLeadRoute({thread,currentMessage:'What about meals?',history:[{direction:'in',text:currentMessage},{direction:'out',text:'Yes, the six-week course is included.'}]}),true);
    assert.equal(policy.resolveChallengeLeadRoute({thread,currentMessage:'I want the Founders Pass checkout link instead'}),false);
});

test('challenge price, duration and launch evidence agrees with the public offer', () => {
    const prompt=policy.buildChallengeLeadPrompt();
    for(const fact of ['Summer Ready Shred','5 October 2026','all genders','AUD $75/week','AUD $125/week','AUD $120','AUD $870','AUD $1,370','six-week Learn course','60-minute video call']) assert.ok(prompt.includes(fact),fact);
    assert.doesNotMatch(prompt,/No universal challenge price is verified/);
    for(const file of ['plant-based-challenge.html','coaching.html']) {
        const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
        for(const fact of ['Summer Ready Shred','5 October 2026','$75','$125','$120','$870','$1,370','six-week']) assert.ok(html.includes(fact),`${file}: ${fact}`);
        assert.doesNotMatch(html,/women.only|eight.week challenge/i);
    }
    assert.equal(policy.buildChallengeBookingHandoff({currentMessage:'How much does it cost?',draft:{joined:'Online coaching is AUD $75/week plus one AUD $120 onboarding fee, with a ten-week minimum total of AUD $870.'}}),null);
    const history=[{direction:'out',text:'Want me to grab the booking link for you so we can tee up a call time?'}];
    assert.ok(policy.buildChallengeBookingHandoff({currentMessage:'Yes please',history,draft:{joined:policy.CHALLENGE_BOOKING_URL}}));
});

test('questions naming either current package or onboarding can receive its price', () => {
    for (const currentMessage of ['What is included in the $75 option?', 'What does the $120 cover?', 'What do I get for $125?']) {
        assert.deepEqual(policy.collectChallengeLeadIssues({currentMessage,draft:{joined:'Online coaching is AUD $75/week plus one AUD $120 onboarding fee, a ten-week minimum of AUD $870.'}}),[]);
    }
});
