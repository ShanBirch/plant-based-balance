const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib/stories.js'), 'utf8');

test('Feed composer uses the approved single-field layout', () => {
  assert.match(dashboard, /id="feed-composer-text"[^>]*placeholder="What’s happening\?"/);
  assert.match(dashboard, /id="feed-composer-text"[^>]*aria-label="What’s happening\?"/);
  assert.doesNotMatch(dashboard, /<label[^>]*for="feed-composer-text"/);
  assert.doesNotMatch(dashboard, /id="feed-composer-avatar"/);
  assert.match(dashboard, /id="feed-composer-share-menu-button"[^>]*feed-composer-action-primary/);
  assert.match(dashboard, />From Balance</);
  assert.match(dashboard, /id="feed-composer-tag-button"/);
  assert.match(dashboard, /--feed-composer-accent: #6f5014/);
  assert.match(dashboard, /html:not\(\[data-pbb-theme="light"\]\) #feed-composer-card \{[\s\S]*--feed-composer-accent: var\(--pbb-luxe-gold/);
  assert.match(dashboard, /Share from Balance/);
  assert.match(dashboard, /Record or upload a training set/);
  assert.match(dashboard, /Share your latest logged meal/);
  assert.match(dashboard, /Choose from completed training/);
  assert.match(dashboard, /Share what’s playing on Spotify/);
});

test('Feed avatars prefer the latest signed-in account photo and keep an initial fallback', () => {
  assert.match(stories, /function getActiveProfilePhoto\(\)/);
  assert.match(stories, /function getFeedStoryProfilePhoto\(story\)/);
  assert.match(stories, /return getActiveProfilePhoto\(\) \|\| String\(story\.profile_photo/);
  assert.match(stories, /function renderFeedAvatarContent\(story/);
  assert.match(stories, /class="feed-avatar-fallback"/);
  assert.match(stories, /class="feed-avatar-image"/);
  assert.match(stories, /data-feed-avatar-user-id/);
  assert.match(stories, /pbbProfilePhotoUpdated/);
});

