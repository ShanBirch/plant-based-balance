const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'pbb-deferred-formcheck.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

assert.ok(
    source.includes('#view-form-check .form-check-hero') &&
    source.includes('#view-workout-feed-share .workout-feed-share-hero') &&
    source.includes('linear-gradient(135deg,#ffffff 0%,#fff8df 100%)') &&
    source.includes('rgba(184,137,43,0.32)') &&
    source.includes('#b8892b') &&
    source.includes('#e4bd55'),
    'Form Check and Share a Set opened cards should use the Balance gold and white theme'
);

assert.ok(
    source.includes('#view-form-check .form-check-btn-primary') &&
    source.includes('#view-workout-feed-share .workout-feed-share-btn-primary') &&
    source.includes('linear-gradient(135deg,#b8892b 0%,#e4bd55 100%)') &&
    source.includes('#view-form-check .form-check-btn-secondary') &&
    source.includes('#view-workout-feed-share .workout-feed-share-btn-secondary'),
    'Form Check and Share a Set action buttons should use matching gold/white controls'
);

assert.ok(
    !source.includes('background:linear-gradient(135deg,#102a1d 0%,#48864B 100%)') &&
    !source.includes('background:linear-gradient(135deg,#111827 0%,#b91c1c 100%)') &&
    !source.includes('background: linear-gradient(135deg, #7c2d12 0%, #dc2626 100%)') &&
    !source.includes('background: #eef2ff;') &&
    !source.includes('color: #3730a3;'),
    'camera action screens should not keep the old green/red/purple theme'
);

assert.ok(
    source.includes('openFormCheckCapture()') &&
    source.includes("openWorkoutFeedShareCameraForFile({ target: 'form-check' })") &&
    source.includes('suspendWorkoutFeedShareCaptureSurface()') &&
    source.includes('restoreWorkoutFeedShareCaptureSurface()') &&
    source.includes('Camera') &&
    !source.includes('Film New Clip'),
    'Form Check capture action should be labelled Camera, use the shared camera path, and hide while filming'
);

assert.ok(
    dashboard.includes('pbb-deferred-formcheck.js?v=47'),
    'dashboard should bump the deferred camera/share script so phones fetch the theme change'
);

console.log('form check and share theme tests passed');
