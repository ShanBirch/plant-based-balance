const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/pbb-deferred-weeklygoals.js'), 'utf8');
const window = {};
const context = vm.createContext({ window, document: { readyState: 'loading', addEventListener() {} },
  localStorage: { getItem() { return null; } }, console, Date, Set, setTimeout });
vm.runInContext(source.replace('  window.weeklyGoals = {',
  '  window.testGoals = { normalizeSelected, calculateGoal, loadProgressData };\n  window.weeklyGoals = {'), context);
const { normalizeSelected, calculateGoal, loadProgressData } = window.testGoals;
const catalog = window.weeklyGoals.getCatalog();
assert.deepEqual(Array.from(catalog, g => g.category), ['Body', 'Training', 'Food', 'Recovery', 'Community']);
assert.equal(normalizeSelected(['daily_quiz_days', 'questions_answered', 'perfect_lessons', 'message_coach']).length, 0);
assert.equal(normalizeSelected(['questions_answered', 'message_coach'], true).length, 2);
const goals = normalizeSelected(['challenge_friend', 'complete_workouts', 'meal_log_days']);
assert.equal(goals.length, 3);
assert.equal(goals[0].target, 1);
assert.equal(goals[0].category, 'Community');
const week = { start: '2026-09-07', endExclusive: '2026-09-14', arcStart: '2026-09-01' };
const at = day => day + 'T12:00:00';
const invites = [
  { challenge_id: 'first', invited_at: at('2026-09-07') },
  { challenge_id: 'first', invited_at: at('2026-09-08') },
  { challenge_id: 'second', invited_at: at('2026-09-13') },
  { challenge_id: 'old', invited_at: at('2026-09-06') },
  { challenge_id: 'next', invited_at: at('2026-09-14') }
];
assert.equal(calculateGoal(goals[0], { challengeInvites: invites }, week).current, 2);
assert.equal(calculateGoal(goals[0], { challengeInvites: [] }, week).complete, false);
assert.equal(calculateGoal({ ...goals[0], target: 3 }, { challengeInvites: invites }, week).complete, false);
const feedGoal = normalizeSelected(['feed_actions'])[0];
assert.equal(feedGoal.target, 10);
const posts = Array.from({length: 3}, (_, i) => ({id:'post-'+i,created_at:at('2026-09-08')}));
const comments = Array.from({length: 4}, (_, i) => ({id:'comment-'+i,created_at:at('2026-09-09')}));
const reactions = Array.from({length: 3}, (_, i) => ({id:'reaction-'+i,created_at:at('2026-09-10')}));
const feedData = {stories:posts,feedComments:comments,feedReactions:reactions};
assert.equal(calculateGoal(feedGoal,feedData,week).current,10);
assert.equal(calculateGoal(feedGoal,feedData,week).complete,true);
assert.equal(calculateGoal(feedGoal,feedData,week).helper,'3 posts, 4 comments, 3 reactions');
feedData.feedReactions = [reactions[0],reactions[0],{id:'old',created_at:at('2026-09-06')}];
assert.equal(calculateGoal(feedGoal,feedData,week).current,8);
assert.equal(calculateGoal(feedGoal,feedData,week).complete,false);
assert.equal(normalizeSelected(['share_meal_feed'])[0].label,'Share meal to Feed');
const calls = [];
window.supabaseClient = { from(table) {
  const chain = new Proxy({}, { get(_, method) {
    if (method === 'then') return resolve => resolve({ data: [] });
    return (...args) => { calls.push({ table, method, args }); return chain; };
  } });
  return chain;
} };
(async () => {
  const data = await loadProgressData('member-1', week);
  assert.ok(Array.isArray(data.challengeInvites));
  const filters = calls.filter(c => c.table === 'challenge_participants');
  assert.ok(filters.some(c => c.method === 'eq' && c.args[0] === 'challenges.creator_id' && c.args[1] === 'member-1'));
  assert.ok(filters.some(c => c.method === 'neq' && c.args[0] === 'user_id' && c.args[1] === 'member-1'));
  assert.ok(filters.some(c => c.method === 'gte' && c.args[0] === 'invited_at'));
  assert.ok(filters.some(c => c.method === 'lt' && c.args[0] === 'invited_at'));
  assert.ok(!calls.some(c => c.table === 'nudges'));
  for (const table of ['feed_comments','feed_reactions']) {
    assert.ok(calls.some(c => c.table === table && c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'member-1'));
    assert.ok(calls.some(c => c.table === table && c.method === 'range'));
  }
  console.log('Weekly goal catalog, invitation ownership, date boundaries, and deduplication passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
