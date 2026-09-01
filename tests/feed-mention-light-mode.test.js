const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const storiesSource = fs.readFileSync(path.join(repoRoot, 'lib', 'stories.js'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(repoRoot, 'dashboard.html'), 'utf8');

test('clickable Feed mentions reset native button paint for light mode', () => {
    const mentionRenderer = storiesSource.match(
        /function renderFeedMentionHandle\(handle\) \{[\s\S]*?\n\}/
    );

    assert.ok(mentionRenderer, 'Feed mention renderer should exist');
    assert.match(mentionRenderer[0], /-webkit-appearance:none/);
    assert.match(mentionRenderer[0], /background:transparent !important/);
    assert.match(mentionRenderer[0], /box-shadow:none !important/);
    assert.match(mentionRenderer[0], /-webkit-text-fill-color:[^;]+ !important/);
});

test('dashboard cache-busts the repaired Feed script in both loaders', () => {
    const references = dashboardSource.match(/lib\/stories\.js\?v=76-feed-composer-profile-photo/g) || [];
    assert.equal(references.length, 2);
});
