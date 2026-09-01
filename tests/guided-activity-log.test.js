const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const activityScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('activity logging uses the approved three-step guided flow', () => {
  assert.match(dashboard, /id="activity-guided-step-1"[\s\S]*What did you do\?/);
  assert.match(dashboard, /id="activity-guided-step-2"[\s\S]*Add the details/);
  assert.match(dashboard, /id="activity-guided-step-3"[\s\S]*Ready to save\?/);
  assert.match(activityScript, /function setActivityGuidedStep\(step\)[\s\S]*activityGuidedStep/);
  assert.match(activityScript, /async function advanceActivityGuidedStep\(\)[\s\S]*stopBalanceRouteTracking\(\{ silent: true \}\)[\s\S]*setActivityGuidedStep/);
  assert.doesNotMatch(activityScript, /title\.textContent = isPilot \? 'Log your movement'/);
});

test('guided GPS uses the real Balance route recorder and saves its route', () => {
  assert.match(dashboard, /id="activity-route-toggle-btn"[\s\S]*toggleBalanceRouteTracking\(\)/);
  assert.match(activityScript, /navigator\.geolocation\.watchPosition/);
  assert.match(activityScript, /window\.Capacitor\?\.Plugins\?\.BackgroundGeolocation/);
  assert.match(activityScript, /route_polyline: routePolyline[\s\S]*source: routePolyline \? 'balance_gps' : 'manual'/);
  assert.match(activityScript, /activity-guided-review-gps[\s\S]*balanceRouteTracker\.distanceMeters/);
});

test('photos happen after save and reveal both sharing destinations', () => {
  const formStart = dashboard.indexOf('id="view-log-activity"');
  const successStart = dashboard.indexOf('id="view-activity-success"');
  const formMarkup = dashboard.slice(formStart, successStart);
  const successMarkup = dashboard.slice(successStart, dashboard.indexOf('<!-- QUICK SHARE TO GROUP CHAT MODAL -->'));
  assert.doesNotMatch(formMarkup, /Photo or workout screenshot|Add venue photo for XP/);
  assert.match(successMarkup, /Add a photo or screenshot/);
  assert.match(successMarkup, /id="activity-share-destination-actions" style="display:none;/);
  assert.match(successMarkup, /id="activity-share-btn"[\s\S]*Balance Feed/);
  assert.match(successMarkup, /id="activity-share-instagram-btn"[\s\S]*IG Story/);
  assert.match(activityScript, /useActivitySharePhotoFile[\s\S]*activity-share-destination-actions[\s\S]*style\.display = 'grid'/);
});

test('guided activity surfaces use paired Balance themes and refresh returning phones', () => {
  assert.match(dashboard, /#view-log-activity \{ --activity-accent:#d6ad55/);
  assert.match(dashboard, /html\[data-pbb-theme="light"\] #view-log-activity \{ --activity-accent:#9a6b12/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=50-guided-activity/);
  assert.match(serviceWorker, /pbb-app-v455-guided-activity-log/);
});
