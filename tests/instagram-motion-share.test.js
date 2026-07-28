const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const points = fs.readFileSync(path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');
const android = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'fitgotchi', 'app', 'MainActivity.java'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'ios', 'App', 'App', 'BalanceInstagramSharePlugin.swift'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib', 'stories.js'), 'utf8');

assert.ok(points.includes('async function renderBalanceShareCardVideo('), 'motion card renderer must exist');
assert.ok(points.includes('const durationMs = 4200'), 'motion card must stay short enough for sharing');
assert.ok(points.includes("'video/mp4;codecs=avc1.42E01E'"), 'iOS-compatible MP4 must be preferred');
assert.ok(points.includes("'video/webm;codecs=vp9'"), 'Android-compatible WebM fallback must exist');
assert.ok(points.includes("['workout', 'pb', 'activity'].includes"), 'motion sharing must stay limited to earned movement cards');
assert.ok(points.includes('&& !!renderOptions.photoDataUrl'), 'motion sharing must keep the selfie or activity photo as its hero');
assert.ok(points.includes("console.warn('Motion card unavailable, using still share:'"), 'unsupported phones must fall back to the still card');
assert.ok(points.includes('shareBalanceCardVideoWithNativeBridge(videoBlob, safeTarget)'), 'native video bridge must be tried before the share sheet');
assert.ok(points.includes("showToast('Take a selfie or gym photo for your PB share first.'"), 'PB sharing must collect a photo first');
assert.ok(points.includes("showToast('Add a selfie or activity photo before sharing.'"), 'activity sharing must collect a photo first');
assert.ok(points.includes('sharePBCardToFeed(pendingPBShareData, cachedWorkoutShareBase64)'), 'PB Feed shares must keep the captured photo');
assert.ok(!points.includes('sharePBCardToFeed(pbData);'), 'every PB Feed route must preserve the selfie or gym photo');
assert.ok(points.includes('photoDataUrl: cachedWorkoutShareBase64'), 'PB Instagram shares must keep the captured photo');
assert.ok(stories.includes('balance-share-photo-celebration'), 'Balance Feed photo posts must animate over the photo');

assert.ok(android.includes('public boolean shareVideoToInstagram(String dataUrl, String target)'), 'Android bridge must accept motion cards');
assert.ok(android.includes('mimeType.startsWith("video/") ? "video/*" : "image/*"'), 'Android Story intent must use the video family');
assert.ok(ios.includes('CAPPluginMethod(name: "shareVideoToInstagram"'), 'iOS bridge must register motion sharing');
assert.ok(ios.includes('"com.instagram.sharedSticker.backgroundVideo": videoData'), 'iOS Story handoff must use Instagram background video');
assert.ok(ios.includes('UIActivityViewController(activityItems: [fileUrl]'), 'iOS Feed handoff must expose the motion file');
assert.ok(dashboard.includes("id: 'instagram-motion-share-v1'"), 'returning users must see the motion share Feature Drop');

console.log('Instagram motion share contract passed');
