const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);

assert.ok(
    dashboardSource.includes('id="feed-composer-card"') &&
    dashboardSource.includes('id="feed-composer-text"'),
    'feed composer should still render'
);

assert.ok(
    !dashboardSource.includes('Share one caption, thought, or encouragement to Feed each day for +2 XP. Type @ to tag someone.'),
    'feed composer helper copy should stay removed'
);

console.log('feed composer helper copy tests passed');
