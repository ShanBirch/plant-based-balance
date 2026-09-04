const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shareSource = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(
    shareSource,
    /\{ id: 'full', label: 'All lifts', contexts: \['workout'\] \}/,
    'workout shares should offer a dedicated All lifts layout'
);
assert.ok(
    dashboardSource.includes('dashboard-script-10-points_widget_functions.js?v=64-wysiwyg-activity-card')
        && serviceWorkerSource.includes('dashboard-script-10-points_widget_functions.js?v=64-wysiwyg-activity-card'),
    'phones should fetch and precache the comprehensive share composer'
);
assert.match(
    shareSource,
    /set_details: ex\.setDetails,[\s\S]*has_pb: ex\.setDetails\.some\(set => set\.is_pb\)/,
    'the workout payload should preserve every logged set and exercise PB state'
);
assert.match(
    shareSource,
    /set\.kg != null \? set\.kg : set\.weight_kg/,
    'saved workout rows should keep their weight_kg values in the comprehensive share'
);
assert.match(
    shareSource,
    /const matchingPB = workoutPBs\.find\([\s\S]*is_pb: !!matchingPB/,
    'the exact set responsible for a PB should be marked in the payload'
);
assert.match(
    shareSource,
    /function pbbShareDrawCompleteWorkout\([\s\S]*pbbShareCompactSetDetails\(exercise\)/,
    'the comprehensive renderer should draw each exercise with all of its set details'
);
assert.match(
    shareSource,
    /pbbShareFillRoundRect\(ctx, contentX, y, contentW, metricH[\s\S]*pbbShareFillRoundRect\(ctx, x, rowY, columnW, cardH/,
    'the chosen layout should use a compact metrics card followed by separate lift cards'
);
assert.match(
    shareSource,
    /if \(hasPB\) \{[\s\S]*ctx\.fillStyle = '#f5c45c';[\s\S]*ctx\.fill\(\);/,
    'PB lift cards should receive the selected gold edge treatment'
);
assert.match(
    shareSource,
    /if \(textStyle === 'full' && cardType === 'workout'\)[\s\S]*pbbShareDrawCompleteWorkout/,
    'the All lifts option should route workout cards through the comprehensive renderer'
);
assert.match(
    shareSource,
    /pbbShareTextStyleOptions\(safeContext\)/,
    'workout-only text styles should be filtered out of PB, activity, and nutrition controls'
);
assert.match(
    dashboardSource,
    /id: 'complete-workout-share-layout-v1'[\s\S]*title: 'Share every lift'/,
    'returning users should receive a feature reveal for complete workout sharing'
);

console.log('Comprehensive workout share contracts passed');
