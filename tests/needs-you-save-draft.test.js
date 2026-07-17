const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

assert.match(source, /onclick="saveAlertDraft\('\$\{key\}', this\)/);
assert.match(source, /async function saveAlertDraft\(alertId, btn = null\)/);
assert.match(source, /\.update\(\{ suggested_message: message, data: mergedData \}\)/);
assert.match(source, /needs_you_required: true/);
assert.match(source, /needs_shannon_approval: true/);
assert.match(source, /outbound_attempted: false/);

console.log('Needs You save-draft contract ok');
