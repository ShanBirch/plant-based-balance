const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const stravaSync = fs.readFileSync(path.join(root, 'netlify/edge-functions/strava-sync.js'), 'utf8');
const stravaUi = fs.readFileSync(path.join(root, 'js/dashboard/script_part_10.js'), 'utf8');
const activityScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const helpers = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');
assert.match(stravaSync, /route_polyline:\s*routePolyline/, 'Strava sync should save its privacy-filtered summary route in activity metadata');
assert.match(stravaSync, /syncStravaActivitiesToActivityLogs\(supabase, userId, activitiesData\)/, 'synced Strava activities should enter the existing Balance activity timeline');
assert.match(stravaSync, /source:\s*"strava"[\s\S]*route_available:\s*Boolean\(routePolyline\)/, 'imported activity metadata should identify the source and route availability');
assert.match(stravaSync, /routeByActivityId[\s\S]*route_polyline: routeByActivityId/, 'Strava activity responses should expose the saved route to the dashboard');
assert.match(helpers, /source:\s*activityData\.source \|\| 'manual'[\s\S]*source_metadata:\s*activityData\.source_metadata \|\| \{\}/, 'activity helper should preserve wearable source metadata');

assert.match(dashboard, /id="strava-share-route-btn"[\s\S]*Share route to Feed/, 'Strava dashboard should expose a route-share action');
assert.match(dashboard, /script_part_10\.js\?v=strava-route-v1/, 'phones should fetch the new Strava route-share controller');
assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=24/, 'phones should fetch the route-aware activity-card renderer');
assert.match(dashboard, /id:\s*'strava-route-photo-overlay-v1'/, 'route sharing should have a returning-user Feature Drop');
assert.match(dashboard, /title:'Share your route'/, 'route sharing should be included in the new-user guided tour');
assert.match(stravaUi, /window\._latestStravaActivity = latest \|\| null/, 'latest Strava activity should be retained for sharing');
assert.match(stravaUi, /latest && latest\.route_polyline \? 'block' : 'none'/, 'route-share action should only appear when a route exists');
assert.match(stravaUi, /async function shareLatestStravaRoute\(\)[\s\S]*openStravaActivityForSharing/, 'the route button should hand off to the standard Balance share flow');

assert.match(activityScript, /function pbbShareDecodeRoutePolyline\(/, 'share renderer should decode route polylines');
assert.match(activityScript, /function pbbShareDrawActivityRoute\(/, 'share renderer should draw the route overlay');
assert.match(activityScript, /cardPayload\.route_polyline = savedActivityData\.routePolyline/, 'feed card should retain an opted-in route');
assert.match(activityScript, /savedActivityData\.photoBase64 \|\| cardPayload\.route_polyline/, 'a route card should still render if the member has no photo');
assert.match(activityScript, /window\.openStravaActivityForSharing = async function/, 'Strava route shares should reuse the Balance activity share sheet');

const decoderSource = (activityScript.match(/function pbbShareDecodeRoutePolyline\(polyline\) \{[\s\S]*?\n\}/) || [])[0];
assert.ok(decoderSource, 'route decoder source should be extractable for a real encoded route check');
const routeSandbox = {};
vm.runInNewContext(`${decoderSource}; this.decodeRoute = pbbShareDecodeRoutePolyline;`, routeSandbox);
const decoded = routeSandbox.decodeRoute('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
assert.deepStrictEqual(JSON.parse(JSON.stringify(decoded)), [
  { lat: 38.5, lng: -120.2 },
  { lat: 40.7, lng: -120.95 },
  { lat: 43.252, lng: -126.453 }
], 'route decoder should preserve an encoded GPS route shape');

console.log('strava route share tests passed');
