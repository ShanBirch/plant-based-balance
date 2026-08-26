const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const movement = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const wrappersDir = path.join(root, 'netlify/modern-functions');
const compatibilityAdapter = fs.readFileSync(
  path.join(root, 'netlify/modern-runtime/lambda-compat.mts'),
  'utf8'
);
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('active personalised programs are not replaced by automatic recovery suggestions', () => {
  assert.match(movement, /usingCustomProgram && isAutomaticRecoveryOverride/);
  assert.match(movement, /if \(!usingCustomProgram && userCycleData\.logs/);
  assert.match(movement, /if \(!usingCustomProgram && todaySymptoms && todaySymptoms\.length > 0\)/);
  assert.match(movement, /else if \(!usingCustomProgram && userCycleData\.mood === 'tired'\)/);
  assert.match(movement, /if \(!usingCustomProgram && \(checkin \|\| equipmentFromCheckin\)\)/);
  assert.match(movement, /if \(!usingCustomProgram && !isMale/);
});

test('Movement shows one personalised weekly plan and keeps the current custom workout available', () => {
  assert.match(movement, /const flexibleStartOffset = hasWorkoutOverride \? 0 : 1/);
  assert.match(movement, /Your personalised plan/);
  assert.match(movement, /Your training this week/);
  assert.match(movement, /if \(usingCustomProgram\)/);
});

test('the repaired Movement bundle is cache-busted', () => {
  assert.equal(
    (dashboard.match(/dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=191-program-card-recovery/g) || []).length,
    3
  );
});

test('all deployed functions are routed through the dedicated modern runtime directory', () => {
  assert.match(config, /functions = "netlify\/modern-functions"/);
  assert.doesNotMatch(config, /external_node_modules/);
  const wrappers = fs.readdirSync(wrappersDir).filter((name) => name.endsWith('.mts'));
  assert.equal(wrappers.length, 128);
  const legacyWrappers = wrappers.filter((name) => {
    const source = fs.readFileSync(path.join(wrappersDir, name), 'utf8');
    return source.includes('../modern-runtime/lambda-compat.mts');
  });
  assert.equal(legacyWrappers.length, 104);
  assert.match(compatibilityAdapter, /export function withLambda/);
});

test('dynamic legacy dependencies are pinned into modern function bundles', () => {
  for (const name of ['admin-reset-user-password', 'award-feed-top-post']) {
    const wrapper = read(`netlify/modern-functions/${name}.mts`);
    assert.match(wrapper, /import pbbSupabaseDependency from '\.\.\/modern-runtime\/vendor\/supabase\.bundle\.mjs'/);
    assert.match(wrapper, /globalThis\.__PBB_SUPABASE_DEPENDENCY__ = pbbSupabaseDependency/);
  }

  for (const name of ['send-dm-notification', 'send-meal-plan-ready']) {
    const wrapper = read(`netlify/modern-functions/${name}.mts`);
    assert.match(wrapper, /import pbbWebPushDependency from '\.\.\/modern-runtime\/vendor\/web-push\.bundle\.cjs'/);
    assert.match(wrapper, /globalThis\.__PBB_WEB_PUSH_DEPENDENCY__ = pbbWebPushDependency/);
  }

  assert.match(
    read('netlify/functions/send-meal-reminders.mjs'),
    /import webpush from '\.\.\/modern-runtime\/vendor\/web-push\.bundle\.cjs'/,
  );
  assert.ok(fs.statSync(path.join(root, 'netlify/modern-runtime/vendor/supabase.bundle.mjs')).size > 100_000);
  assert.ok(fs.statSync(path.join(root, 'netlify/modern-runtime/vendor/web-push.bundle.cjs')).size > 100_000);
});
