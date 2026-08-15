const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('fresh and legacy launches default to light mode', () => {
  const dashboard = read('dashboard.html');
  const login = read('login.html');
  const authGuard = read('lib/auth-guard.js');
  const userData = read('js/dashboard/dashboard-script-3-1_get_user_data.js');

  assert.match(dashboard, /var savedTheme = storedTheme === 'dark' \? 'dark' : 'light'/);
  assert.match(dashboard, /if \(storedTheme !== savedTheme\) localStorage\.setItem\('userThemePreference', savedTheme\)/);
  assert.match(login, /var savedTheme = storedTheme === 'dark' \? 'dark' : 'light'/);
  assert.match(login, /setAttribute\('data-pbb-theme', 'light'\)/);
  assert.match(authGuard, /userThemePreference: 'light'/);
  assert.match(userData, /userThemePreference'\) === 'dark' \? 'dark' : 'light'/);
});

test('dark mode remains an explicit persistent choice', () => {
  const dashboard = read('dashboard.html');
  const shell = read('js/dashboard/script_part_4.js');
  const themeLogic = read('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js');

  assert.match(dashboard, /<option value="dark">Dark Mode<\/option>/);
  assert.match(dashboard, /<option value="light">Light Mode<\/option>/);
  assert.match(shell, /themeKey = themeKey === 'dark' \? 'dark' : 'light'/);
  assert.match(themeLogic, /themeKey = themeKey === 'dark' \? 'dark' : 'light'/);
  assert.match(themeLogic, /APP_THEMES\[themeKey === 'dark' \? 'default' : 'light'\]/);
  assert.match(themeLogic, /theme_preference: themeKey/);
});

test('the phone shell cache ships the light-launch assets together', () => {
  const dashboard = read('dashboard.html');
  const serviceWorker = read('sw.js');

  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v324'/);
  assert.match(serviceWorker, /auth-guard\.js\?v=12-light-launch/);
  assert.match(serviceWorker, /script_part_2\.js\?v=14-light-launch/);
  assert.match(serviceWorker, /dashboard-script-3-1_get_user_data\.js\?v=59-light-launch/);
  assert.match(dashboard, /script_part_4\.js\?v=theme-toggle-shell-v2/);
  assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=42-welcome-gate/);
});
