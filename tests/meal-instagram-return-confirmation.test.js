const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const mealUi = fs.readFileSync(
  path.join(root, 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js'),
  'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.match(mealUi, /PBB_PENDING_MEAL_INSTAGRAM_SHARE_KEY/);
assert.match(mealUi, /onSharePrepared:\s*\(\)\s*=>\s*\{[\s\S]*queuePendingMealInstagramShare\(mealForShare\.id, safeTarget\)/);
assert.match(mealUi, /visibilitychange[\s\S]*markPendingMealInstagramShareLeftBalance/);
assert.match(mealUi, /finalizePendingMealInstagramShare[\s\S]*awardBalanceSocialShareXP\('meal', 'instagram_feed', receipt\.mealId\)/);
assert.match(mealUi, /Meal shared to Instagram! \+\$\{MEAL_FEED_SHARE_XP\} XP/);
assert.match(mealUi, /clearPendingMealInstagramShare\(\)[\s\S]*return false/);
assert.match(dashboard, /id:\s*'meal-instagram-return-confirmation-v1'/);
assert.match(dashboard, /title:'Instagram share confirmation'/);

(async function runResumeFlow() {
  const listeners = {};
  const storage = new Map();
  const awards = [];
  const toasts = [];
  const document = {
    visibilityState: 'visible',
    addEventListener(name, handler) { listeners['document:' + name] = handler; },
    querySelectorAll() { return []; }
  };
  const window = {
    currentUser: { id: 'miranda' },
    db: { points: { awardPoints() {} } },
    addEventListener(name, handler) { listeners['window:' + name] = handler; },
    awardBalanceSocialShareXP: async (...args) => {
      awards.push(args);
      return { success: true };
    }
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const start = mealUi.indexOf("const PBB_PENDING_MEAL_INSTAGRAM_SHARE_KEY");
  const end = mealUi.indexOf('\nfunction isMealSharedToFeed', start);
  assert.ok(start >= 0 && end > start, 'resume receipt implementation must be extractable');

  const context = vm.createContext({
    window,
    document,
    localStorage,
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    MEAL_FEED_SHARE_XP: 15,
    getMealInstagramShareButtonText: () => 'IG Feed',
    markMealInstagramShareUsedToday: () => storage.set('marked-used', '1'),
    showToast: (message, type) => toasts.push({ message, type })
  });
  vm.runInContext(mealUi.slice(start, end), context);

  storage.set('pbbPendingMealInstagramShare', JSON.stringify({
    mealId: 'meal-123',
    target: 'feed',
    userId: 'miranda',
    startedAt: Date.now(),
    leftBalance: false
  }));

  document.visibilityState = 'hidden';
  listeners['document:visibilitychange']();
  assert.strictEqual(JSON.parse(storage.get('pbbPendingMealInstagramShare')).leftBalance, true);

  document.visibilityState = 'visible';
  listeners['document:visibilitychange']();
  await new Promise(resolve => setTimeout(resolve, 260));

  assert.deepStrictEqual(awards, [['meal', 'instagram_feed', 'meal-123']]);
  assert.strictEqual(storage.has('pbbPendingMealInstagramShare'), false);
  assert.strictEqual(storage.get('marked-used'), '1');
  assert.deepStrictEqual(toasts, [{ message: 'Meal shared to Instagram! +15 XP', type: 'success' }]);
  console.log('Meal Instagram return confirmation contract and resume flow ok');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
