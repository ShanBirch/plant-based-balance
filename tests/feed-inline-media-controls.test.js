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

assert.ok(
    storiesSource.includes('const FEED_MEDIA_DOUBLE_TAP_MS = 260;') &&
    storiesSource.includes('window.handleFeedMediaTap = function(storyId, isVideo, event)') &&
    storiesSource.includes('window.handleFeedMediaDoubleTap = function(storyId, event)'),
    'feed media should distinguish single tap from double tap'
);

assert.ok(
    storiesSource.includes('window.toggleFeedInlineVideo = async function(storyId)') &&
    storiesSource.includes('data-feed-inline-video=') &&
    storiesSource.includes('data-feed-video-poster=') &&
    storiesSource.includes('setFeedInlineVideoUiState'),
    'video feed posts should play inline with poster and play-icon state'
);

assert.ok(
    storiesSource.includes('renderFeedVideoPreview(story, { storyId })') &&
    storiesSource.includes('onclick="handleFeedMediaTap') &&
    storiesSource.includes('ondblclick="handleFeedMediaDoubleTap'),
    'photo and video media should use tap handlers instead of opening the viewer on single tap'
);

assert.ok(
    storiesSource.includes("handleFeedMediaTap('${safeStoryId}', false, event)") &&
    storiesSource.includes("renderProgressPhotoSet(story, storyId)"),
    'progress photo posts should follow the same double-tap media behavior'
);

assert.ok(
    !storiesSource.includes("thumbnailSrc ? `<div onclick=\"openFeedPostViewer('${storyId}')\""),
    'standard feed media should not open the full viewer on single click'
);

assert.ok(
    dashboardSource.includes("title:'Feed media controls'") &&
    dashboardSource.includes("id: 'feed-inline-media-controls-v1'") &&
    dashboardSource.includes('Tap a video once to play it right in Feed. Double tap any photo or video to open the full view.'),
    'new and returning users should see the feed media controls discovery copy'
);

console.log('feed inline media control tests passed');
