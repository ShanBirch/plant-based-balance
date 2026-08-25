const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

assert.match(dashboard, /function renderCodexTaskFallback\(alert\)/, 'admin dashboard should render the secondary Codex task notice');
assert.match(dashboard, /Balance Lead \+ Client DM Manager/, 'DM manager Needs You cards should identify the primary Codex task');
assert.match(dashboard, /Balance IG Browser 24-Hour Shift Dispatcher/, 'browser-owned cards should identify the dispatcher Codex task');
assert.match(dashboard, /informational only and did not send or approve a client message/, 'fallback copy must preserve approval and delivery boundaries');
assert.match(dashboard, /currentFeed !== 'needs-you' \|\| !alert \|\| alert\.status !== 'pending'/, 'fallback must be tied to the live pending source card');
assert.match(dashboard, /const codexTaskFallbackHtml = renderCodexTaskFallback\(alert\)/, 'alert cards should include the fallback renderer');

assert.match(dashboard, /function renderYourCallDispatcherApproval\(approval = null\)/, 'Your Call should render the live dispatcher batch');
assert.match(dashboard, /APPROVE IG DISPATCH \$\{batchId\} VERSION \$\{batchVersion\}/, 'dispatcher fallback should show the exact Codex reply for the live batch version');
assert.match(dashboard, /Balance IG Browser 24-Hour Shift Dispatcher/, 'dispatcher fallback should name the exact Codex task');
assert.match(dashboard, /This card cannot approve or send an Instagram action/, 'dispatcher fallback should be explicitly informational');
assert.doesNotMatch(dashboard, /function approveYourCallDispatcherBatch\(/, 'the retired in-app dispatcher approval path must not exist');
assert.doesNotMatch(dashboard, /onclick="approveYourCallDispatcherBatch\(\)"/, 'Your Call must not approve a dispatcher batch');
assert.match(dashboard, /\$\{codexTaskFallbackHtml\}/, 'fallback notice should be rendered without creating another alert');

console.log('admin Codex task fallback tests passed');
