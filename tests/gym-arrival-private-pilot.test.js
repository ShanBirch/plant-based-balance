const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gymArrival = require(path.join(root, 'js/dashboard/pbb-gym-arrival.js'));
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const iosInfo = fs.readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');

assert.equal(gymArrival.isPilotUser({ email: 'shannonbirch@cocospersonaltraining.com' }), true);
assert.equal(gymArrival.isPilotUser({ id: '00a6605e-8edb-4917-85ba-24a23f179059' }), true);
assert.equal(gymArrival.isPilotUser({ email: 'client@example.com' }), false);

assert.ok(gymArrival.distanceMetres(
  { latitude: -28.165, longitude: 153.51 },
  { latitude: -28.165, longitude: 153.51 }
) < 0.01);
assert.ok(gymArrival.distanceMetres(
  { latitude: -28.165, longitude: 153.51 },
  { latitude: -28.1641, longitude: 153.51 }
) > 90);

assert.match(dashboard, /id="gym-arrival-card"/);
assert.match(dashboard, /id="settings-gym-arrival" style="display:none;/);
assert.match(dashboard, /gym-arrival-shannon-pilot-v1/);
assert.match(dashboard, /isGymArrivalPilotUser/);
assert.equal((dashboard.match(/pbb-gym-arrival\.js\?v=1/g) || []).length, 1);
assert.match(serviceWorker, /pbb-gym-arrival\.js\?v=1/);
assert.match(serviceWorker, /pbb-app-v280/);
assert.match(iosInfo, /optional Gym Arrival reminders you enable/);

console.log('Gym Arrival private pilot checks passed');
