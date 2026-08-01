const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const technique = require(path.join(root, 'js/dashboard/pbb-exercise-technique-data.js'));
const catalogSource = fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8');
const catalog = vm.runInNewContext(`${catalogSource}\n;EXERCISE_VIDEOS;`);
const audit = technique.auditExerciseNames(Object.keys(catalog));
const fallbackRate = audit.total ? audit.fallback.length / audit.total : 1;

console.log(`Exercise cue audit: ${audit.total} catalog entries`);
console.log(`Families: ${Object.keys(audit.totals).length}`);
console.log(`Generic fallback: ${audit.fallback.length} (${(fallbackRate * 100).toFixed(2)}%)`);
console.log(`Invalid cue sets: ${audit.invalid.length}`);
console.log(`Suspicious mappings: ${audit.suspicious.length}`);

if (audit.fallback.length) console.log(`Fallback exercises: ${audit.fallback.join(', ')}`);
if (audit.invalid.length) console.error('Invalid:', audit.invalid);
if (audit.suspicious.length) console.error('Suspicious:', audit.suspicious);

if (audit.total < 2500 || fallbackRate > 0.01 || audit.invalid.length || audit.suspicious.length) {
    process.exitCode = 1;
}
