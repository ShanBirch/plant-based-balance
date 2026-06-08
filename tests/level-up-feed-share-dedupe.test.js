const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);

assert.ok(
    source.includes('function getLevelUpShareKey(userId, level)'),
    'level-up sharing should create a stable user+level key'
);

assert.ok(
    source.includes('window.__levelUpFeedSharePending') &&
    source.includes('window.__levelUpFeedSharePending.has(shareKey)') &&
    source.includes('window.__levelUpFeedSharePending.add(shareKey)'),
    'level-up sharing should guard same-session double fires before insert'
);

assert.ok(
    source.includes('async function hasExistingLevelUpFeedPost(userId, level)') &&
    source.includes("story?.media_type === 'level_up_card'") &&
    source.includes('levelUpCaptionMatches(story.caption, level)'),
    'level-up sharing should check for an existing matching level-up card'
);

assert.ok(
    source.includes('if (await hasExistingLevelUpFeedPost(window.currentUser.id, level))') &&
    source.includes("setLevelUpShareValue(shareKey, 'shared')"),
    'level-up sharing should skip insert and mark shared when a duplicate already exists'
);

console.log('level-up feed share dedupe tests passed');
