const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const premiumCss = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const profileScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(dashboard, /id="home-welcome-title"[^>]*>Welcome back</, 'Home should have a friendly welcome fallback');
assert.match(dashboard, /id="home-welcome-date"/, 'Home should show the local date');
assert.match(dashboard, /class="app-logo">Home<[\s\S]*id="balance-level-bar"[\s\S]*id="home-welcome-title"/, 'the utility header should stay simple while the greeting leads the content area');
assert.match(dashboard, /id="balance-level-bar"[\s\S]*id="home-welcome-title"[\s\S]*class="balance-level-card"[\s\S]*id="balance-level-rank"/, 'rank progress should sit quietly beneath the greeting');
assert.match(dashboard, /title\.textContent = firstName \? 'Welcome, ' \+ firstName : 'Welcome back'/, 'Home should greet the member by first name');
assert.match(dashboard, /new Intl\.DateTimeFormat\('en-AU',[\s\S]*weekday: 'long'[\s\S]*month: 'long'/, 'the date should use a clean Australian long format');
assert.match(dashboard, /pbb-premium-overlays\.css\?v=87/, 'phones should fetch the updated header styling');
assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=149/, 'phones should fetch the profile-to-header name sync');
assert.match(profileScript, /window\.updateHomeWelcome\(context\.name\)/, 'loaded profile data should replace the cached welcome name');
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v259'/, 'the app shell cache should advance for the new header');

assert.match(premiumCss, /\.home-welcome-block\s*\{[\s\S]*min-width:\s*0[\s\S]*flex-direction:\s*column/, 'the content greeting should use a clean two-line stack');
assert.match(premiumCss, /\.home-welcome-title\s*\{[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/, 'long names should not collide with account controls');
assert.match(premiumCss, /html\[data-pbb-theme="light"\] \.home-welcome-title[\s\S]*color:\s*#151515/, 'the welcome should use readable light-theme text');
assert.match(premiumCss, /html\[data-pbb-theme="light"\] \.home-welcome-date[\s\S]*color:\s*#6f6a61/, 'the date should use readable muted text in light mode');
assert.match(premiumCss, /\.balance-level-label[\s\S]*\.balance-level-rank[\s\S]*\.balance-level-xp-text/, 'level, rank and XP should have a clear compact hierarchy');
assert.match(premiumCss, /html\[data-pbb-theme="light"\] \.balance-level-card[\s\S]*background:\s*rgba\(255,255,255,0\.88\)/, 'the progress card should have an explicit light surface');
assert.match(premiumCss, /@media \(max-width: 390px\)[\s\S]*\.home-header-actions[\s\S]*gap:\s*6px/, 'the header should compact itself on narrow phones');
assert.doesNotMatch(premiumCss, /\.home-header-actions \.coin-header-widget \.coin-emoji,[\s\S]*display:\s*none/, 'moving the greeting should let the normal coin controls remain visible');

const controllerIndex = dashboard.indexOf('window.updateHomeWelcome =');
const scriptStart = dashboard.lastIndexOf('<script>', controllerIndex) + '<script>'.length;
const scriptEnd = dashboard.indexOf('</script>', scriptStart);
assert.ok(controllerIndex >= 0 && scriptStart > 0 && scriptEnd > scriptStart, 'the welcome controller should be extractable');

const elements = {
  'home-welcome-title': { textContent: '' },
  'home-welcome-date': { textContent: '' }
};
const sandbox = {
  window: null,
  document: {
    getElementById: id => elements[id] || null,
    addEventListener: () => {}
  },
  localStorage: { getItem: () => null },
  Intl,
  Date,
  console,
  addEventListener: () => {},
  currentUser: { user_metadata: { full_name: 'shannon birch' } }
};
sandbox.window = sandbox;
vm.runInNewContext(dashboard.slice(scriptStart, scriptEnd), sandbox);
assert.strictEqual(elements['home-welcome-title'].textContent, 'Welcome, Shannon', 'the live header should use the member first name');
assert.ok(elements['home-welcome-date'].textContent.length > 8, 'the live header should render a readable date');

console.log('Home welcome header tests passed');
