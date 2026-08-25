const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const diary = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-1-daily_weighin_card_logic.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260825113000_course_diary_and_wearable_evidence.sql'), 'utf8');

test('Foundations Week 4 and every Identity week require an exact diary-to-Feed action', () => {
  assert.match(journey, /task\('w4_diary_feed',[\s\S]*?'foundations_diary_feed'/);
  for (let week = 7; week <= 12; week += 1) {
    assert.match(journey, new RegExp(`task\\('w${week}_diary_feed',[\\s\\S]*?'identity_diary_feed'`));
    assert.match(migration, new RegExp(`'w${week}_diary_feed'`));
  }
  assert.match(diary, /getFitnessDiaryCourseActionId\(\)/);
  assert.match(diary, /course_action_id: courseActionId \|\| null/);
});

test('diary completion joins the exact course action to a real diary check-in in the same course week', () => {
  assert.match(journey, /\.gte\('checkin_date', state\.week_started_at\)[\s\S]*?\.lt\('checkin_date', addDaysKey\(state\.week_started_at, 7\)\)/);
  assert.match(journey, /row\.course_action_id === currentDiaryTaskId/);
  assert.match(journey, /card\.card_type === 'fitness_diary'/);
  assert.match(journey, /diaryEntryDates\.has\(String\(card\.diary_date \|\| ''\)\)/);
  assert.doesNotMatch(journey, /identity_diary_feed:\s*stories\.length/);
});

test('Foundations Week 1 wearable setup records distinct equal-credit outcomes', () => {
  assert.match(journey, /task\('w1_wearable_setup',[\s\S]*?'wearable_setup'/);
  assert.match(journey, /status: 'verified_connection'[\s\S]*?source_record_id:[\s\S]*?course_credit: 1/);
  assert.match(journey, /status: 'no_compatible_watch'[\s\S]*?course_credit: 1/);
  assert.match(journey, /existing\.status === 'no_compatible_watch' \? existing/);
  assert.match(journey, /\['verified_connection', 'no_compatible_watch'\]\.includes\(wearableSetup\.status\)/);
  const identity = journey.slice(journey.indexOf('week: 7,'), journey.indexOf('const WEEK_LESSONS'));
  assert.doesNotMatch(identity, /wearable_setup|w1_wearable_setup/);
});

test('Instagram recommendation curation is an explicit idempotent member attestation', () => {
  assert.match(journey, /task\('w7_reset',[\s\S]*?'member_attestation'/);
  assert.match(journey, /Balance cannot read or verify your Instagram settings/);
  assert.match(journey, /if \(!safeObject\(attestations\[taskId\]\)\.confirmed_at\)/);
  assert.match(journey, /statement_version: taskId === 'w7_reset' \? 'instagram_recommendation_curation_v1'/);
  assert.match(journey, /externally_verified: false/);
  assert.match(journey, /Confirm I did this/);
});

test('Identity stores the member Instagram profile separately from unverified external settings', () => {
  assert.match(journey, /task\('w7_profile',[\s\S]*?'instagram_profile'/);
  assert.match(journey, /\.from\('users'\)[\s\S]*?\.update\(\{ ig_handle: plan\.instagram_handle \}\)/);
  assert.match(journey, /instagram_identity_confirmation:[\s\S]*?source: 'member_profile_field'[\s\S]*?ownership_verified: false/);
  assert.match(journey, /This identifies your chosen profile, but does not prove any Instagram setting or post/);
});

test('Identity automatic Instagram counts are limited to durable Balance-origin handoff receipts', () => {
  assert.match(journey, /from\('point_transactions'\)[\s\S]*?verification_method[\s\S]*?'earn_meal_instagram_share'[\s\S]*?'earn_activity_instagram_share'[\s\S]*?'earn_workout_instagram_share'/);
  assert.match(journey, /Balance records its completed share handoffs, but cannot confirm an Instagram post was published/);
  assert.match(journey, /Completion comes from Balance-origin share handoff receipts, not an assumed public post/);
});

test('Identity lesson keeps behaviour and Balance Feed upstream of Instagram', () => {
  assert.match(journey, /Do the health behaviour first and reflect on it in Balance Feed/);
  assert.match(journey, /Keep Balance Feed as the weekly community and reflection home/);
  assert.match(journey, /outward extension of behaviours you are already practising, not the main goal/);
});
