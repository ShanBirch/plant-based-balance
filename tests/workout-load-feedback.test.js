const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js', 'utf8');
const html = fs.readFileSync('dashboard.html', 'utf8');
function harness(create = async () => {}) {
  const buttons = ['too_light', 'perfect', 'too_heavy'].map(choice => ({
    dataset: { workoutLoad: choice }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }
  }));
  const elements = Object.fromEntries(['save-rating-btn', 'rating-energy-slider', 'rating-workout-name', 'workout-rating-modal'].map(id => [id, { style: {}, value: 3 }]));
  const saved = [], storage = {};
  let back;
  const context = vm.createContext({
    document: { querySelectorAll: () => buttons, getElementById: id => elements[id] },
    window: { currentUser: { id: 'test-user' }, dbHelpers: { workoutRatings: { create: async (id, row) => { saved.push(row); return create(row); } } } },
    localStorage: { getItem: key => storage[key], setItem: (key, value) => { storage[key] = value; } },
    pushNavigationState: (id, handler) => { back = handler; },
    syncAndroidHistoryAfterSwipe() {}, getLocalDateString: () => '2026-10-03', showToast() {}, console, setTimeout
  });
  vm.runInContext(source.slice(source.indexOf('let workoutRatingState = {'), source.indexOf('/* ', source.indexOf('let workoutRatingState = {'))), context);
  return { context, buttons, elements, saved, storage, back: () => back() };
}
test('unanswered, skip, back and reopening never save or retain a selection', async () => {
  const h = harness(), c = h.context;
  c.openWorkoutRatingModal('Back');
  assert.equal(h.elements['save-rating-btn'].disabled, true);
  await c.saveWorkoutRating();
  assert.equal(h.saved.length, 0);
  c.selectIntensityPref('too_heavy'); h.back();
  assert.equal(h.elements['workout-rating-modal'].style.display, 'none');
  c.openWorkoutRatingModal('Next');
  assert.ok(h.buttons.every(b => b.attrs['aria-pressed'] === 'false'));
  c.selectIntensityPref('too_light'); c.skipWorkoutRating();
  await c.saveWorkoutRating(); assert.equal(h.saved.length, 0);
});
test('each choice persists exact provenance and correct preference; repeated taps stay single choice', async () => {
  const h = harness(), c = h.context;
  for (const [choice, preference, difficulty] of [['too_light', 'harder', 1], ['perfect', 'perfect', 3], ['too_heavy', 'lighter', 5]]) {
    c.openWorkoutRatingModal('Workout', 'activity', 'activity-id');
    c.selectIntensityPref('too_light'); c.selectIntensityPref(choice); c.selectIntensityPref(choice);
    assert.equal(h.buttons.filter(b => b.attrs['aria-pressed'] === 'true').length, 1);
    h.elements['rating-energy-slider'].value = 2;
    await c.saveWorkoutRating();
    const row = h.saved.at(-1);
    assert.equal(row.intensity_preference, preference); assert.equal(row.difficulty, difficulty);
    assert.equal(JSON.parse(row.notes).load_choice, choice);
    assert.equal(JSON.parse(row.notes).feedback_version, 'workout_load_buttons_v1');
    assert.equal(row.energy_level, 2); assert.equal(row.source_id, 'activity-id');
    await c.saveWorkoutRating();
  }
  assert.equal(h.saved.length, 3);
});
test('double save, changing choice or reopening during save cannot duplicate or alter the response', async () => {
  let release;
  const h = harness(() => new Promise(resolve => { release = resolve; })), c = h.context;
  c.openWorkoutRatingModal('Workout'); c.selectIntensityPref('too_heavy');
  const pending = c.saveWorkoutRating(); await Promise.resolve(); await Promise.resolve();
  c.selectIntensityPref('too_light'); c.openWorkoutRatingModal('Other'); c.skipWorkoutRating();
  await c.saveWorkoutRating();
  assert.equal(h.saved.length, 1); assert.equal(h.saved[0].intensity_preference, 'lighter');
  release(); await pending;
  c.openWorkoutRatingModal('Other'); assert.equal(h.elements['save-rating-btn'].disabled, true);
});
test('failed save retains exact explicit choice in the existing offline queue', async () => {
  const h = harness(async () => { throw new Error('offline'); }), c = h.context;
  c.openWorkoutRatingModal('Workout'); c.selectIntensityPref('too_light'); await c.saveWorkoutRating();
  const queued = JSON.parse(h.storage.pbb_pending_workout_ratings);
  assert.equal(queued.length, 1); assert.equal(JSON.parse(queued[0].notes).load_choice, 'too_light');
  c.openWorkoutRatingModal('Next'); assert.equal(h.elements['save-rating-btn'].disabled, true);
});
function ratingsHelper(rows) {
  const lib = fs.readFileSync('lib/supabase.js', 'utf8');
  const start = lib.indexOf('  workoutRatings: {'), end = lib.indexOf('\n  /**', start);
  let inserted;
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, gte() { return this; }, insert(rows) { inserted = rows[0]; return this; }, single: async () => ({ data: inserted }), then(resolve) { resolve({ data: rows }); } };
  const c = vm.createContext({ supabase: { from: () => query }, getLocalDateString: () => '2026-10-03' });
  const helper = vm.runInContext('({' + lib.slice(start, end) + '}).workoutRatings', c);
  return { helper, inserted: () => inserted };
}
test('real persistence helper keeps provenance and does not default a missing preference to perfect', async () => {
  const h = ratingsHelper([]);
  await h.helper.create('user', { difficulty: 5, notes: '{"feedback_version":"workout_load_buttons_v1","load_choice":"too_heavy"}', intensity_preference: 'lighter' });
  assert.equal(h.inserted().intensity_preference, 'lighter'); assert.match(h.inserted().notes, /too_heavy/);
  await h.helper.create('user', { difficulty: 3 }); assert.equal(h.inserted().intensity_preference, null);
});
test('legacy hard/easy/default slider rows never become explicit choices; synthetic scores stay out of difficulty average', async () => {
  const legacy = [4, 2, 3].map(difficulty => ({ difficulty, intensity_preference: difficulty === 4 ? 'lighter' : difficulty === 2 ? 'harder' : 'perfect', notes: null, overall_feeling: 3, energy_level: 3 }));
  const snapshot = JSON.stringify(legacy);
  const explicit = { difficulty: 5, intensity_preference: 'lighter', notes: JSON.stringify({ feedback_version: 'workout_load_buttons_v1', load_choice: 'too_heavy' }), overall_feeling: 3, energy_level: 3 };
  const result = await ratingsHelper([...legacy, explicit]).helper.getAverages('user');
  assert.equal(result.legacyRatingCount, 3); assert.equal(result.intensityBreakdown.lighter, 1);
  assert.equal(result.intensityBreakdown.harder, 0); assert.equal(result.intensityBreakdown.perfect, 0);
  assert.equal(result.avgDifficulty, 3); assert.equal(JSON.stringify(legacy), snapshot);
  assert.equal(result.ratings[3].load_feedback_label, 'Too heavy');
  assert.equal((await ratingsHelper([explicit]).helper.getAverages('user')).avgDifficulty, null);
});
test('accessible exact buttons replace intensity slider and both discovery paths explain them', () => {
  assert.doesNotMatch(html, /id="rating-difficulty-slider"/);
  for (const label of ['Too light', 'Perfect', 'Too heavy']) assert.match(html, new RegExp('aria-pressed="false"[^>]*>'+label+'</button>'));
  assert.match(html, /role="group" aria-labelledby="rating-load-label"/);
  assert.match(html, /id="save-rating-btn" disabled/);
  assert.ok((html.match(/title:'Clear workout feedback'/g) || []).length >= 2);
});
test('check-in, conversation and admin readers explicitly reject legacy preferences as change requests', () => {
  for (const path of ['netlify/functions/_lib/client-context.js', 'netlify/functions/_lib/coaching-conversation-policy.js', 'netlify/edge-functions/admin-ai-coach.ts']) {
    const policy = fs.readFileSync(path, 'utf8');
    assert.match(policy, /never say the client requested lighter or harder training/);
    assert.match(policy, /too_heavy means the client selected Too heavy \(may prefer lighter\)/);
  }
  const context = fs.readFileSync('netlify/functions/_lib/client-context.js', 'utf8');
  assert.match(context, /\$\{WORKOUT_FEEDBACK_POLICY\}[\s\S]*?WEEKLY REVIEW HANDOFF/);
});
