const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getBrisbaneDateKey, shouldDisplayChallenge } = require('../lib/challenge-display-window');

test('uses the Brisbane calendar date around UTC rollover', () => {
    assert.equal(getBrisbaneDateKey(new Date('2026-08-19T14:00:00.000Z')), '2026-08-20');
});

test('keeps a challenge visible through its end date', () => {
    const challenge = { end_date: '2026-08-20' };
    assert.equal(shouldDisplayChallenge(challenge, new Date('2026-08-20T13:59:59.000Z')), true);
});

test('clears a challenge on the Brisbane day after it ends', () => {
    const challenge = { end_date: '2026-08-20' };
    assert.equal(shouldDisplayChallenge(challenge, new Date('2026-08-20T14:00:00.000Z')), false);
});

test('does not hide pending challenges without an end date', () => {
    assert.equal(shouldDisplayChallenge({ status: 'pending', end_date: null }, new Date()), true);
});

test('places the challenge launcher in Settings and removes the Home launcher', () => {
    const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
    assert.match(dashboard, /id="feed-start-challenge-button"[^>]+onclick="openChallengeTypePicker\(\)"/);
    assert.doesNotMatch(dashboard, /id="home-challenges-empty"/);
    assert.match(dashboard, /id: 'feed-challenge-launcher-v1'/);
    assert.match(dashboard, /tab:'profile', sel:'#feed-start-challenge-button', title:'Start a Challenge'/);
    const feedView = dashboard.slice(dashboard.indexOf('<div id="view-friends"'), dashboard.indexOf('<div id="view-profile"'));
    const settingsView = dashboard.slice(dashboard.indexOf('<div id="view-profile"'));
    assert.doesNotMatch(feedView, /id="feed-start-challenge-button"/);
    assert.match(settingsView, /id="feed-start-challenge-button"/);
});
