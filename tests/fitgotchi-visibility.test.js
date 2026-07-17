const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const points = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(dashboard, /id="balance-level-bar"/, 'Home should include the compact level bar');
assert.match(dashboard, /id="settings-fitgotchi-visibility"/, 'Profile should include the FitGotchi visibility setting');
assert.match(dashboard, /role="switch" aria-checked="true"/, 'the visibility control should expose accessible switch state');
assert.match(dashboard, /id:\s*'fitgotchi-visibility-toggle-v1'/, 'returning members should receive a one-time Feature Drop');
assert.match(dashboard, /title:'Choose your Home style'/, 'new members should see the visibility option in the guided tour');
assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=147/, 'phones should fetch the new onboarding behavior');
assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=28/, 'phones should fetch the compact level updates');
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v255'/, 'the app shell cache should advance for this feature');

assert.match(onboarding, /let isReturningMember = localStorage\.getItem\('onboardingComplete'\) === 'true'/, 'local onboarding history should preserve returning members');
assert.match(onboarding, /if \(!isReturningMember && databaseOnboardingStatusChecked/, 'only database-confirmed new members should receive the hidden default');
assert.match(onboarding, /pbb_fitgotchi_needs_character_setup', 'true'/, 'new members should be marked for one character setup prompt');
assert.match(onboarding, /step === 17[\s\S]*window\.isFitGotchiHidden\(\)/, 'hidden-mode onboarding should skip character design');
assert.match(onboarding, /const shouldRestoreFitGotchi = !\(typeof window\.isFitGotchiHidden/, 'finishing onboarding should not reload a hidden character');
assert.match(points, /balance-level-number[\s\S]*balance-level-xp-fill/, 'the compact level bar should update from real point data');

const marker = '<!-- FitGotchi display preference. Missing preferences stay visible until onboarding confirms a new member. -->';
const markerIndex = dashboard.indexOf(marker);
const scriptStart = dashboard.indexOf('<script>', markerIndex) + '<script>'.length;
const scriptEnd = dashboard.indexOf('</script>', scriptStart);
assert.ok(markerIndex >= 0 && scriptStart > markerIndex && scriptEnd > scriptStart, 'visibility controller should be extractable');
const controller = dashboard.slice(scriptStart, scriptEnd);

const storage = new Map();
const classes = new Set();
const sandbox = {
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  document: {
    documentElement: {
      classList: {
        toggle(name, force) {
          if (force) classes.add(name);
          else classes.delete(name);
        }
      }
    },
    getElementById: () => null,
    addEventListener: () => {}
  },
  CustomEvent: function(type, init) { this.type = type; this.detail = init.detail; },
  setTimeout: fn => fn(),
  console
};
sandbox.window = sandbox;
sandbox.window.dispatchEvent = () => {};
vm.runInNewContext(controller, sandbox);

assert.strictEqual(sandbox.getFitGotchiVisibility(), 'visible', 'a missing preference must leave returning members unchanged');
assert.strictEqual(classes.has('pbb-fitgotchi-hidden'), false, 'FitGotchi should remain visible without a confirmed new-member default');
sandbox.setFitGotchiVisibility('hidden');
assert.strictEqual(storage.get('pbb_fitgotchi_visibility'), 'hidden', 'the member choice should persist');
assert.strictEqual(classes.has('pbb-fitgotchi-hidden'), true, 'the hidden choice should switch Home to the compact level bar');
let characterPromptCount = 0;
sandbox.openCharacterCustomizationShortcut = () => { characterPromptCount += 1; };
storage.set('pbb_fitgotchi_needs_character_setup', 'true');
sandbox.toggleFitGotchiVisibility();
assert.strictEqual(storage.get('pbb_fitgotchi_visibility'), 'visible', 'the member should be able to reveal FitGotchi again');
assert.strictEqual(characterPromptCount, 1, 'a new member should see character design on the first reveal');
assert.strictEqual(storage.has('pbb_fitgotchi_needs_character_setup'), false, 'the first reveal should consume the setup prompt');
assert.strictEqual(storage.get('pbb_fitgotchi_character_setup_prompted'), 'true', 'the prompt should be recorded as used');
sandbox.toggleFitGotchiVisibility();
sandbox.toggleFitGotchiVisibility();
assert.strictEqual(characterPromptCount, 1, 'later hide and reveal toggles should not reopen character design');

console.log('FitGotchi visibility tests passed');
