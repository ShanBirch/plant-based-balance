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
    'id="feed-community-pulse-headline"',
    'id="feed-pulse-posts"',
    'id="feed-pulse-cheers"',
    'id="feed-pulse-comments"',
    'id="feed-pulse-battles"',
    'Post your win',
    'Cheer someone',
    'Join battle'
].forEach(expected => {
    assert.ok(dashboardSource.includes(expected), `dashboard should include ${expected}`);
});

assert.ok(
    dashboardSource.includes("{ tab:'friends', sel:'#feed-community-pulse-card', title:'Today in Balance'") &&
    dashboardSource.includes("id: 'feed-community-pulse-v1'"),
    'new and returning users should discover Today in Balance'
);

[
    'const FEED_COMMUNITY_PULSE_STORY_LIMIT = 120;',
    'const FEED_COMMUNITY_PULSE_CACHE_MS = 60 * 1000;',
    'window.loadFeedCommunityPulse = async function(options = {})',
    'window.focusFirstFeedReaction = function()',
    'window.openFeedPulseBattle = function()',
    "window.dbHelpers.stories.getNetworkStories(userId",
    ".from('feed_reactions')",
    ".from('feed_comments')",
    ".from('quiz_battles')",
    ".in('status', ['pending', 'active'])",
    'people.size'
].forEach(expected => {
    assert.ok(storiesSource.includes(expected), `stories should include ${expected}`);
});

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
