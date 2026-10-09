const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const owner = '00a6605e-8edb-4917-85ba-24a23f179059';
function runtime(window = {}) {
  vm.runInNewContext(fs.readFileSync('lib/balance-course-weeks.js','utf8'),{window});
  return window.BalanceCourseWeeks;
}
test('owner sees every weekly release without a start date or completion writes', () => {
  const window = {currentUser:{id:owner}};
  const weeks = runtime(window);
  assert.equal(weeks.available(null,10),10);
  assert.equal(weeks.available(new Date().toISOString(),10),10);
  assert.equal(weeks.ownerReview(),true);
  window.currentUser = {id:'member'};
  assert.equal(weeks.ownerReview(),false);
  assert.equal(weeks.available(null,10),0);
  assert.equal(weeks.available(new Date().toISOString(),10),1);
});
test('owner exemption is disabled in guest and other-member admin views', () => {
  for (const flag of ['guestMode','isAdminViewing']) {
    const window={currentUser:{id:owner},[flag]:true};
    assert.equal(runtime(window).ownerReview(),false);
  }
});
test('normal members retain seven-day release timing', () => {
  const weeks=runtime({currentUser:{id:'member'}});
  const start='2026-10-01T00:00:00Z';
  assert.equal(weeks.available(start,10,Date.parse('2026-10-07T23:59:59Z')),1);
  assert.equal(weeks.available(start,10,Date.parse('2026-10-08T00:00:00Z')),2);
});
