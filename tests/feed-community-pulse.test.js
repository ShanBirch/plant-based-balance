const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storiesSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'stories.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);

[
    'id="feed-community-pulse-card"',
    'id="feed-pulse-posts"',
    'id="feed-pulse-reactions"',
    'id="feed-pulse-comments"',
    'id="feed-pulse-battles"',
    'Today in Balance',
    '<span>Reactions</span>'
].forEach(expected => {
    assert.ok(dashboardSource.includes(expected), `dashboard should include ${expected}`);
});

assert.ok(
    dashboardSource.includes("{ tab:'friends', sel:'#feed-community-pulse-card', title:'Today in Balance'") &&
    dashboardSource.includes("id: 'feed-community-pulse-v2'") &&
    dashboardSource.includes("See today's posts, reactions, comments, and battles at a glance."),
    'new and returning users should discover Today in Balance'
);

[
    'id="feed-community-pulse-headline"',
    'feed-community-pulse-refresh',
    'feed-community-pulse-actions',
    'Post your win',
    'Cheer someone',
    'Join battle',
    '<span>Cheers</span>'
].forEach(unexpected => {
    assert.ok(!dashboardSource.includes(unexpected), `dashboard should not include ${unexpected}`);
});

[
    'const FEED_COMMUNITY_PULSE_STORY_LIMIT = 120;',
    'const FEED_COMMUNITY_PULSE_CACHE_MS = 60 * 1000;',
    'window.loadFeedCommunityPulse = async function(options = {})',
    "window.dbHelpers.stories.getNetworkStories(userId",
    ".from('feed_reactions')",
    ".from('feed_comments')",
    ".from('quiz_battles')",
    ".in('status', ['pending', 'active'])",
    'setFeedPulseText(\'feed-pulse-reactions\', reactions)',
    'reactions: reactions.length'
].forEach(expected => {
    assert.ok(storiesSource.includes(expected), `stories should include ${expected}`);
});

assert.ok(
    !storiesSource.includes('window.focusFirstFeedReaction = function()') &&
    !storiesSource.includes('window.openFeedPulseBattle = function()') &&
    !storiesSource.includes('feed-pulse-cheers') &&
    !storiesSource.includes('people.size'),
    'trimmed pulse should not keep action handlers, cheers id, or hidden people headline logic'
);

const forcedRefreshCount = (storiesSource.match(/loadFeedCommunityPulse\(\{ force: true \}\)/g) || []).length;
assert.ok(
    forcedRefreshCount >= 5,
    'pulse should refresh after posting, direct shares, reactions, comments, deletes, and timed refreshes'
);

function extractScriptAfter(marker) {
    const markerIndex = dashboardSource.indexOf(marker);
    if (markerIndex < 0) throw new Error(`marker not found: ${marker}`);
    const scriptStart = dashboardSource.indexOf('<script>', markerIndex);
    const bodyStart = scriptStart + '<script>'.length;
    const scriptEnd = dashboardSource.indexOf('</script>', bodyStart);
    return dashboardSource.slice(bodyStart, scriptEnd);
}

[
    '<!-- ========== GUIDED FEATURE TOUR ========== -->',
    '<!-- ========== NEW FEATURE REVEAL ========== -->'
].forEach(marker => {
    new Function(extractScriptAfter(marker));
});

console.log('feed community pulse tests passed');
