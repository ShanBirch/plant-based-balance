const assert = require('assert');

const {
    buildMemoryBlock,
    buildClientProfileBlock,
    buildPublicProfileResearchBlock,
} = require('../netlify/functions/_lib/client-context');

const research = {
    version: 1,
    username: 'strong_example',
    observed_at: '2026-07-19T02:30:00.000Z',
    visible_facts: [
        { fact: 'plant-based runner', evidence: 'bio says plant based and recent race posts' },
        'based on the Gold Coast',
    ],
    content_themes: ['strength training', 'trail running'],
    conversation_hooks: [
        { hook: 'recent trail race', evidence: 'race recap Reel' },
    ],
    avoid_questions: ['are you into fitness?', 'do you run?'],
};

const block = buildPublicProfileResearchBlock({ public_profile_research: research });
assert.match(block, /PUBLIC INSTAGRAM PROFILE RESEARCH/);
assert.match(block, /@strong_example/);
assert.match(block, /recent trail race/);
assert.match(block, /are you into fitness\?/);
assert.match(block, /not confirmed conversation facts/);
assert.match(block, /newest direct message or correction always wins/i);

const linkedMemory = buildMemoryBlock({
    personal_context: 'explicitly said they work nights',
    preferences: { instagram_public_profile: research },
});
assert.match(linkedMemory, /explicitly said they work nights/);
assert.match(linkedMemory, /trail running/);
assert.match(linkedMemory, /do not ask/);

const coldLeadProfile = buildClientProfileBlock({
    clientName: 'Alex',
    profile: { customData: { public_profile_research: research } },
    customData: { public_profile_research: research },
});
assert.match(coldLeadProfile, /CLIENT PROFILE/);
assert.match(coldLeadProfile, /PUBLIC INSTAGRAM PROFILE RESEARCH/);
assert.match(coldLeadProfile, /Questions already answered by the profile/);

assert.strictEqual(buildPublicProfileResearchBlock({ public_profile_research: {} }), '');

console.log('ig public profile memory tests passed');
