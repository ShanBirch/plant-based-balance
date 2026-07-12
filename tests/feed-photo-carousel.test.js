const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(__dirname, '..', 'lib', 'stories.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260711090000_feed_post_media_carousel.sql'), 'utf8');

assert.match(dashboard, /id="feed-composer-file-input"[^>]*multiple/);
assert.match(dashboard, /id="feed-composer-preview-items"/);
assert.match(stories, /FEED_COMPOSER_MAX_PHOTOS\s*=\s*6/);
assert.match(stories, /Choose one video, or up to 6 photos for a carousel/);
assert.match(stories, /archiveFeedPostMediaItems/);
assert.match(stories, /hydrateFeedPostMedia\(stories\)/);
assert.match(stories, /renderFeedMediaCarousel/);
assert.match(stories, /options\.preferDirectUpload === true \|\| file\.size > FEED_MEDIA_UPLOAD_REQUEST_SAFE_BYTES/);
assert.match(stories, /maxUploadAttempts: isPhotoCarousel \? 3 : 1/);
assert.match(stories, /Reconnecting photo \$\{index \+ 1\} of \$\{composerFiles\.length\}/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.feed_post_media/);
assert.match(migration, /UNIQUE \(story_id, sort_order\)/);

console.log('feed photo carousel tests passed');
