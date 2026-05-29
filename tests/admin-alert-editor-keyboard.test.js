const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
const start = dashboard.indexOf('function handleAlertsKeydown(e) {');
const end = dashboard.indexOf('// Install once.', start);

assert.ok(start > -1, 'handleAlertsKeydown should exist');
assert.ok(end > start, 'handleAlertsKeydown block should be extractable');

const handler = dashboard.slice(start, end);

assert.match(
    handler,
    /if \(hasLiveAlertEdit\(\)\) \{\s*if \(e\.key === 'Enter'\) return;/,
    'Enter must be ignored by approval shortcuts while any draft editor is open'
);

assert.ok(
    !/e\.key === 'Enter' && inEditArea/.test(handler),
    'plain Enter inside the draft textarea must not be treated as a send shortcut'
);

assert.ok(
    !/sendAlertMessage\(alertId\)/.test(handler),
    'the editor-specific key path must never send by alertId'
);

console.log('admin alert editor keyboard guard test passed');
