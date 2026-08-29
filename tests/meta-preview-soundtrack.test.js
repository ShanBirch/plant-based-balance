const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const soundtrack = fs.readFileSync(path.join(root, 'js/dashboard/pbb-meta-preview-soundtrack.js'), 'utf8');

test('paid preview loads its own gentle soundtrack and exposes a mute control', () => {
  assert.match(dashboard, /pbb-meta-preview-soundtrack\.js\?v=3-coach-video-ducking/);
  assert.doesNotMatch(dashboard, /if \(window\.metaAdTrialMode === true\)[\s\S]{0,160}pbb-meta-preview-soundtrack/);
  assert.match(soundtrack, /function isPaidOnboardingExperience\(\)/);
  assert.match(soundtrack, /params\.get\('account_first'\) === '1'/);
  assert.match(soundtrack, /meta-preview-music-control/);
  assert.match(soundtrack, /Music ' \+ \(muted \? 'off' : 'on'\)/);
  assert.match(soundtrack, /localStorage\.setItem\(STORAGE_KEY, muted \? '1' : '0'\)/);
});

test('soundtrack respects mobile autoplay and Shannon coach-video playback', () => {
  assert.match(soundtrack, /document\.addEventListener\('pointerdown', unlock, true\)/);
  assert.match(soundtrack, /document\.addEventListener\('click', unlock, true\)/);
  assert.match(soundtrack, /context\.state === 'suspended'/);
  assert.match(soundtrack, /context\.state !== 'running'/);
  assert.match(soundtrack, /#meta-ad-trial-welcome-video/);
  assert.match(soundtrack, /document\.addEventListener\('play',[\s\S]*setVoicePlaying\(true\)/);
  assert.match(soundtrack, /voicePlaying \|\| stopped\) return 0/);
});

test('tour changes soundtrack intensity around course, voice, goals and payment', () => {
  assert.match(dashboard, /requiresWelcomeVideo\) window\.BalanceMetaPreviewSoundtrack\.setPhase\('voice'\)/);
  assert.match(dashboard, /requiresFoundationsLesson\) window\.BalanceMetaPreviewSoundtrack\.setPhase\('course'\)/);
  assert.match(dashboard, /requiresWeeklyGoals\) window\.BalanceMetaPreviewSoundtrack\.setPhase\('weekly_goals'\)/);
  assert.match(dashboard, /window\.BalanceMetaPreviewSoundtrack\.setPhase\('payment'\)/);
  assert.equal((soundtrack.match(/voice: 0/g) || []).length, 1);
});
