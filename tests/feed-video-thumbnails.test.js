const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'stories.js'),
    'utf8'
);

assert.ok(
    source.includes('function feedThumbnailDataUrlToFile'),
    'feed video thumbnails should be converted from generated data URLs into uploadable files'
);

assert.ok(
    source.includes('uploadStoryMediaToBackblaze(thumbnailFile') &&
    source.includes("storyId: `${tempStoryId}-thumbnail`") &&
    source.includes('thumbnailUrl = thumbnailUploadData.url'),
    'video feed posts should upload the generated thumbnail and persist the public thumbnail URL'
);

assert.ok(
    source.includes('thumbnailUrl = getPublicFeedMediaUrl(thumbnailUrl) || null'),
    'feed posts should not persist inline data URL thumbnails that the feed RPC strips'
);

assert.ok(
    source.includes('const videoThumbnailSrc = isVideo ? getSafeFeedMediaUrl(story.thumbnail_url) : \'\';') &&
    source.includes('? (videoThumbnailSrc || videoPreviewSrc)') &&
    source.includes('isVideo && !videoThumbnailSrc && videoPreviewSrc ? renderFeedVideoPreview(story)'),
    'feed cards should prefer saved video thumbnail images and only fall back to video previews for older posts'
);

console.log('feed video thumbnail tests passed');
