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

const generatedCardSource = storiesSource.slice(
    storiesSource.indexOf('window.renderWorkoutCard'),
    storiesSource.indexOf('const FEED_COMPOSER_POST_TTL_MS')
);

assert.ok(
    generatedCardSource.includes('BALANCE 🌱'),
    'generated feed cards should show the Balance brand label'
);
assert.ok(
    !generatedCardSource.includes('FITGOTCHI'),
    'generated feed cards should not expose the legacy FitGotchi brand'
);
assert.strictEqual(
    (generatedCardSource.match(/BALANCE 🌱/g) || []).length,
    5,
    'activity, PB, workout, nutrition, and level-up cards should all use Balance branding'
);
assert.ok(
    (dashboardSource.match(/lib\/stories\.js\?v=76-feed-composer-profile-photo/g) || []).length === 2,
    'dashboard should fetch the updated feed-card renderer'
);

console.log('feed card branding tests passed');
