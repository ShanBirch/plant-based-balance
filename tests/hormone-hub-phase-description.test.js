const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const cycleScript = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const hormoneHubScript = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-9-hormone_hub_superboost_engine.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('hides the menstrual exercise recommendation from the Hormone Hub hero', () => {
    assert.match(cycleScript, /menstrual:\s*\{[^\n]*hideHeroRec:\s*true/);
    assert.match(cycleScript, /phaseDescription\.style\.display = phase\.hideHeroRec \? 'none' : ''/);
    assert.match(hormoneHubScript, /descDisplay\.style\.display = info\.hideHeroRec \? 'none' : ''/);
});

test('restores the hero description for phases that still show one', () => {
    assert.match(cycleScript, /phaseDesc\.style\.display = ''/);
    assert.match(hormoneHubScript, /descDisplay\.style\.display = ''/);
});

test('ships the change behind fresh app asset versions', () => {
    assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=179/);
    assert.match(dashboard, /dashboard-script-9-hormone_hub_superboost_engine\.js\?v=1/);
    assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v302'/);
});
