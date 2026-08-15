const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const infoPlist = fs.readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');

for (const retiredUi of [
  'id="gym-arrival-card"',
  'id="settings-gym-arrival"',
  "id: 'gym-arrival-shannon-pilot-v1'",
  "title:'Gym Arrival'",
  'pbb-gym-arrival.js'
]) {
  assert.doesNotMatch(dashboard, new RegExp(retiredUi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.doesNotMatch(serviceWorker, /pbb-gym-arrival\.js/);
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v315'/);
assert.match(dashboard, /localStorage\.removeItem\('balance_gym_arrival_v1'\)/);
assert.match(dashboard, /removeGeofence\(\{ identifier: 'balance-shannon-gym-v1' \}\)/);
assert.match(dashboard, /notifications\.cancel\(\{ notifications: \[\{ id: 38021 \}\] \}\)/);
assert.doesNotMatch(infoPlist, /Gym Arrival/);

const cleanupMatch = dashboard.match(/<script>\s*\/\/ Retire the old private Gym Arrival pilot([\s\S]*?)<\/script>/);
assert.ok(cleanupMatch, 'the retired pilot needs a device cleanup migration');

const removedStorageKeys = [];
const removedGeofences = [];
const cancelledNotifications = [];
let initHandler = null;
const windowMock = {
  Capacitor: {
    Plugins: {
      BackgroundGeolocation: {
        removeGeofence(options) {
          removedGeofences.push(options);
          return Promise.resolve();
        }
      },
      LocalNotifications: {
        cancel(options) {
          cancelledNotifications.push(options);
          return Promise.resolve();
        }
      }
    }
  },
  addEventListener(eventName, handler) {
    if (eventName === 'pbbInitComplete') initHandler = handler;
  },
  setTimeout(handler) {
    handler();
  }
};

vm.runInNewContext(`// Retire the old private Gym Arrival pilot${cleanupMatch[1]}`, {
  window: windowMock,
  document: { readyState: 'loading' },
  localStorage: { removeItem(key) { removedStorageKeys.push(key); } },
  Promise
});

assert.deepEqual(removedStorageKeys, ['balance_gym_arrival_v1', 'balance_gym_arrival_state_v1']);
assert.equal(typeof initHandler, 'function');
initHandler();
assert.equal(removedGeofences.length, 1);
assert.equal(removedGeofences[0].identifier, 'balance-shannon-gym-v1');
assert.equal(cancelledNotifications.length, 1);
assert.equal(cancelledNotifications[0].notifications.length, 1);
assert.equal(cancelledNotifications[0].notifications[0].id, 38021);

console.log('Gym Arrival removal contract passed');
