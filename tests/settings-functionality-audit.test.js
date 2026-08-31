const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const dashboard = read('dashboard.html');
const profile = read('js/dashboard/dashboard-script-4-symptoms_list_removed_symptoms.js');
const settings = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const spotify = read('js/dashboard/script_part_11.js');
const install = read('js/dashboard/script_part_25.js');

test('FitGotchi customisation remains connected to the live character editor', () => {
  assert.match(dashboard, /onclick="openCharacterCustomizationShortcut\(\)"/);
  assert.match(settings, /window\.openCharacterCustomizationShortcut = function\(\)/);
  assert.match(settings, /currentWizardStep = 17/);
  assert.match(settings, /initializeCharacterCustomization\(\)/);
  assert.match(settings, /window\.saveCharacterColors/);
});

test('profile edit does not pretend to change the login email', () => {
  assert.doesNotMatch(profile, /\{ id: 'profile-email-display', type: 'text' \}/);
  assert.doesNotMatch(profile, /\{ id: 'profile-email-display', key: 'email' \}/);
  assert.match(profile, /const userColumns = \['name'\]/);
});

test('profile photos restore from and sync to the signed-in account', () => {
  assert.match(settings, /localStorage\.getItem\('profile_photo'\) \|\| profile\?\.profile_photo/);
  assert.match(settings, /async function syncProfilePhotoToAccount\(photoData\)/);
  assert.match(settings, /users\.update\(window\.currentUser\.id, \{ profile_photo: photoData \}\)/);
  assert.equal((settings.match(/syncProfilePhotoToAccount\(photoData\);/g) || []).length, 2);
});

test('notification management has both native and browser actions', () => {
  assert.match(settings, /async function openAppNotificationSettings\(\)/);
  assert.match(settings, /openNotificationSettings/);
  assert.match(settings, /Notification\.requestPermission\(\)/);
  assert.match(settings, /Notifications are blocked in your browser settings/);
});

test('Health explains the mobile-app requirement instead of looping on web', () => {
  assert.match(dashboard, /Health sync needs the mobile app/);
  assert.match(dashboard, /Available in the iPhone and Android app/);
  const acceptBody = dashboard.match(/function acceptHealthConnect\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(acceptBody, /toggleHealthConnect\(\)/);
  const showBody = dashboard.match(/function showHealthConnectModal\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(showBody, /window\.guestMode/);
  assert.match(dashboard, /function checkHealthConnectPrompt\(\) \{\s*if \(window\.guestMode\) return/);
  const toggleBody = dashboard.match(/function toggleHealthConnect\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(toggleBody.indexOf('showHealthConnectModal();') < toggleBody.indexOf('if (!window.currentUser) return;'));
});

test('payment management follows the platform used for payment', () => {
  assert.match(dashboard, /Payments &amp; subscription/);
  assert.match(settings, /apps\.apple\.com\/account\/subscriptions/);
  assert.match(settings, /play\.google\.com\/store\/account\/subscriptions\?package=com\.fitgotchi\.app/);
  assert.match(settings, /create-billing-portal-session/);
});

test('social-login members can add a password without a fake current password', () => {
  assert.match(dashboard, /var usesSocialLogin = provider !== 'email'/);
  assert.match(dashboard, /currentInput\.required = !usesSocialLogin/);
  assert.match(dashboard, /usesSocialLogin \? 'none' : 'block'/);
});

test('download and Spotify keep only confirmed-success states', () => {
  assert.equal((install.match(/window\.installPWA\s*=\s*async function/g) || []).length, 1);
  assert.match(spotify, /if \(!res\.ok\) throw new Error\(data\.error \|\| 'Spotify status could not be loaded'\)/);
  assert.match(spotify, /if \(!res\.ok\) throw new Error\(data\.error \|\| 'Spotify could not be disconnected'\)/);
});

test('changed Settings scripts are cache-busted for returning phones', () => {
  assert.match(dashboard, /script_part_11\.js\?v=settings-functionality-v1/);
  assert.match(dashboard, /dashboard-script-4-symptoms_list_removed_symptoms\.js\?v=settings-functionality-v1/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=223-settings-functionality/);
  assert.match(dashboard, /script_part_25\.js\?v=settings-functionality-v1/);
  assert.match(read('sw.js'), /pbb-app-v424-settings-functionality/);
});
