const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const leaderboardScript = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-6-ai_coach_draft_mode_logic_auth.js'),
    'utf8'
);

const feedView = dashboard.slice(
    dashboard.indexOf('<div id="view-friends"'),
    dashboard.indexOf('<div id="view-profile"')
);
const settingsView = dashboard.slice(dashboard.indexOf('<div id="view-profile"'));

test('keeps Feed focused on posting and community posts', () => {
    assert.match(feedView, /id="feed-composer-card"/);
    assert.doesNotMatch(feedView, /id="feed-level-leaderboard-card"/);
    assert.doesNotMatch(feedView, /id="feed-start-battle-card"/);
    assert.doesNotMatch(feedView, /id="feed-community-pulse-card"/);
});

test('groups Top Levels, Battle, and Challenge in Settings', () => {
    assert.match(settingsView, /id="settings-community-games"/);
    assert.match(settingsView, /id="settings-community-games-card" class="settings-v2-card"/);
    assert.match(settingsView, /id="feed-level-leaderboard-card"/);
    assert.match(settingsView, /feed-level-leaderboard-toggle settings-v2-row/);
    assert.match(settingsView, /id="feed-start-battle-button" class="settings-v2-row"/);
    assert.match(settingsView, /id="feed-start-challenge-button" class="settings-v2-row"/);
});

test('restores a missing leaderboard only inside Settings', () => {
    assert.match(leaderboardScript, /const settingsHost = document\.getElementById\('settings-community-games-card'\) \|\| document\.getElementById\('settings-community-games'\)/);
    assert.match(leaderboardScript, /settingsHost\.insertBefore\(card, gameLaunchers\)/);
    assert.doesNotMatch(leaderboardScript, /composer\.parentNode\.insertBefore\(card, composer\)/);
    assert.doesNotMatch(leaderboardScript, /view\.appendChild\(card\)/);
});
