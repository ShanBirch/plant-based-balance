const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workoutSource = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const videoSource = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-7-video_logic.js'),
    'utf8'
);
const savedWorkoutSource = fs.readFileSync(
    path.join(root, 'js/dashboard/pbb-deferred-savedworkouts.js'),
    'utf8'
);
const workoutBuilderSource = fs.readFileSync(
    path.join(root, 'js/dashboard/pbb-deferred-workoutbuilder.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function functionSource(source, name, nextName) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf(`\nfunction ${nextName}(`, start + 1);
    assert.ok(start >= 0 && end > start, `${name} source must be present`);
    return source.slice(start, end);
}

test('exercise cards render a real poster or prime a real video frame', () => {
    const context = {
        window: {
            _customExercisesCache: [{
                exercise_name: 'Seated Machine Calf Extensions',
                video_url: 'https://cdn.example/calf.mp4',
                thumbnail_url: 'https://cdn.example/calf.jpg'
            }],
            _myCustomExercisesCache: []
        }
    };
    vm.createContext(context);
    vm.runInContext(
        functionSource(workoutSource, 'findExerciseThumbnail', 'createExerciseVideoBlockHtml'),
        context
    );
    context.shouldDefaultExerciseVideoToPortrait = () => false;
    vm.runInContext(
        functionSource(workoutSource, 'createExerciseVideoBlockHtml', 'createExerciseVideoUploadPlaceholderHtml'),
        context
    );

    const customHtml = context.createExerciseVideoBlockHtml(
        'https://cdn.example/calf.mp4',
        'Seated Machine Calf Extensions'
    );
    assert.match(customHtml, /poster="https:\/\/cdn\.example\/calf\.jpg"/);
    assert.match(customHtml, /data-thumbnail-state="ready"/);

    const catalogHtml = context.createExerciseVideoBlockHtml(
        'https://cdn.example/kickback.mp4',
        'Bent Leg Kickback'
    );
    assert.doesNotMatch(catalogHtml, / poster=/);
    assert.match(catalogHtml, /preload="auto"/);
    assert.match(catalogHtml, /primeInlineExerciseThumbnail\(this\)/);
    assert.match(catalogHtml, /Loading exercise preview/);
    assert.match(catalogHtml, /right: 14px; bottom: 14px/);
});

test('thumbnail priming seeks into the working exercise frame', () => {
    const context = { Number, Math };
    vm.createContext(context);
    vm.runInContext(
        functionSource(videoSource, 'getExerciseThumbnailSeekTime', 'seekExerciseVideoThumbnailFrame'),
        context
    );

    assert.equal(context.getExerciseThumbnailSeekTime({ duration: 8.33 }), 0.35);
    assert.equal(context.getExerciseThumbnailSeekTime({ duration: 1 }), 0.08);
    assert.equal(context.getExerciseThumbnailSeekTime({ duration: 0.1 }), 0);
    assert.equal(context.getExerciseThumbnailSeekTime({ duration: Number.NaN }), 0.2);
    assert.match(videoSource, /video\.dataset\.thumbnailPrimed = 'true'/);
    assert.match(videoSource, /revealInlineExerciseThumbnail\(video\)/);
    assert.match(videoSource, /video\.currentTime = 0/);
});

test('every workout entry path uses the shared thumbnail renderer', () => {
    assert.match(savedWorkoutSource, /createExerciseVideoBlockHtml\(videoUrl, ex\.name\)/);
    assert.match(workoutBuilderSource, /createExerciseVideoBlockHtml\(videoUrl, ex\.name\)/);
    assert.doesNotMatch(savedWorkoutSource, /<source src="\$\{videoUrl\}"/);
    assert.doesNotMatch(workoutBuilderSource, /<source src="\$\{videoUrl\}"/);
});

test('phones fetch the thumbnail renderer and video logic together', () => {
    const workoutVersion = 'dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=190-exercise-video-bridge';
    const videoVersion = 'dashboard-script-7-video_logic.js?v=20260815-exercise-thumbnails';
    assert.match(dashboardSource, new RegExp(workoutVersion.replace(/[.?]/g, '\\$&')));
    assert.match(dashboardSource, new RegExp(videoVersion.replace(/[.?]/g, '\\$&')));
    assert.match(serviceWorkerSource, new RegExp(workoutVersion.replace(/[.?]/g, '\\$&')));
    assert.match(serviceWorkerSource, new RegExp(videoVersion.replace(/[.?]/g, '\\$&')));
  assert.match(serviceWorkerSource, /const CACHE_NAME = 'pbb-app-v344-course-action-evidence'/);
});
