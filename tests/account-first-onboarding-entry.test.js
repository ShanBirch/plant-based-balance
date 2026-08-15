const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('paid preview requires account creation before onboarding and preserves the in-app handoff', () => {
    const login = read('login.html');
    const founders = read('plant-based-fitness.html');
    const preview = read('meta-app-preview.html');
    const trial = read('lib/meta-ad-trial.js');
    const android = read('android/app/src/main/java/com/fitgotchi/app/MainActivity.java');
    const ios = read('ios/App/App/ViewController.swift');

    assert.match(founders, /params\.delete\('guest'\)/);
    assert.match(founders, /params\.set\('account_first', '1'\)/);
    assert.match(founders, /Create your free account/);
    assert.match(preview, /\/login\.html\?action=signup&/);
    assert.match(login, /Continue with Apple[\s\S]*Continue with Google[\s\S]*or sign up with email/);
    assert.match(login, /isAccountFirstPreview/);
    assert.match(login, /postAuthDestination/);
    assert.doesNotMatch(login, /startFoundationsPreview/);
    assert.match(trial, /state\.accountFirst/);
    assert.match(trial, /session\.removeItem\('guestMode'\)/);
    assert.match(android, /account_first[\s\S]*\/login\.html\?action=signup/);
    assert.match(ios, /account_first[\s\S]*\/login\.html\?action=signup/);
});
