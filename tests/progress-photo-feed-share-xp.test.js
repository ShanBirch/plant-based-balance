const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const progressPhoto = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-progressphoto.js'), 'utf8');
const pointsConfig = fs.readFileSync(path.join(root, 'lib/points-config.js'), 'utf8');
const coachContext = fs.readFileSync(path.join(root, 'netlify/functions/_lib/client-context.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260713000000_progress_photo_feed_share_20_xp.sql'), 'utf8');

assert.match(dashboard, /Share to Feed \+20 XP/, 'progress photo share button should advertise 20 XP');
assert.strictEqual((dashboard.match(/extra 20 XP/g) || []).length, 2, 'both progress photo feature guides should advertise 20 XP');
assert.match(progressPhoto, /const PROGRESS_PHOTO_SHARE_POINTS = 20;/, 'client-side progress photo state should show 20 XP');
assert.match(pointsConfig, /POINTS_PER_PROGRESS_PHOTO_SHARE:\s*20/, 'points configuration should define a 20 XP progress photo share');
assert.match(coachContext, /weekly progress photo to Feed \+20 XP once/, 'coach XP guidance should describe the 20 XP share reward');
assert.match(migration, /v_points INTEGER := 20;/, 'database function should award 20 XP');
assert.match(migration, /PERFORM public\.increment_user_points\(p_user_id, v_points\);/, 'database function should credit the configured 20 XP reward');

console.log('progress photo Feed share XP tests passed');
