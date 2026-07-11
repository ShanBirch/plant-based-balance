const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migrationFile = fs.readdirSync(path.join(root, 'supabase/migrations'))
  .find(file => file.endsWith('_feed_comment_xp_turn_taking.sql'));
assert.ok(migrationFile, 'turn-taking migration should exist');
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations', migrationFile),
  'utf8'
);
const stories = fs.readFileSync(path.join(root, 'lib/stories.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.match(migration, /v_previous_commenter_id UUID/);
assert.match(migration, /fc\.id <> NEW\.id/);
assert.match(migration, /ORDER BY fc\.created_at DESC, fc\.id DESC/);
assert.match(migration, /IF v_story_owner_id = NEW\.user_id THEN/);
assert.match(migration, /v_previous_commenter_id IS NULL OR v_previous_commenter_id = NEW\.user_id/);
assert.match(migration, /ELSIF v_previous_commenter_id = NEW\.user_id THEN/);
assert.match(migration, /Replied to a comment on own Feed post/);
assert.match(stories, /\+2 XP after a reply/);
assert.match(dashboard, /feed-comment-xp-turn-taking-v1/);
assert.match(dashboard, /Comment XP is turn-based/);

console.log('feed comment XP turn-taking tests passed');
