const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../lib/learning-inline.js'), 'utf8');
const start = source.indexOf('    function isCourseStarted(course)');
const body = source.slice(start, source.indexOf('    function markCourseStarted', start));
function started(course, marked = false) {
  const context = { course, getCourseStartedKey: () => 'course', localStorage: { getItem: () => marked ? '1' : null } };
  return vm.runInNewContext(body + '\nisCourseStarted(course)', context);
}
test('community action alone does not start the Foundations course', () => {
  assert.equal(started({ type:'foundations', progress:{completed:1, quizCompleted:0} }), false);
});
test('opening a course or completing a quiz counts as started', () => {
  assert.equal(started({ type:'foundations', progress:{completed:0, quizCompleted:0} }, true), true);
  assert.equal(started({ type:'foundations', progress:{completed:1, quizCompleted:1} }), true);
});
test('other course progress retains its existing behavior', () => {
  assert.equal(started({ type:'master', progress:{completed:1} }), true);
  assert.equal(started({ type:'master', progress:{completed:0} }), false);
});
