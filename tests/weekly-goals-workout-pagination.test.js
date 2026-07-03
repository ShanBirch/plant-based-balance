const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../js/dashboard/pbb-deferred-weeklygoals.js'),
  'utf8'
);

assert.ok(
  source.includes('async function safePagedQuery'),
  'Weekly Goals should expose a paged query helper for high-volume tables'
);

assert.ok(
  /safePagedQuery\('workouts history'[\s\S]+\.from\('workouts'\)[\s\S]+\.select\('workout_date'\)[\s\S]+\.range\(from, to\)/.test(source),
  'Weekly Goals workout history must page through workout_date rows instead of relying on the REST default row cap'
);

assert.ok(
  !source.includes("safeQuery('workouts history'"),
  'Weekly Goals workout history should not use the single-page query path'
);

console.log('weekly-goals workout pagination test passed');
