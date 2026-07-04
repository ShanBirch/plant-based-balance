const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'stories.js'),
    'utf8'
);

assert.ok(
    source.includes("const FEED_PREFETCH_ROOT_MARGIN = '180px 0px';"),
    'feed pagination prefetch margin should stay close enough to avoid eager first-page auto-loads'
);

assert.ok(
    source.includes('autoLoadArmed: false') &&
    source.includes('const useAutoLoad = supportsObserver && state.autoLoadArmed') &&
    source.includes('state.autoLoadArmed = true;'),
    'feed should show a Load more button on the first page and only arm auto-loading after user intent'
);

assert.ok(
    source.includes('function hasRenderedPhotoFeed(grid, state)') &&
    source.includes('const quietRefresh = !append && hasRenderedPhotoFeed(grid, state);'),
    'feed refreshes should detect when posts are already rendered'
);

assert.ok(
    source.includes('if (!quietRefresh) {') &&
    source.includes('Loading feed...') &&
    source.includes('if (quietRefresh) {\n            renderPhotoFeedPager(state);\n            return;\n        }'),
    'non-append feed refreshes should not replace visible posts with the loading or error states'
);

console.log('feed loader preserve tests passed');
