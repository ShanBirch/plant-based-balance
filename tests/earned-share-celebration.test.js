const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib', 'stories.js'), 'utf8');
const points = fs.readFileSync(path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.ok(stories.includes('function renderBalanceEarnedCelebration('), 'Feed celebration renderer must exist');
assert.ok(stories.includes("renderBalanceEarnedCelebration('activity')"), 'activity cards must celebrate');
assert.ok(stories.includes("renderBalanceEarnedCelebration('pb', { major: true })"), 'PB cards must use the major celebration');
assert.ok(stories.includes("renderBalanceEarnedCelebration('workout', { major: !!pbsHtml })"), 'workout cards must celebrate and escalate PB sessions');
assert.ok(stories.includes('balance-share-photo-celebration'), 'photo-overlay Feed posts must celebrate over the user photo');
assert.ok(stories.includes('const photoCelebrationKind ='), 'photo-overlay Feed posts must select the matching celebration');

assert.ok(points.includes('function pbbShareDrawCelebrationAccents('), 'Instagram canvas accents must exist');
assert.ok(points.includes("const brandTop = target === 'feed' ? 48 : 228"), 'Instagram Story branding must stay below top chrome');
assert.ok(points.includes("const PBB_SHARE_CREATIVE_VARIANT = 'earned_share_motion_v1'"), 'share creative variant must stay stable');
assert.ok(points.includes('metadata.creativeVariant = PBB_SHARE_CREATIVE_VARIANT'), 'completed share rewards must record the creative variant');

assert.ok(dashboard.includes("id: 'earned-share-celebrations-v1'"), 'returning users need a Feature Drop');
assert.ok(dashboard.includes("title:'Your wins now move'"), 'new users need the guided tour step');
assert.ok(dashboard.includes('lib/stories.js?v=76-feed-composer-profile-photo'), 'Feed renderer cache key must be bumped');
assert.ok(dashboard.includes("id: 'instagram-motion-share-v1'"), 'returning users need the motion share Feature Drop');
assert.ok(dashboard.includes('dashboard-script-10-points_widget_functions.js?v=50-guided-activity'), 'share renderer cache key must be bumped');
assert.ok(serviceWorker.includes("const CACHE_NAME = 'pbb-app-v353-photo-stage'"), 'service worker cache must be bumped');
assert.ok(serviceWorker.includes('dashboard-script-10-points_widget_functions.js?v=50-guided-activity'), 'service worker must precache the new renderer');

console.log('earned share celebration contract passed');
