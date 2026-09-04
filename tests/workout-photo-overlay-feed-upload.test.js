const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const pointsSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const functionStart = pointsSource.indexOf('async function sharePendingPostWorkoutCompositeToFeed(studioShare)');
const functionEnd = pointsSource.indexOf('\nfunction getPostWorkoutShareViewportBottom()', functionStart);
const shareSource = pointsSource.slice(functionStart, functionEnd);
const rendererStart = pointsSource.indexOf('async function renderBalanceShareCardImage(');
const rendererEnd = pointsSource.indexOf('\nasync function shareBalanceCardImageExternally(', rendererStart);
const rendererSource = pointsSource.slice(rendererStart, rendererEnd);

assert.ok(functionStart >= 0 && functionEnd > functionStart, 'photo overlay Feed share function must exist');
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, 'photo overlay renderer must exist');
assert.ok(
    shareSource.includes('uploadStoryMediaToBackblaze(compositeFile') &&
        shareSource.includes("source: 'feed_workout_photo_overlay'") &&
        shareSource.includes('preferDirectUpload: true') &&
        shareSource.includes("if (!uploadData?.url) throw new Error('The overlay upload was not confirmed.');"),
    'workout photo overlays must use the confirmed iPhone-safe direct Feed uploader'
);
assert.ok(
    !shareSource.includes("fetch('/api/upload-story-media'") &&
        !shareSource.includes('new FormData()'),
    'workout photo overlays must not use the unreliable iOS multipart relay'
);
assert.ok(
    rendererSource.includes("if (cardType !== 'workout' && cardType !== 'pb' && cardType !== 'activity' && cardType !== 'nutrition')") &&
        rendererSource.includes('ctx.fillRect(0, 0, width, height);'),
    'workout, PB, activity, and nutrition photo overlays must skip the full-frame dark tint'
);
assert.ok(
    dashboardSource.includes('dashboard-script-10-points_widget_functions.js?v=63-preview-matched-activity') &&
        serviceWorkerSource.includes("const CACHE_NAME = 'pbb-app-v491-preview-matched-activity'") &&
        serviceWorkerSource.includes('./js/dashboard/dashboard-script-10-points_widget_functions.js?v=63-preview-matched-activity'),
    'phones must fetch the repaired overlay share path'
);

(async () => {
    const fullFrameDraws = [];
    const gradient = { addColorStop() {} };
    const context = {
        fillStyle: '',
        createLinearGradient() { return gradient; },
        fillRect(x, y, width, height) {
            if (x === 0 && y === 0 && width === 1080 && height === 1350) {
                fullFrameDraws.push(this.fillStyle);
            }
        }
    };
    const canvas = {
        getContext() { return context; },
        toDataURL() { return 'data:image/jpeg;base64,activity-card'; }
    };
    const sandbox = {
        document: { createElement() { return canvas; } },
        console: { warn() {} },
        pbbShareNormalizeTextStyle: style => style || 'bold',
        pbbShareGetStudioCustomization: () => null,
        pbbShareLoadImage: async () => ({}),
        pbbShareDrawCoverImage() {},
        pbbShareDrawStudioCaption() {},
        pbbShareDrawFullBleedActivityCard: async () => {},
        pbbShareDrawFullBleedWorkoutCard: async () => {},
        pbbShareDrawFullBleedMealCard: async () => {}
    };
    vm.runInNewContext(
        `${rendererSource}; this.renderBalanceShareCardImage = renderBalanceShareCardImage;`,
        sandbox
    );

    await sandbox.renderBalanceShareCardImage(
        { card_type: 'activity', activity_label: 'Walk' },
        { target: 'feed', photoDataUrl: 'data:image/jpeg;base64,photo' }
    );

    assert.strictEqual(
        fullFrameDraws.length,
        1,
        'activity photos should receive the base canvas draw only, with no extra full-frame dark tint'
    );
    console.log('workout and activity photo overlay contract passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
