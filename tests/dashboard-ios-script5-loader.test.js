const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const stubs = fs.readFileSync(path.join(root, 'js/dashboard/script_part_4.js'), 'utf8');

const loaderMatch = dashboard.match(/\/\/ Script-5 \(678KB\)[\s\S]*?<\/script>/);
assert.ok(loaderMatch, 'dashboard.html should contain the iOS script-5 loader block');

const loader = loaderMatch[0];

assert.match(stubs, /function initProgramDate\(\)/, 'script_part_4 defines initProgramDate as an early stub');
assert.match(stubs, /function hideAllAppViews\(\)/, 'script_part_4 defines hideAllAppViews as an early stub');

assert.doesNotMatch(
    loader,
    /typeof initProgramDate === 'function'\s*&&\s*typeof hideAllAppViews === 'function'/,
    'iOS script-5 loader must not treat early stubs as proof the real script loaded'
);

assert.match(
    loader,
    /window\._switchAppTabReady\s*&&\s*typeof window\._switchAppTabReal === 'function'/,
    'iOS script-5 loader should only skip injection after the real tab switch implementation is ready'
);
