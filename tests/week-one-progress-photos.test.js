const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/dashboard/pbb-social-journey.js'), 'utf8');
function fixture() {
  const c = { console, URLSearchParams, Intl, Date, setTimeout() {}, photos: [], writes: [],
    document: { getElementById() { return null; } },
    localStorage: { getItem() { return 'true'; } }, sessionStorage: { getItem() { return null; } } };
  c.window = c;
  c.location = { hostname: 'localhost', search: '' };
  c.currentUser = { id: 'test-member' };
  c.supabaseClient = { from(table) {
    let payload;
    const q = { upsert(p) { payload = p; c.writes.push(p); return q; },
      then(resolve) { return Promise.resolve({ data: payload || (table === 'weekly_progress_photos' ? c.photos : table === 'stories' ? [{ course_action_id: 'w1_feed_intro', caption: 'Hello' }] : []) }).then(resolve); } };
    for (const method of ['select', 'eq', 'neq', 'gte', 'lt', 'in', 'not', 'order', 'limit', 'single']) q[method] = () => q;
    return q;
  } };
  const cut = source.indexOf('  window.finishBalanceActivationLesson');
  vm.runInNewContext(source.slice(0, cut) + `window.fixture = {
    set: row => { state = normalizeState(row); }, calculateProgress, getUnifiedAction,
    getFoundationsCourseProgress, taskAction, renderTasks,
    valid: isCourseProgressPhotoSet
  }; })();`, c);
  c.fixture.set({ current_week: 1, week_started_at: '2026-09-07', settings: {
    lesson_seen_weeks: [1], fitgotchi_intro: { completed_at: 'yes' }, foundations_wearable_setup: { status: 'no_compatible_watch' }
  } });
  return c;
}
function photo(angles = ['front', 'side', 'back'], saved_at = '2026-09-08T00:00:00Z') {
  return { created_at: '2026-09-01T00:00:00Z', notes: JSON.stringify({ saved_at, shots: angles.map(angle => ({ angle, photo_url: 'https://example.test/' + angle })) }) };
}
test('only all three saved angles inside the course week count, including replacement calendar rows', () => {
  const { valid } = fixture().fixture;
  const check = row => valid(row, '2026-09-06T14:00:00Z', '2026-09-13T14:00:00Z');
  assert.equal(check(photo()), true);
  for (const row of [photo(['front']), photo(['front', 'front', 'back']), photo(undefined, '2026-09-06T13:59:59Z'), photo(undefined, '2026-09-13T14:00:00Z'), { notes: 'invalid' }]) assert.equal(check(row), false);
});
test('one photo action drives To Do Next, course progress and the persisted snapshot', async () => {
  const c = fixture();
  await c.fixture.calculateProgress();
  assert.equal(c.fixture.getUnifiedAction().taskId, 'w1_progress_photos');
  c.openProgressPhotoCapture = () => { c.opened = true; };
  await c.fixture.taskAction('w1_progress_photos');
  assert.equal(c.opened, true);
  assert.equal(c.fixture.getFoundationsCourseProgress().weekProgress[0].tasks.find(t => t.id === 'w1_progress_photos').complete, false);
  c.photos = [photo()];
  await c.fixture.calculateProgress();
  assert.notEqual(c.fixture.getUnifiedAction()?.taskId, 'w1_progress_photos');
  const saved = c.writes.at(-1);
  assert.equal(saved.progress_snapshot.tasks.find(t => t.id === 'w1_progress_photos').complete, true);
  assert.equal(saved.settings.foundation_week_progress['1'].tasks.find(t => t.id === 'w1_progress_photos').complete, true);
  assert.match(c.fixture.renderTasks(), /Photos saved ✓/);
});
test('members already beyond week one are not relocked by the added action', () => {
  const c = fixture(); c.fixture.set({ current_week: 2, settings: {} });
  const task = c.fixture.getFoundationsCourseProgress().weekProgress[0].tasks.find(t => t.id === 'w1_progress_photos');
  assert.equal(task.complete, true);
  assert.equal(task.actionLabel, 'Not required for your earlier week');
});
