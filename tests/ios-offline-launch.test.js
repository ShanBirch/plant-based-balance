const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('updated iPhone build registers its worker; older builds stay excluded', () => {
  const script = read('dashboard.html').match(/function _pbbRegisterSW\(\) \{[\s\S]*?(?=  if \(\/iP)/)[0];
  for (const enabled of [false, true]) {
    let registrations = 0;
    const context = { window: { _pbbIOSOfflineShellEnabled: enabled }, navigator: {
      userAgent: 'iPhone FitGotchi-Native', serviceWorker: { register() {
        registrations++; return Promise.resolve({update: () => Promise.resolve()});
      }}
    }, console: {log(){}} };
    vm.runInNewContext(script + ';_pbbRegisterSW();', context);
    assert.equal(registrations, enabled ? 1 : 0);
  }
  assert.match(read('capacitor.config.ts'), /limitsNavigationsToAppBoundDomains: true/);
  assert.equal(JSON.parse(read('ios/App/App/capacitor.config.json')).ios.limitsNavigationsToAppBoundDomains, true);
  assert.match(read('ios/App/App/Info.plist'), /<key>WKAppBoundDomains<\/key>\s*<array>\s*<string>plantbased-balance.org<\/string>\s*<string>localhost<\/string>/);
  assert.match(read('ios/App/App/ViewController.swift'), /window\._pbbIOSOfflineShellEnabled = true/);
});

test('startup recovery cannot reveal a different account or pending authentication', () => {
  const source = read('js/dashboard/dashboard-script-3-1_get_user_data.js');
  const handler = source.split('} catch(initError) {')[1].split('\n            try {')[0];
  for (const state of ['valid', 'pending', 'changed', 'absent']) {
    let failed = false, recovered = false;
    const window = {currentUser: state === 'absent' ? null : {id: state === 'changed' ? 'other' : 'member'},
      _pbbAuthGuardPending: state === 'pending', isAdminViewing: false,
      BalanceStartupShell: {fail(){failed=true;}}, dispatchEvent(){recovered=true;}};
    vm.runInNewContext('(function(){' + handler + ')();', {window, startupUserId:'member', startupAdminView:false,
      initError:Error('native widget failed'), Event:class {}, console:{error(){}}});
    assert.equal(failed, state !== 'valid');
    assert.equal(recovered, state === 'valid');
  }
});

test('early optional helpers run only after startup identity is captured', () => {
  const source = read('js/dashboard/dashboard-script-3-1_get_user_data.js');
  assert.ok(source.indexOf('var startupUserId =') < source.indexOf("_crumb('loadChat')"));
  assert.match(source, /if \(typeof loadChat === 'function'\) loadChat\(\)/);
  assert.match(source, /if \(typeof loadJournalHistory === 'function'\) loadJournalHistory\(\)/);
  assert.match(source, /resolve\(isAuthReady\(\) \? \(window.currentUser \|\| null\) : null\)/);
  assert.match(source, /if \(!startupAuth\) \{[\s\S]*?return;/);
});
