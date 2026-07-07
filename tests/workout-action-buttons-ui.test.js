const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

const formButtonMatch = dashboard.match(/<button id="workout-form-check-top-btn"[\s\S]*?<\/button>/);
const shareButtonMatch = dashboard.match(/<button id="workout-share-set-btn"[\s\S]*?<\/button>/);

assert.ok(formButtonMatch, 'workout screen should render the Film Form Check button');
assert.ok(shareButtonMatch, 'workout screen should render the Share a Set button');

const formButton = formButtonMatch[0];
const shareButton = shareButtonMatch[0];

assert.ok(
    dashboard.includes('.workout-camera-action-btn') &&
    dashboard.includes('justify-content: flex-start') &&
    dashboard.includes('text-align: left') &&
    dashboard.includes('min-height: 78px') &&
    dashboard.includes('linear-gradient(135deg,#ffffff 0%,#fff8df 100%)') &&
    dashboard.includes('rgba(184,137,43,0.28)'),
    'workout camera action buttons should share the same left-aligned layout'
);

assert.ok(
    formButton.includes('class="workout-camera-action-btn"') &&
    shareButton.includes('class="workout-camera-action-btn"'),
    'Film Form Check and Share a Set should use the same action button shell'
);

assert.ok(
    formButton.includes('workout-camera-action-copy') &&
    shareButton.includes('workout-camera-action-copy') &&
    formButton.includes('workout-camera-action-title') &&
    shareButton.includes('workout-camera-action-title') &&
    formButton.includes('workout-camera-action-subtitle') &&
    shareButton.includes('workout-camera-action-subtitle'),
    'both workout camera buttons should use the same title/subtitle text block'
);

assert.ok(
    !formButton.includes('justify-content:center') &&
    !formButton.includes('Film Form Check\n'),
    'Film Form Check should not be centered as loose text'
);

assert.ok(
    !formButton.includes('#3730a3') &&
    !shareButton.includes('#dc2626') &&
    !shareButton.includes('#111827'),
    'workout camera buttons should use the Balance gold and white theme instead of purple/red'
);

console.log('workout action button UI tests passed');
