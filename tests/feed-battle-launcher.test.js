const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);
const gamesSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'games.js'),
    'utf8'
);

[
    'id="feed-start-battle-card"',
    'id="feed-start-battle-button"',
    'Start Battle',
    'Quiz, chess, checkers, and more',
    'window.openFeedBattleChooser ? window.openFeedBattleChooser()',
    'var learningAlreadyRequested = Array.prototype.some.call(document.scripts || []',
    'lib/games.js?v=3'
].forEach(expected => {
    assert.ok(dashboardSource.includes(expected), `dashboard should include ${expected}`);
});

assert.ok(
    dashboardSource.includes("{ tab:'friends', sel:'#feed-start-battle-card', title:'Start Battle'") &&
    dashboardSource.includes("id: 'feed-battle-launcher-v1'") &&
    dashboardSource.includes('Tap Start Battle to choose Quiz Battle, chess, checkers, or another game before challenging a friend or bot.'),
    'new and returning users should discover the Feed battle launcher'
);

[
    'const FEED_BATTLE_BADGES = {',
    'function openFeedBattleChooser()',
    'function openFeedBattleChoice(battleType)',
    'function requestQuizBattleScriptIfNeeded()',
    "type: 'quiz'",
    'window.showQuizBattleInviteModal',
    'requestQuizBattleScriptIfNeeded();',
    "script.src = 'lib/learning-inline.js?v=9';",
    'window.openGameChallengeModal({ preselectGameType: battleType })',
    'async function openGameChallengeModal(options = {})',
    "const preselectGameType = typeof options === 'string' ? options : options?.preselectGameType;",
    'modal.querySelector(`.game-type-card[data-game="${preselectGameType}"]`)',
    'window.openFeedBattleChooser = openFeedBattleChooser',
    'window.closeFeedBattleChooser = closeFeedBattleChooser',
    'window.openFeedBattleChoice = openFeedBattleChoice'
].forEach(expected => {
    assert.ok(gamesSource.includes(expected), `games should include ${expected}`);
});

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

console.log('feed battle launcher tests passed');
