const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const activityScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-10-points_widget_functions.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const helpers = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');
const capacitorConfig = fs.readFileSync(path.join(root, 'capacitor.config.ts'), 'utf8');
const iosInfo = fs.readFileSync(path.join(root, 'ios/App/App/Info.plist'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');

assert.match(helpers, /source:\s*activityData\.source \|\| 'manual'[\s\S]*source_metadata:\s*activityData\.source_metadata \|\| \{\}/, 'activity helper should preserve wearable source metadata');
assert.match(packageJson, /"@capgo\/background-geolocation":\s*"\^8\.2\.0"/, 'native shells should include the Balance GPS recorder');
assert.match(capacitorConfig, /useLegacyBridge:\s*true/, 'Android should retain route callbacks while the phone is locked');
assert.match(iosInfo, /NSLocationAlwaysAndWhenInUseUsageDescription[\s\S]*<string>location<\/string>/, 'iOS should explain and enable user-started background route recording');
assert.doesNotMatch(netlifyConfig, /api\/strava|strava-auth|strava-sync/i, 'Netlify should expose no Strava OAuth or sync routes');
assert.strictEqual(fs.existsSync(path.join(root, 'netlify/edge-functions/strava-auth.js')), false, 'Strava auth function should be removed');
assert.strictEqual(fs.existsSync(path.join(root, 'netlify/edge-functions/strava-sync.js')), false, 'Strava sync function should be removed');
assert.strictEqual(fs.existsSync(path.join(root, 'js/dashboard/script_part_10.js')), false, 'Strava dashboard controller should be removed');

assert.match(dashboard, /id="activity-route-section"[\s\S]*Record with Balance GPS/, 'activity logger should expose Balance GPS route recording');
assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=28/, 'phones should fetch the native route-aware activity renderer');
assert.match(dashboard, /id:\s*'balance-native-gps-route-recording-v1'/, 'native route recording should have a returning-user Feature Drop');
assert.match(dashboard, /title:'Balance records your route'/, 'native route recording should be included in the guided tour');
assert.doesNotMatch(dashboard, /Strava/i, 'the Balance UI should not mention or depend on Strava');

assert.match(activityScript, /async function startBalanceRouteTracking\(\)/, 'Balance should start its own GPS route recorder');
assert.match(activityScript, /window\.Capacitor\?\.Plugins\?\.BackgroundGeolocation/, 'native apps should use the background GPS plugin');
assert.match(activityScript, /navigator\.geolocation\.watchPosition/, 'the web app should retain a foreground GPS fallback');
assert.match(activityScript, /source:\s*routePolyline \? 'balance_gps' : 'manual'/, 'recorded routes should be identified as Balance GPS data');
assert.match(activityScript, /provider:\s*'Balance GPS'/, 'route share metadata should name Balance as the recorder');
assert.match(activityScript, /function pbbShareDecodeRoutePolyline\(/, 'share renderer should decode route polylines');
assert.match(activityScript, /function pbbShareDrawActivityRoute\(/, 'share renderer should draw the route overlay');
assert.match(activityScript, /cardPayload\.route_polyline = savedActivityData\.routePolyline/, 'feed card should retain an opted-in route');
assert.match(activityScript, /savedActivityData\.photoBase64 \|\| cardPayload\.route_polyline/, 'a route card should still render if the member has no photo');

const decoderSource = (activityScript.match(/function pbbShareDecodeRoutePolyline\(polyline\) \{[\s\S]*?\n\}/) || [])[0];
assert.ok(decoderSource, 'route decoder source should be extractable for a real encoded route check');
const encoderStart = activityScript.indexOf('function encodeBalanceRoutePolyline(points) {');
const encoderEnd = activityScript.indexOf('\nfunction persistBalanceRouteTracker()', encoderStart);
const encoderSource = activityScript.slice(encoderStart, encoderEnd);
assert.ok(encoderStart >= 0 && encoderEnd > encoderStart, 'Balance route encoder source should be extractable');
const routeSandbox = {};
vm.runInNewContext(`${encoderSource}; ${decoderSource}; this.encodeRoute = encodeBalanceRoutePolyline; this.decodeRoute = pbbShareDecodeRoutePolyline;`, routeSandbox);
const decoded = routeSandbox.decodeRoute('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
assert.deepStrictEqual(JSON.parse(JSON.stringify(decoded)), [
  { lat: 38.5, lng: -120.2 },
  { lat: 40.7, lng: -120.95 },
  { lat: 43.252, lng: -126.453 }
], 'route decoder should preserve an encoded GPS route shape');

const balanceRoute = [
  { latitude: -28.0167, longitude: 153.4000 },
  { latitude: -28.0161, longitude: 153.4010 },
  { latitude: -28.0154, longitude: 153.4021 }
];
const roundTrip = routeSandbox.decodeRoute(routeSandbox.encodeRoute(balanceRoute));
assert.deepStrictEqual(JSON.parse(JSON.stringify(roundTrip)), [
  { lat: -28.0167, lng: 153.4 },
  { lat: -28.0161, lng: 153.401 },
  { lat: -28.0154, lng: 153.4021 }
], 'Balance GPS points should survive the encoded route round trip used by share cards');

console.log('Balance native route tracking tests passed');
