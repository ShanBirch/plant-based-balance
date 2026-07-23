const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'pbb-deferred-formcheck.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

const start = source.indexOf('function getWorkoutFeedShareSuccessMessage(result)');
const end = source.indexOf('function refreshWorkoutFeedShareAfterPost()', start);
const successMessageBlock = source.slice(start, end);

assert.ok(start >= 0 && end > start, 'Share a Set success-message helper should exist');
assert.match(successMessageBlock, /if \(dailyLimitReached\)/);
assert.match(successMessageBlock, /\+\$\{pointsAwarded\} XP\. Daily \+15 XP already claimed\./);
assert.match(successMessageBlock, /Posted to Feed! Daily \+15 XP already claimed\./);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=57/);

console.log('Share a Set daily XP message contract ok');
