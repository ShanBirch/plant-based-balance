const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stories.js'), 'utf8');
const shareScript = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');

assert.match(stories, /function renderFeedPostBrandMark\(\)/);
assert.match(stories, /balance_logo_transparent\.png/);
assert.match(stories, /wrapFeedPostWithBrandMark\(mediaHtml\)/);
assert.match(stories, /feed-post-media-brand-shell/);
assert.match(shareScript, /async function pbbShareDrawBalanceBrandMark/);
assert.match(shareScript, /await pbbShareDrawBalanceBrandMark\(ctx, contentX/);
assert.match(shareScript, /await pbbShareDrawBalanceBrandMark\(ctx, 76, height - 142, 34\)/);
assert.match(dashboard, /lib\/stories\.js\?v=76-feed-composer-profile-photo/);

console.log('Feed brand logo tests passed');
