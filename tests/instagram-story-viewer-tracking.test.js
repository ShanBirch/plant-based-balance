const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationsDir)
    .find((name) => name.endsWith('_track_instagram_story_viewers.sql'));

assert.ok(migrationName, 'Instagram Story viewer tracking migration is missing');

const sql = fs.readFileSync(path.join(migrationsDir, migrationName), 'utf8');

assert.match(sql, /CREATE TABLE public\.ig_story_viewer_snapshots/i);
assert.match(sql, /CREATE TABLE public\.ig_story_viewer_observations/i);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
assert.match(sql, /REVOKE ALL ON TABLE public\.ig_story_viewer_snapshots FROM PUBLIC, anon, authenticated/i);
assert.match(sql, /record_ig_story_viewer_snapshot/i);
assert.match(sql, /UNIQUE \(ig_account, run_id, story_id\)/i);
assert.match(sql, /get_ig_story_viewer_rankings/i);
assert.match(sql, /is_complete = TRUE/i);
assert.match(sql, /count\(DISTINCT s\.story_id\)/i);

console.log('Instagram Story viewer tracking migration contract passed');
