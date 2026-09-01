const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('Settings is grouped in the approved order', () => {
  const labels = ['Personal setup', 'Your experience', 'Connections', 'Account &amp; help'];
  let cursor = dashboard.indexOf('class="settings-v2-shell"');
  assert.ok(cursor > -1, 'new Settings shell should exist');
  for (const label of labels) {
    const next = dashboard.indexOf(label, cursor);
    assert.ok(next > cursor, `${label} should follow the previous section`);
    cursor = next;
  }
  assert.doesNotMatch(dashboard, />Your Profile</);
  assert.doesNotMatch(dashboard, />Metabolic Protocol</);
  assert.doesNotMatch(dashboard, />Health Tools</);
});

test('all existing Settings capabilities and identifiers remain available once', () => {
  const ids = [
    'profile-photo-input', 'profile-name-display', 'profile-email-display',
    'profile-age-display', 'profile-weight-display', 'profile-goal-display',
    'profile-equipment-display', 'profile-diet-display', 'btn-edit-profile',
    'btn-save-profile', 'theme-selector', 'settings-fitgotchi-visibility',
    'fitgotchi-visibility-toggle', 'fitgotchi-visibility-status',
    'settings-customize-character-btn', 'settings-push-notifications',
    'push-notif-settings-status', 'push-notif-settings-btn',
    'settings-health-connect', 'health-connect-btn', 'settings-spotify-connect',
    'spotify-connect-btn', 'settings-download-app', 'settings-change-password',
    'settings-payment-method', 'settings-payment-method-btn',
    'settings-app-suggestions', 'app-suggestion-input', 'app-suggestion-submit-btn',
    'settings-clear-app-cache', 'settings-clear-cache-btn', 'admin-board-setting'
  ];
  for (const id of ids) {
    const matches = dashboard.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
    assert.equal(matches.length, 1, `${id} should be preserved exactly once`);
  }
});

test('FitGotchi and high-value Settings actions stay directly accessible', () => {
  assert.match(dashboard, /<strong>Show FitGotchi<\/strong>/);
  assert.match(dashboard, /toggleFitGotchiVisibility\(\)/);
  assert.match(dashboard, /openSettingsDestination\('character'\)/);
  assert.match(dashboard, /openSettingsDestination\('macros'\)/);
  assert.match(dashboard, /openSettingsDestination\('cycle'\)/);
  assert.match(dashboard, /openAppNotificationSettings\(\)/);
  assert.match(dashboard, /openSettingsDestination\('health'\)/);
  assert.match(dashboard, /toggleSpotifyConnection\(\)/);
  assert.match(dashboard, /openSettingsDestination\('password'\)/);
  assert.match(dashboard, /openBillingPortal\(\)/);
});

test('appearance uses a synced two-option control', () => {
  assert.match(dashboard, /data-settings-theme="light"/);
  assert.match(dashboard, /data-settings-theme="dark"/);
  assert.match(dashboard, /window\.setSettingsTheme = function\(theme\)/);
  assert.match(dashboard, /Promise\.resolve\(applyAppTheme\(theme\)\)/);
  assert.match(dashboard, /attributeFilter:\['data-pbb-theme'\]/);
});

test('Settings defines complete readable light and dark colour pairs', () => {
  assert.match(css, /#view-profile\.settings-v2-view\s*\{[\s\S]*--settings-bg:\s*#f7f2ea;[\s\S]*--settings-text:\s*#201a1f;/);
  assert.match(css, /html:not\(\[data-pbb-theme="light"\]\) #view-profile\.settings-v2-view\s*\{[\s\S]*--settings-bg:\s*#0d0c0e;[\s\S]*--settings-text:\s*#fffaf2;/);
  assert.match(css, /\.settings-v2-copy strong\s*\{[\s\S]*-webkit-text-fill-color:\s*var\(--settings-text\)/);
  assert.match(css, /\.settings-v2-copy small\s*\{[\s\S]*-webkit-text-fill-color:\s*var\(--settings-muted\)/);
  assert.match(css, /\.settings-v2-theme button\.is-active\s*\{[\s\S]*color:\s*#171009/);
  assert.match(css, /#app-suggestion-input\s*\{[\s\S]*background:\s*var\(--settings-card-soft\)[\s\S]*color:\s*var\(--settings-text\)/);

  const pairs = [
    ['#201a1f', '#fffdf9', 'light primary text'],
    ['#6c6169', '#fffdf9', 'light supporting text'],
    ['#fffaf2', '#191719', 'dark primary text'],
    ['#bdb3ba', '#191719', 'dark supporting text'],
    ['#171009', '#c79540', 'gold actions'],
    ['#ffffff', '#2563eb', 'Health action'],
    ['#ffffff', '#15803d', 'Spotify action']
  ];
  for (const [foreground, background, label] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${label} should meet WCAG AA`);
  }
});

test('phone caches receive the redesign', () => {
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=102-community-games-theme/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v429-settings-navigation'/);
});
