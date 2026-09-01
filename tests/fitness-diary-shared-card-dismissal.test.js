const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const diary = fs.readFileSync('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');

test('a successful Fitness Diary Feed share removes every diary share card', () => {
  assert.match(diary, /function hideFitnessDiaryShareCards\(dateKey\)/);
  assert.match(diary, /markFitnessDiaryShared\(dateKey\);[\s\S]*?hideFitnessDiaryShareCards\(dateKey\);/);
  assert.match(diary, /card\.style\.display = 'none'/);
  assert.match(diary, /doneCard\.style\.display = 'none'/);
});

test('the persisted share state wins over initial load and delayed completion timers', () => {
  assert.match(diary, /if \(isFitnessDiaryShared\(dateKey\)\) \{[\s\S]*?hideFitnessDiaryShareCards\(dateKey\);[\s\S]*?return;/);
  assert.ok((diary.match(/if \(isFitnessDiaryShared\(dateKey\)\) \{/g) || []).length >= 4);
  assert.match(diary, /setTimeout\(function\(\) \{[\s\S]*?isFitnessDiaryShared\(dateKey\)[\s\S]*?hideFitnessDiaryShareCards\(dateKey\)/);
});

test('returning Android phones receive the diary dismissal release', () => {
  assert.ok((dashboard.match(/dashboard-script-1-daily_weighin_card_logic\.js\?v=77-nightly-diary-hide-shared/g) || []).length >= 2);
});
